import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  runTransaction
} from 'firebase/firestore';
import toast from 'react-hot-toast';
import { getTheme } from '../utils/theme';

const RESET_SECONDS = 10;

function Kiosk() {
  const { eventId, queueId } = useParams();

  const [event, setEvent] = useState(null);
  const [queues, setQueues] = useState([]);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('select'); // select | form | success
  const [countdown, setCountdown] = useState(RESET_SECONDS);
  const [assignedNumber, setAssignedNumber] = useState(null);

  const [formData, setFormData] = useState({
    childName: '',
    parentName: '',
    phone: '',
    isChild: true,
    marketingConsent: false
  });

  // Load event and queues
  useEffect(() => {
    if (!eventId) return;

    const loadData = async () => {
      try {
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (!eventDoc.exists()) {
          setLoading(false);
          return;
        }
        setEvent({ id: eventDoc.id, ...eventDoc.data() });

        // If specific queue provided, load just that one
        if (queueId) {
          const queueDoc = await getDoc(doc(db, 'queues', queueId));
          if (queueDoc.exists()) {
            const queueData = { id: queueDoc.id, ...queueDoc.data() };
            setQueues([queueData]);
            setSelectedQueue(queueData);
            setStep('form');
          }
        } else {
          // Load all visible queues
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

            // If only one queue, auto-select it
            if (queuesData.length === 1) {
              setSelectedQueue(queuesData[0]);
              setStep('form');
            }

            setLoading(false);
          });

          return () => unsubscribe();
        }

        setLoading(false);
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();
  }, [eventId, queueId]);

  // Countdown timer after success
  useEffect(() => {
    if (step !== 'success') return;

    setCountdown(RESET_SECONDS);

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleReset();
          return RESET_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [step]);

  const handleReset = () => {
    setFormData({
      childName: '',
      parentName: '',
      phone: '',
      isChild: true
    });
    setAssignedNumber(null);

    // If specific queue, go back to form
    // If multiple queues, go back to selection
    if (queueId || queues.length === 1) {
      setStep('form');
    } else {
      setSelectedQueue(null);
      setStep('select');
    }
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
    if (!selectedQueue) return;
  
    setSubmitting(true);
  
    try {
      const nextNumber = await getNextNumber(selectedQueue.id);
  
      const customerData = {
        queueId: selectedQueue.id,
        eventId,
        number: nextNumber,
        childName: formData.isChild ? formData.childName : '',
        parentName: formData.parentName || '',
        isChild: formData.isChild,
        phone: formData.phone || '',
        email: '',
        notificationMethod: 'screen',
        status: 'waiting',
        response: null,
        joinedAt: serverTimestamp(),
        isKiosk: true
      };
  
      await addDoc(collection(db, 'customers'), customerData);
  
      // Save to contacts if consent given
      if (formData.marketingConsent && formData.phone) {
        await addDoc(collection(db, 'contacts'), {
          parentName: formData.parentName || formData.childName,
          phone: formData.phone || '',
          email: '',
          artistId: event.artistId,
          eventId: eventId,
          eventType: event.eventType || 'other',
          consentDate: serverTimestamp(),
          consentText: "Yes! Notify me about future events from this artist and ArtistLine.",
          source: 'kiosk'
        });
      }
  
      // Update queue waiting count
      await updateDoc(doc(db, 'queues', selectedQueue.id), {
        waitingCount: (selectedQueue.waitingCount || 0) + 1
      });
  
      // Update event total customers
      await updateDoc(doc(db, 'events', eventId), {
        totalCustomers: (event.totalCustomers || 0) + 1
      });
  
      setAssignedNumber(nextNumber);
      setStep('success');
  
    } catch (error) {
      console.error('Error joining queue:', error);
      toast.error('Failed to join queue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({ ...formData, [e.target.name]: value });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lavender-50 to-softpink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-lavender-600"></div>
          <p className="mt-4 text-2xl text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  const theme = getTheme(event?.colorTheme);

  // SUCCESS SCREEN
  if (step === 'success') {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${theme.gradient} flex items-center justify-center p-8`}>
        <div className="text-center text-white">
          <div className="text-8xl mb-6">🎉</div>
          <h1 className="text-4xl font-bold mb-4">You're In!</h1>
          <p className="text-2xl mb-8 opacity-90">Your number is:</p>

          {/* Big Number */}
          <div className="bg-white rounded-3xl p-12 mb-8 shadow-2xl inline-block">
            <div className={`text-9xl font-bold ${theme.text}`}>
              #{assignedNumber}
            </div>
          </div>

          <p className="text-xl mb-4 opacity-90">
            Queue: <strong>{selectedQueue?.name}</strong>
          </p>

          <p className="text-lg opacity-75 mb-8">
            Watch the display screen for your number!
          </p>

          {/* Countdown */}
          <div className="bg-white/20 rounded-2xl p-6">
            <p className="text-lg opacity-90 mb-2">
              Next customer in:
            </p>
            <div className="text-6xl font-bold">
              {countdown}
            </div>
            <p className="text-sm opacity-75 mt-2">seconds</p>
          </div>

          {/* Manual reset button */}
          <button
            onClick={handleReset}
            className={`mt-8 bg-white ${theme.text} px-8 py-4 rounded-xl font-bold text-lg hover:shadow-lg transition-all`}
          >
            Next Customer →
          </button>
        </div>
      </div>
    );
  }

  // QUEUE SELECTION SCREEN
  if (step === 'select') {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${theme.gradientBg} flex items-center justify-center p-8`}>
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className={`text-5xl font-bold ${theme.text} mb-2`}>
              🎨 Welcome!
            </h1>
            <p className="text-2xl text-gray-600">Choose your queue</p>
          </div>

          <div className="space-y-4">
            {queues.map((queue) => (
              <button
                key={queue.id}
                onClick={() => {
                  setSelectedQueue(queue);
                  setStep('form');
                }}
                className={`w-full bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all text-left border-2 border-transparent ${theme.hoverBorder}`}
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900 mb-2">
                      {queue.name}
                    </h2>
                    <p className="text-xl text-gray-600">
                      {queue.waitingCount || 0} people waiting
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-500 text-lg">Now serving</p>
                    <p className={`text-5xl font-bold ${theme.text}`}>
                      #{queue.currentNumber || 0}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // FORM SCREEN
  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.gradientBg} flex items-center justify-center p-8`}>
      <div className="w-full max-w-2xl">
        <div className="text-center mb-8">
          <h1 className={`text-4xl font-bold ${theme.text} mb-2`}>
            🎨 Join {selectedQueue?.name}
          </h1>
          <p className="text-xl text-gray-600">Enter your info below</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Name */}
            <div>
              <label className="block text-xl font-medium text-gray-700 mb-3">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="childName"
                value={formData.childName}
                onChange={handleChange}
                required
                className="w-full px-6 py-4 text-xl border-2 border-gray-200 rounded-xl focus:border-lavender-500 focus:outline-none transition-colors"
                placeholder="Enter name"
              />
            </div>

            {/* Is Child */}
            <div className="bg-lavender-50 rounded-xl p-5 border-2 border-lavender-200">
              <label className="flex items-center gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  name="isChild"
                  checked={formData.isChild}
                  onChange={handleChange}
                  className="w-7 h-7 text-lavender-600 border-gray-300 rounded"
                />
                <span className="text-xl font-medium text-gray-900">
                  This is a child's name
                </span>
              </label>
            </div>

            {/* Parent Name */}
            {formData.isChild && (
              <div>
                <label className="block text-xl font-medium text-gray-700 mb-3">
                  Parent/Guardian Name
                </label>
                <input
                  type="text"
                  name="parentName"
                  value={formData.parentName}
                  onChange={handleChange}
                  className="w-full px-6 py-4 text-xl border-2 border-gray-200 rounded-xl focus:border-lavender-500 focus:outline-none transition-colors"
                  placeholder="Parent's name (optional)"
                />
              </div>
            )}

            {/* Phone */}
            <div>
              <label className="block text-xl font-medium text-gray-700 mb-3">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-6 py-4 text-xl border-2 border-gray-200 rounded-xl focus:border-lavender-500 focus:outline-none transition-colors"
                placeholder="For notifications (optional)"
              />
            </div>


            {/* Marketing Consent */}
            <div className="bg-gradient-to-r from-lavender-50 to-softpink-50 rounded-xl p-5 border-2 border-lavender-200">
            <label className="flex items-start gap-4 cursor-pointer">
                <input
                type="checkbox"
                name="marketingConsent"
                checked={formData.marketingConsent}
                onChange={handleChange}
                className="mt-1 w-7 h-7 text-lavender-600 border-gray-300 rounded"
                />
                <div>
                <p className="text-xl font-semibold text-gray-900">
                    🎁 Hear about future events!
                </p>
                <p className="text-base text-gray-600 mt-1">
                    Get notified about upcoming events near you.
                    We never spam. Unsubscribe anytime.
                </p>
                </div>
            </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting}
              className={`w-full bg-gradient-to-r ${theme.gradient} text-white py-6 rounded-xl font-bold text-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50`}
            >
              {submitting ? 'Joining...' : 'Get My Number! 🎨'}
            </button>
          </form>
        </div>

        {/* Back button (only if multiple queues) */}
        {queues.length > 1 && (
          <button
            onClick={() => {
              setSelectedQueue(null);
              setStep('select');
            }}
            className="w-full mt-4 py-4 text-gray-600 font-medium text-lg"
          >
            ← Choose Different Queue
          </button>
        )}
      </div>
    </div>
  );
}

export default Kiosk;