import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { Plus, Calendar, MapPin, Trash2, QrCode } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, getDocs, doc, getDoc } from 'firebase/firestore';
import { getTheme } from '../utils/theme';
import { useQueueCustomers, customerName } from '../hooks/useQueueCustomers';

function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [artistName, setArtistName] = useState('');

  // Load artist profile
  useEffect(() => {
    if (!currentUser) return;
    const loadArtist = async () => {
      try {
        const artistDoc = await getDoc(doc(db, 'artists', currentUser.uid));
        if (artistDoc.exists()) {
          setArtistName(artistDoc.data().displayName || artistDoc.data().username);
        }
      } catch (error) {
        console.error('Error loading artist profile:', error);
      }
    };
    loadArtist();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    // Real-time listener for artist's events
    const eventsRef = collection(db, 'events');
    const q = query(
      eventsRef,
      where('artistId', '==', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const eventsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEvents(eventsData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Stable key so we only resubscribe when the set of events actually changes
  const eventIdsKey = events.map(e => e.id).sort().join(',');

  // Real-time listener for queues, so per-event counts reflect reality
  useEffect(() => {
    const eventIds = eventIdsKey ? eventIdsKey.split(',') : [];
    // Nothing to subscribe to. Any leftover queues are filtered out by event id at render.
    if (eventIds.length === 0) return;

    // Firestore 'in' queries accept at most 30 values, so subscribe in chunks
    const chunks = [];
    for (let i = 0; i < eventIds.length; i += 30) {
      chunks.push(eventIds.slice(i, i + 30));
    }

    const byChunk = new Map();
    const unsubscribes = chunks.map((chunk, index) =>
      onSnapshot(
        query(collection(db, 'queues'), where('eventId', 'in', chunk)),
        (snapshot) => {
          byChunk.set(index, snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          setQueues(Array.from(byChunk.values()).flat());
        }
      )
    );

    return () => unsubscribes.forEach(unsub => unsub());
  }, [eventIdsKey]);

  const openQueueIds = queues.filter(q => q.status === 'open').map(q => q.id);
  const { servingIn, waitingListFor, waitingFor } = useQueueCustomers(openQueueIds);

  const getEventQueues = (eventId) => queues.filter(q => q.eventId === eventId);

  // Open queues belonging to an active event — the "live now" set
  const liveQueues = queues
    .filter(q => q.status === 'open')
    .map(q => ({ queue: q, event: events.find(e => e.id === q.eventId) }))
    .filter(x => x.event && x.event.status === 'active');

  const hasLive = liveQueues.length > 0;

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const todayLabel = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric'
  });

  const handleDeleteEvent = async (e, event) => {
    e.stopPropagation();

    const eventQueues = getEventQueues(event.id);
    const cascade = eventQueues.length
      ? `\n\nThis also deletes ${eventQueues.length} queue${eventQueues.length === 1 ? '' : 's'} and everyone in them.`
      : '';
    if (!confirm(`Delete "${event.name}"?${cascade}\n\nThis cannot be undone.`)) return;

    try {
      // Delete all queues for this event
      const queuesSnapshot = await getDocs(
        query(collection(db, 'queues'), where('eventId', '==', event.id))
      );
      for (const queueDoc of queuesSnapshot.docs) {
        // Delete all customers in each queue
        const customersSnapshot = await getDocs(
          query(collection(db, 'customers'), where('queueId', '==', queueDoc.id))
        );
        for (const customerDoc of customersSnapshot.docs) {
          await deleteDoc(doc(db, 'customers', customerDoc.id));
        }
        await deleteDoc(doc(db, 'queues', queueDoc.id));
      }

      // Delete event
      await deleteDoc(doc(db, 'events', event.id));
      toast.success('Event deleted');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  const openEvent = (eventId) => navigate(`/event/${eventId}`);

  return (
    <div className="min-h-screen">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header: greeting + primary action */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-ink-900">
              {artistName ? `Welcome back, ${artistName}` : 'Dashboard'}
            </h1>
            <p className="text-sm text-stone-500 mt-0.5">{todayLabel}</p>
          </div>
          <button
            onClick={() => navigate('/create-event')}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-honey-500 text-ink-900 px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all shrink-0"
          >
            <Plus size={18} />
            Create Event
          </button>
        </div>

        {/* Live now */}
        {hasLive && (
          <section className="mb-8">
            <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
              Live now
            </h2>
            <div className="space-y-3">
              {liveQueues.map(({ queue, event }) => {
                const waitingList = waitingListFor(queue.id);
                // Derived from who is actually in the chair. queue.currentNumber keeps the
                // last number called even after that person is done or sent back to waiting.
                const serving = servingIn(queue.id);
                const nextUp = waitingList[0];

                return (
                  <div
                    key={queue.id}
                    className="bg-white rounded-2xl shadow-lg p-5 border-2 border-sage-300"
                  >
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-sm mb-1">
                          <span className="flex items-center gap-1.5 text-sage-600 font-semibold">
                            <span className="w-2 h-2 rounded-full bg-sage-1000 animate-pulse" />
                            live
                          </span>
                          <span className="text-stone-500 truncate">{event.name}</span>
                        </div>

                        <h3 className="text-xl font-bold text-ink-900">{queue.name}</h3>

                        <div className="flex items-baseline gap-6 mt-3">
                          <div>
                            <p className="text-xs text-stone-500">Now serving</p>
                            <p className="text-3xl font-bold text-ink-900">
                              {serving ? `#${serving.number}` : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-stone-500">Waiting</p>
                            <p className="text-3xl font-bold text-sage-500">
                              {waitingList.length}
                            </p>
                          </div>
                        </div>

                        <p className="text-sm text-stone-600 mt-3">
                          {nextUp ? (
                            <>
                              Next up:{' '}
                              <strong className="text-ink-900">
                                {customerName(nextUp) || `#${nextUp.number}`}
                              </strong>
                            </>
                          ) : (
                            'Nobody waiting'
                          )}
                        </p>
                      </div>

                      <button
                        onClick={() => navigate(`/queue/${queue.id}/manage`)}
                        className="w-full sm:w-auto bg-honey-500 text-ink-900 px-6 py-3 rounded-xl font-bold shadow-lg hover:shadow-xl transition-all"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Events */}
        <section>
          <h2 className="text-xs font-bold text-stone-500 uppercase tracking-wider mb-3">
            Your events
          </h2>

          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div>
              <p className="mt-4 text-stone-600">Loading your events...</p>
            </div>
          ) : events.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
              <div className="text-6xl mb-4">🎨</div>
              <h3 className="text-2xl font-bold text-ink-800 mb-2">No events yet</h3>
              <p className="text-stone-600 mb-6">
                Create your first event to start managing queues!
              </p>
              <button
                onClick={() => navigate('/create-event')}
                className="inline-flex items-center gap-2 bg-honey-500 text-ink-900 px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                <Plus size={20} />
                Create Event
              </button>
              <p className="text-sm text-stone-500 mt-6">
                Already set up?{' '}
                <button
                  onClick={() => navigate('/share')}
                  className="text-ink-900 font-semibold hover:text-honey-700 inline-flex items-center gap-1"
                >
                  <QrCode size={14} />
                  Get your links and QR codes
                </button>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {events.map((event) => {
                const eventQueues = getEventQueues(event.id);
                const openQueues = eventQueues.filter(q => q.status === 'open');
                const waiting = eventQueues.reduce((sum, q) => sum + waitingFor(q), 0);
                const served = eventQueues.reduce((sum, q) => sum + (q.totalServed || 0), 0);

                return (
                  <div
                    key={event.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openEvent(event.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        openEvent(event.id);
                      }
                    }}
                    className={`bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer border-2 border-transparent focus:outline-none focus:ring-2 focus:ring-honey-400 ${getTheme(event.colorTheme).hoverBorder}`}
                  >
                    {/* Event header */}
                    <div className="flex items-start justify-between gap-2 mb-4">
                      <h3 className="text-xl font-bold text-ink-800 flex-1 min-w-0">
                        {event.name}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
                        event.status === 'active'
                          ? 'bg-sage-100 text-sage-600'
                          : event.status === 'completed'
                          ? 'bg-cream-200 text-ink-700'
                          : 'bg-red-100 text-red-700'
                      }`}>
                        {event.status || 'active'}
                      </span>
                    </div>

                    {/* Event details */}
                    <div className="space-y-2 text-sm text-stone-600">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-honey-600" />
                        <span>{formatDate(event.date)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin size={16} className="text-honey-600" />
                        <span className="truncate">{event.location?.address || 'No location'}</span>
                      </div>
                    </div>

                    {/* Live state, counted from queues and customers */}
                    <div className="mt-4 pt-4 border-t border-cream-200">
                      <div className="flex items-baseline gap-5">
                        <p>
                          <span className="text-2xl font-bold text-sage-500">{waiting}</span>
                          <span className="text-sm text-stone-600 ml-1.5">waiting</span>
                        </p>
                        <p>
                          <span className="text-2xl font-bold text-ink-700">{served}</span>
                          <span className="text-sm text-stone-600 ml-1.5">served</span>
                        </p>
                      </div>

                      {eventQueues.length === 0 ? (
                        <p className="text-xs text-stone-400 mt-2">No queues yet</p>
                      ) : openQueues.length > 0 ? (
                        <p className="text-xs text-stone-500 mt-2 truncate">
                          {openQueues
                            .map(q => {
                              const inChair = servingIn(q.id);
                              return `${q.name} — ${inChair ? `on #${inChair.number}` : 'open'}`;
                            })
                            .join(' · ')}
                        </p>
                      ) : (
                        <p className="text-xs text-stone-400 mt-2">
                          {eventQueues.length} queue{eventQueues.length === 1 ? '' : 's'}, none open
                        </p>
                      )}
                    </div>

                    {/* Theme bar + delete, kept away from the status badge */}
                    <div className="mt-4 flex items-center gap-3">
                      <div className={`h-2 flex-1 rounded-full ${getTheme(event.colorTheme).accent}`} />
                      <button
                        onClick={(e) => handleDeleteEvent(e, event)}
                        className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title={`Delete ${event.name}`}
                        aria-label={`Delete event ${event.name}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
