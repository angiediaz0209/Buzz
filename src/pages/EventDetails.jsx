import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ArrowLeft, Plus, Calendar, MapPin, Palette, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTheme } from '../utils/theme';

function EventDetails() {
  const { eventId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId || !currentUser) return;

    const loadEvent = async () => {
      try {
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (eventDoc.exists()) {
          const eventData = { id: eventDoc.id, ...eventDoc.data() };
          setEvent(eventData);
        } else {
          toast.error('Event not found');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error loading event:', error);
        toast.error('Failed to load event');
      } finally {
        setLoading(false);
      }
    };

    loadEvent();

    // Real-time listener for queues
    const queuesRef = collection(db, 'queues');
    const q = query(queuesRef, where('eventId', '==', eventId));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const queuesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setQueues(queuesData);
    });

    return () => unsubscribe();
  }, [eventId, currentUser, navigate]);

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const closeEvent = async () => {
    if (!confirm('Are you sure you want to close this event?')) return;

    try {
      await updateDoc(doc(db, 'events', eventId), {
        status: 'completed'
      });
      toast.success('Event closed');
      navigate('/dashboard');
    } catch (error) {
      console.error('Error closing event:', error);
      toast.error('Failed to close event');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div>
          <p className="mt-4 text-stone-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const theme = getTheme(event.colorTheme);

  const handleDeleteQueue = async (e, queueId) => {
    e.stopPropagation();
    if (!confirm('Delete this queue? This cannot be undone.')) return;
  
    try {
      // Delete all customers in queue
      const customersSnapshot = await getDocs(
        query(collection(db, 'customers'), where('queueId', '==', queueId))
      );
      for (const customerDoc of customersSnapshot.docs) {
        await deleteDoc(doc(db, 'customers', customerDoc.id));
      }
  
      // Delete queue
      await deleteDoc(doc(db, 'queues', queueId));
      toast.success('Queue deleted!');
    } catch (error) {
      console.error('Error deleting queue:', error);
      toast.error('Failed to delete queue');
    }
  };

  return (
    <div className={`min-h-screen bg-cream-100`}>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Event Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-stone-600 hover:text-ink-900 transition-colors mb-3 text-sm"
            >
              <ArrowLeft size={16} />
              <span>Back to Dashboard</span>
            </button>
            <h1 className="text-3xl font-bold text-ink-900">{event.name}</h1>
            <div className="flex flex-wrap gap-4 mt-2 text-sm text-stone-600">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-honey-600" />
                <span>{formatDate(event.date)}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin size={16} className="text-honey-600" />
                <span>{event.location?.address || 'No location'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={closeEvent}
            className="px-4 py-2 border-2 border-red-300 text-red-700 rounded-lg font-semibold hover:bg-red-50 transition-colors"
          >
            Close Event
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-honey-100 rounded-lg">
                <Users className="text-ink-900" size={24} />
              </div>
              <div>
                <p className="text-sm text-stone-600">Total Queues</p>
                <p className="text-3xl font-bold text-ink-900">{queues.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 bg-sage-100 rounded-lg">
                <Users className="text-sage-500" size={24} />
              </div>
              <div>
                <p className="text-sm text-stone-600">Total Customers</p>
                <p className="text-3xl font-bold text-ink-900">{event.totalCustomers || 0}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`p-3 ${theme.bg} rounded-lg`}>
                <Palette className={theme.text} size={24} />
              </div>
              <div>
                <p className="text-sm text-stone-600">Color Theme</p>
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded-full ${theme.accent}`} />
                  <p className="text-lg font-bold text-ink-900 capitalize">{event.colorTheme}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Queues Section */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-ink-900">Queues</h2>
            <button
              onClick={() => navigate(`/event/${eventId}/create-queue`)}
              className={`flex items-center gap-2 bg-honey-500 text-ink-900 px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all`}
            >
              <Plus size={20} />
              Create Queue
            </button>
          </div>

          {queues.length === 0 ? (
            <div className="text-center py-12">
              <h3 className="text-xl font-bold text-ink-800 mb-2">No Queues Yet</h3>
              <p className="text-stone-600 mb-6">
                Create your first queue to start managing customers!
              </p>
              <button
                onClick={() => navigate(`/event/${eventId}/create-queue`)}
                className="inline-flex items-center gap-2 bg-honey-500 text-ink-900 px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                <Plus size={20} />
                Create Queue
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {queues.map((queue) => (
                <div
                  key={queue.id}
                  className="border-2 border-cream-200 rounded-xl p-6 hover:border-honey-300 hover:shadow-lg transition-all cursor-pointer"
                  onClick={() => navigate(`/queue/${queue.id}/manage`)}
                >
                  <div className="flex justify-between items-start mb-4">
                    <h3 className="text-xl font-bold text-ink-900">{queue.name}</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      queue.status === 'open' 
                        ? 'bg-sage-100 text-sage-600'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {queue.status || 'open'}
                    </span>
                  </div>

                  <div className="space-y-2 text-sm text-stone-600">
                    <div className="flex justify-between">
                      <span>Now Serving:</span>
                      <span className={`font-bold ${theme.text}`}>#{queue.currentNumber || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Waiting:</span>
                      <span className="font-bold text-sage-500">{queue.waitingCount || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed:</span>
                      <span className="font-bold text-ink-700">{queue.totalServed || 0}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/queue/${queue.id}/manage`);
                      }}
                      className={`flex-1 bg-honey-500 text-ink-900 py-2 rounded-lg font-semibold hover:shadow-lg transition-all`}
                    >
                      Manage Queue
                    </button>
                    <button
                      onClick={(e) => handleDeleteQueue(e, queue.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete queue"
                    >
                      🗑️
                    </button>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default EventDetails;