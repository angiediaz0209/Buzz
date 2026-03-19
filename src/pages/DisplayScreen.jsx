import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { getTheme } from '../utils/theme';

function DisplayScreen() {
  const { eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [queues, setQueues] = useState([]);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;

    // Load event
    const loadEvent = async () => {
      const eventDoc = await getDoc(doc(db, 'events', eventId));
      if (eventDoc.exists()) {
        setEvent({ id: eventDoc.id, ...eventDoc.data() });
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
      setLoading(false);
    });

    return () => unsubscribe();
  }, [eventId]);

  // Auto-select when there's exactly one queue
  useEffect(() => {
    if (queues.length === 1 && !selectedQueue) {
      setSelectedQueue(queues[0]);
    }
  }, [queues, selectedQueue]);

  // Keep selectedQueue data in sync with real-time updates
  useEffect(() => {
    if (!selectedQueue) return;
    const updated = queues.find(q => q.id === selectedQueue.id);
    if (updated) {
      setSelectedQueue(updated);
    }
  }, [queues]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-lavender-600 to-softpink-600 text-white">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-white mb-4"></div>
          <p className="text-2xl">Loading...</p>
        </div>
      </div>
    );
  }

  if (!event || queues.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-lavender-600 to-softpink-600 text-white p-8">
        <div className="text-center">
          <h1 className="text-6xl font-bold mb-4">🎨</h1>
          <h2 className="text-4xl font-bold mb-4">{event?.name || 'Event'}</h2>
          <p className="text-2xl opacity-90">No active queues</p>
        </div>
      </div>
    );
  }

  const theme = getTheme(event.colorTheme);

  // QUEUE PICKER — shown when multiple queues and none selected yet
  if (!selectedQueue) {
    return (
      <div className={`h-screen flex flex-col items-center justify-center bg-gradient-to-br ${theme.gradientBg} p-8`}>
        <div className="text-center mb-10">
          <h1 className={`text-5xl md:text-7xl font-bold ${theme.text} mb-3`}>
            {event.name}
          </h1>
          <p className="text-2xl md:text-3xl text-gray-600">Select a queue to display</p>
        </div>

        <div className="w-full max-w-3xl space-y-4">
          {queues.map((queue) => (
            <button
              key={queue.id}
              onClick={() => setSelectedQueue(queue)}
              className={`w-full bg-white rounded-2xl shadow-lg p-8 hover:shadow-xl transition-all text-left border-4 border-transparent ${theme.hoverBorder}`}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
                    {queue.name}
                  </h2>
                  <p className="text-xl text-gray-600">
                    {queue.waitingCount || 0} people waiting
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-gray-500 text-lg">Now serving</p>
                  <p className={`text-5xl md:text-7xl font-bold ${theme.text}`}>
                    #{queue.currentNumber || 0}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // SINGLE QUEUE DISPLAY
  return (
    <div className={`h-screen flex flex-col items-center justify-center bg-gradient-to-br ${theme.gradientBg} p-8 relative`}>

      {/* Queue Name */}
      <div className="text-center mb-6">
        <h2 className="text-4xl md:text-6xl font-bold text-gray-900">{selectedQueue.name}</h2>
        <p className="text-2xl md:text-3xl text-gray-700 mt-2">Now Serving</p>
      </div>

      {/* Current Number - MASSIVE with colored border */}
      <div className={`bg-white rounded-3xl p-16 md:p-24 mb-8 shadow-2xl border-8 ${theme.border}`}>
        <div className="text-center">
          <div className="text-[12rem] md:text-[25rem] font-bold leading-none text-gray-900">
            {selectedQueue.currentNumber || '-'}
          </div>
        </div>
      </div>

      {/* Queue Info */}
      <div className="text-center">
        <p className="text-xl md:text-2xl text-gray-700">
          <span className="font-bold text-gray-900">{selectedQueue.waitingCount || 0}</span> people waiting
        </p>
        {selectedQueue.waitingCount > 0 && (
          <p className="text-lg md:text-xl text-gray-600 mt-2">
            Est. wait: <span className="font-semibold text-gray-900">{((selectedQueue.avgServiceTime || 5) + 2)} min</span>
          </p>
        )}
      </div>

      {/* Back button — only if multiple queues */}
      {queues.length > 1 && (
        <button
          onClick={() => setSelectedQueue(null)}
          className="absolute top-6 left-6 px-4 py-2 bg-white/80 text-gray-700 rounded-lg text-sm font-medium hover:bg-white transition-all"
        >
          ← Change Queue
        </button>
      )}
    </div>
  );
}

export default DisplayScreen;
