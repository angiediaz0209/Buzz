import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { getTheme } from '../utils/theme';
import { BuzzMark, Mascot } from '../components/BuzzBrand';

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
      <div className="h-screen flex items-center justify-center bg-cream-100">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-14 w-14 border-b-4 border-honey-500 mb-4"></div>
          <p className="text-2xl text-stone-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!event || queues.length === 0) {
    return (
      <div className="h-screen flex items-center justify-center bg-cream-100 p-8">
        <div className="text-center">
          <Mascot className="w-48 h-auto mx-auto mb-4" />
          <h2 className="text-4xl font-extrabold text-ink-900 mb-2">{event?.name || 'Event'}</h2>
          <p className="text-2xl text-stone-600">No open queues right now</p>
        </div>
      </div>
    );
  }

  const theme = getTheme(event.colorTheme);

  // QUEUE PICKER — shown when multiple queues and none selected yet
  if (!selectedQueue) {
    return (
      <div className={`h-screen flex flex-col items-center justify-center bg-cream-100 p-8`}>
        <div className="text-center mb-10">
          <h1 className={`text-5xl md:text-7xl font-bold ${theme.text} mb-3`}>
            {event.name}
          </h1>
          <p className="text-2xl md:text-3xl text-stone-600">Select a queue to display</p>
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
                  <h2 className="text-3xl md:text-4xl font-bold text-ink-900 mb-2">
                    {queue.name}
                  </h2>
                  <p className="text-xl text-stone-600">
                    {queue.waitingCount || 0}{' '}
                    {(queue.waitingCount || 0) === 1 ? 'person' : 'people'} waiting
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-stone-500 text-lg">Now serving</p>
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
    <div className={`h-screen flex flex-col items-center justify-center bg-cream-100 p-8 relative`}>

      {/* Buzz mark, small and out of the way */}
      <div className="absolute top-6 right-8">
        <BuzzMark size={30} textClass="text-2xl" className="text-ink-900" />
      </div>

      {/* Queue Name */}
      <div className="text-center mb-4">
        <h2 className="text-4xl md:text-6xl font-extrabold text-ink-900">{selectedQueue.name}</h2>
        <p className="text-2xl md:text-3xl text-stone-500 mt-2">Now serving</p>
      </div>

      {/* The number, as big as the screen allows */}
      <div className={`bg-white rounded-[3rem] px-16 md:px-28 py-10 md:py-16 mb-8 shadow-xl border-4 ${theme.border}`}>
        <div className="text-[11rem] md:text-[22rem] font-black leading-none text-sage-400 text-center">
          {selectedQueue.currentNumber || '—'}
        </div>
      </div>

      <Mascot className="absolute bottom-6 left-8 w-32 md:w-44 h-auto" />

      {/* Queue Info */}
      <div className="text-center">
        <p className="text-xl md:text-2xl text-ink-700">
          <span className="font-bold text-ink-900">{selectedQueue.waitingCount || 0}</span>{' '}
          {(selectedQueue.waitingCount || 0) === 1 ? 'person' : 'people'} waiting
        </p>
        {selectedQueue.waitingCount > 0 && (
          <p className="text-lg md:text-xl text-stone-600 mt-2">
            Est. wait: <span className="font-semibold text-ink-900">{((selectedQueue.avgServiceTime || 5) + 2)} min</span>
          </p>
        )}
      </div>

      {/* Back button — only if multiple queues */}
      {queues.length > 1 && (
        <button
          onClick={() => setSelectedQueue(null)}
          className="absolute top-6 left-6 px-4 py-2 bg-white text-ink-700 rounded-xl text-sm font-bold border-2 border-cream-300 hover:border-honey-400 transition-colors"
        >
          ← Change queue
        </button>
      )}
    </div>
  );
}

export default DisplayScreen;
