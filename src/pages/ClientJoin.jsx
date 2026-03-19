import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import {
    doc,
    getDoc,
    collection,
    query,
    where,
    addDoc,
    updateDoc,
    serverTimestamp,
    onSnapshot,
    runTransaction
  } from 'firebase/firestore';
import { Users, ArrowLeft, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTheme } from '../utils/theme';

function ClientJoin() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [event, setEvent] = useState(null);
  const [queues, setQueues] = useState([]);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null); // { number, customerDocId }
  const [artistUsername, setArtistUsername] = useState(null);
  
  const [formData, setFormData] = useState({
    name: '',
    phone: ''
  });

  useEffect(() => {
    if (!eventId) return;

    // Load event and queues
    const loadData = async () => {
      try {
        // Load event
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (!eventDoc.exists()) {
          toast.error('Event not found');
          return;
        }
        
        const eventData = { id: eventDoc.id, ...eventDoc.data() };
        setEvent(eventData);

        // Look up artist username for back navigation
        const artistDoc = await getDoc(doc(db, 'artists', eventData.artistId));
        if (artistDoc.exists() && artistDoc.data().username) {
          setArtistUsername(artistDoc.data().username);
        }

        // Load visible queues
        const queuesRef = collection(db, 'queues');
        const q = query(
          queuesRef,
          where('eventId', '==', eventId),
          where('isVisible', '==', true),
          where('status', '==', 'open')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
          const queuesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setQueues(queuesData);
          setLoading(false);
        });

        return () => unsubscribe();
      } catch (error) {
        console.error('Error loading data:', error);
        toast.error('Failed to load event');
        setLoading(false);
      }
    };

    loadData();
  }, [eventId]);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const getNextNumber = async (queueId) => {
    const queueRef = doc(db, 'queues', queueId);
    return await runTransaction(db, async (transaction) => {
      const queueSnap = await transaction.get(queueRef);
      const next = (queueSnap.data().lastNumber || 0) + 1;
      transaction.update(queueRef, { lastNumber: next });
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const queue = queues.length === 1 ? queues[0] : selectedQueue;
    if (!queue) {
      toast.error('Please select a queue');
      return;
    }

    setSubmitting(true);

    try {
      const nextNumber = await getNextNumber(queue.id);

      const customerData = {
        queueId: queue.id,
        eventId: eventId,
        number: nextNumber,
        name: formData.name,
        phone: formData.phone,
        status: 'waiting',
        response: null,
        joinedAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'customers'), customerData);

      // Update queue waiting count
      await updateDoc(doc(db, 'queues', queue.id), {
        waitingCount: (queue.waitingCount || 0) + 1
      });

      // Update event total customers
      await updateDoc(doc(db, 'events', eventId), {
        totalCustomers: (event.totalCustomers || 0) + 1
      });

      setSuccess({ number: nextNumber, customerDocId: docRef.id });

      // Auto-redirect back to choice screen after 3 seconds
      const fromArtist = location.state?.artistUsername;
      setTimeout(() => {
        if (fromArtist) {
          navigate(`/artist/${fromArtist}`, { state: { returnToChoice: true } });
        } else if (artistUsername) {
          navigate(`/artist/${artistUsername}`, { state: { returnToChoice: true } });
        } else {
          navigate(`/customer/${docRef.id}`);
        }
      }, 3000);
      
    } catch (error) {
      console.error('Error joining queue:', error);
      toast.error('Failed to join queue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lavender-50 to-softpink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-lavender-600"></div>
          <p className="mt-4 text-gray-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lavender-50 to-softpink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h1>
          <p className="text-gray-600">This event may have been closed or removed.</p>
        </div>
      </div>
    );
  }

  const theme = getTheme(event.colorTheme);

  // Success screen — shown for 3 seconds after joining
  if (success) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
        <CheckCircle size={80} className="text-green-400 mb-6" />
        <h1 className="text-6xl sm:text-8xl font-bold text-white mb-4">
          #{success.number}
        </h1>
        <p className="text-2xl text-white/80 font-medium">You're in line!</p>
        <p className="text-white/50 mt-4 text-sm">Redirecting...</p>
      </div>
    );
  }

  // Auto-select if single queue
  const activeQueue = queues.length === 1 ? queues[0] : selectedQueue;

  const handleBack = () => {
    const fromArtist = location.state?.artistUsername;
    if (fromArtist) {
      navigate(`/artist/${fromArtist}`, { state: { returnToChoice: true } });
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.gradientBg} pb-10`}>
      {/* Header with back button */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className={`text-lg font-bold ${theme.text}`}>
            {event.name}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Queue Selection (only when multiple queues) */}
        {!activeQueue ? (
          <div className="space-y-4">
            {queues.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <p className="text-gray-600">No queues available at this time.</p>
              </div>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Choose a Queue</h2>
                {queues.map((queue) => (
                  <button
                    key={queue.id}
                    onClick={() => setSelectedQueue(queue)}
                    className={`w-full bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all text-left border-2 border-transparent ${theme.hoverBorder}`}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          {queue.name}
                        </h3>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Users size={16} />
                          <span>{queue.waitingCount || 0} people waiting</span>
                        </div>
                      </div>
                      <span className={`text-sm font-semibold ${theme.text}`}>Join →</span>
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        ) : (
          /* Join Form — just name + phone */
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-lavender-500 focus:outline-none transition-colors text-lg"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-lavender-500 focus:outline-none transition-colors text-lg"
                  placeholder="555-0123"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`w-full bg-gradient-to-r ${theme.gradient} text-white py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50`}
              >
                {submitting ? 'Joining...' : 'Get My Turn'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}

export default ClientJoin;