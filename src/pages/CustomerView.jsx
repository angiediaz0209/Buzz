import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { ArrowLeft, Clock, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTheme } from '../utils/theme';

function CustomerView() {
  const { customerId } = useParams();
  const navigate = useNavigate();
  
  const [customer, setCustomer] = useState(null);
  const [queue, setQueue] = useState(null);
  const [event, setEvent] = useState(null);
  const [position, setPosition] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customerId) return;

    // Real-time listener for customer data
    const unsubscribe = onSnapshot(doc(db, 'customers', customerId), async (snapshot) => {
      if (!snapshot.exists()) {
        toast.error('Customer not found');
        setLoading(false);
        return;
      }

      const customerData = { id: snapshot.id, ...snapshot.data() };
      setCustomer(customerData);

      // Load queue data
      const queueDoc = await getDoc(doc(db, 'queues', customerData.queueId));
      if (queueDoc.exists()) {
        setQueue({ id: queueDoc.id, ...queueDoc.data() });

        // Load event data
        const eventDoc = await getDoc(doc(db, 'events', queueDoc.data().eventId));
        if (eventDoc.exists()) {
          setEvent({ id: eventDoc.id, ...eventDoc.data() });
        }
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, [customerId]);

  // Calculate position in queue
  useEffect(() => {
    if (!customer || !queue) return;

    const calculatePosition = async () => {
      const customersSnapshot = await getDoc(doc(db, 'queues', customer.queueId));
      // This is simplified - in real implementation, query all waiting customers
      // and count those with number < current customer number
      
      if (customer.status === 'waiting') {
        const pos = customer.number - (queue.currentNumber || 0);
        setPosition(pos > 0 ? pos : 0);
      } else {
        setPosition(0);
      }
    };

    calculatePosition();
  }, [customer, queue]);

  const handleResponse = async (response) => {
    if (!customer) return;

    try {
      if (response === 'coming') {
        await updateDoc(doc(db, 'customers', customerId), {
          status: 'coming',
          response: 'coming',
          respondedAt: new Date()
        });
        toast.success("Great! We'll see you soon!");
      } else if (response === 'skip') {
        if (confirm("Are you sure you can't make it?")) {
          await updateDoc(doc(db, 'customers', customerId), {
            status: 'skipped',
            response: 'skipped',
            respondedAt: new Date()
          });
          toast.success("No worries! You've been removed from the queue.");
        }
      }
    } catch (error) {
      console.error('Error updating response:', error);
      toast.error('Failed to update. Please try again.');
    }
  };

  const calculateWaitTime = () => {
    if (!queue || !position) return 'Soon!';
    const avgTime = queue.avgServiceTime || 5;
    const waitMinutes = position * avgTime + 2; // +2 minute buffer
    return `${waitMinutes} min`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lavender-50 to-softpink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-lavender-600"></div>
          <p className="mt-4 text-gray-600">Loading your status...</p>
        </div>
      </div>
    );
  }

  if (!customer || !queue || !event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lavender-50 to-softpink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Not Found</h1>
          <p className="text-gray-600">This queue entry doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const isYourTurn = customer.status === 'called';
  const isComing = customer.status === 'coming';
  const isSkipped = customer.status === 'skipped';
  const isCompleted = customer.status === 'completed';
  const theme = getTheme(event.colorTheme);

  if (isSkipped) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${theme.gradientBg} flex items-center justify-center p-4`}>
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <div className="text-5xl mb-4">👋</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">You've Left the Queue</h1>
          <p className="text-gray-600 mb-6">No worries! You can rejoin anytime.</p>
          <button
            onClick={() => navigate(`/join/${event.id}`)}
            className={`bg-gradient-to-r ${theme.gradient} text-white px-6 py-3 rounded-xl font-semibold`}
          >
            Rejoin Queue
          </button>
        </div>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className={`min-h-screen bg-gradient-to-br ${theme.gradientBg} flex items-center justify-center p-4`}>
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">All Done!</h1>
          <p className="text-gray-600">Thanks for visiting {event.name}!</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gradient-to-br ${theme.gradientBg} pb-10`}>
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <button
            onClick={() => navigate(`/join/${event.id}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors mb-3"
          >
            <ArrowLeft size={20} />
            <span>Back to Event</span>
          </button>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">{queue.name}</h1>
            <p className="text-sm text-gray-600">{event.name}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Your Turn Number - BIG */}
        <div className={`rounded-2xl shadow-xl p-8 mb-6 ${
          isYourTurn 
            ? 'bg-gradient-to-br from-green-400 to-green-600 animate-pulse' 
            : 'bg-white'
        }`}>
          <div className="text-center">
            <p className={`text-sm mb-2 ${isYourTurn ? 'text-white' : 'text-gray-600'}`}>
              {isYourTurn ? "🎉 IT'S YOUR TURN!" : 'Your Number'}
            </p>
            <div className={`text-8xl font-bold mb-4 ${
              isYourTurn ? 'text-white' : theme.text
            }`}>
              #{customer.number}
            </div>
            <p className={`text-lg font-semibold ${isYourTurn ? 'text-white' : 'text-gray-900'}`}>
              {customer.childName || customer.parentName}
            </p>
            {customer.childName && customer.parentName && (
              <p className={`text-sm ${isYourTurn ? 'text-white/80' : 'text-gray-600'}`}>
                Parent: {customer.parentName}
              </p>
            )}
          </div>
        </div>

        {/* Status Card */}
        {!isYourTurn && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className={`text-center p-4 ${theme.bg} rounded-xl`}>
                <p className="text-sm text-gray-600 mb-1">Now Serving</p>
                <p className={`text-4xl font-bold ${theme.text}`}>
                  #{queue.currentNumber || 0}
                </p>
              </div>
              <div className="text-center p-4 bg-softpink-50 rounded-xl">
                <p className="text-sm text-gray-600 mb-1">People Ahead</p>
                <p className="text-4xl font-bold text-softpink-600">
                  {position}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-gray-600 mb-2">
              <Clock size={18} />
              <span>Estimated wait: <strong>{calculateWaitTime()}</strong></span>
            </div>

            {isComing && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3 text-center">
                <p className="text-blue-700 font-semibold">✓ Marked as coming</p>
              </div>
            )}
          </div>
        )}

        {/* Response Buttons - Only show when called */}
        {isYourTurn && !customer.response && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
            <p className="text-center text-gray-700 font-semibold mb-4">
              Please let us know:
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => handleResponse('coming')}
                className="bg-green-500 text-white py-4 px-6 rounded-xl font-bold hover:bg-green-600 transition-all"
              >
                ✓ I'll Be There Soon
              </button>
              <button
                onClick={() => handleResponse('skip')}
                className="bg-red-500 text-white py-4 px-6 rounded-xl font-bold hover:bg-red-600 transition-all"
              >
                ✗ Can't Make It
              </button>
            </div>
          </div>
        )}

        {/* Info */}
        <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 text-sm text-blue-900">
          <p className="font-semibold mb-2">💡 Tips:</p>
          <ul className="space-y-1 ml-4">
            <li>• Keep this page open to see live updates</li>
            <li>• You'll see when your number is called</li>
            <li>• Bookmark this page to check back anytime</li>
          </ul>
        </div>

        {/* Skip Turn Button */}
        {customer.status === 'waiting' && (
          <div className="mt-6">
            <button
              onClick={() => handleResponse('skip')}
              className="w-full py-3 text-gray-600 hover:text-gray-900 font-medium"
            >
              Can't make it? Skip my turn
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

export default CustomerView;