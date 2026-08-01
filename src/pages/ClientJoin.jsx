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
import { Users, ArrowLeft, CheckCircle, Check, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTheme } from '../utils/theme';
import TurnChoice from '../components/TurnChoice';
import { Mascot } from '../components/BuzzBrand';

function ClientJoin() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [event, setEvent] = useState(null);
  const [queues, setQueues] = useState([]);
  // Clients may take a number in several lines at once
  const [selectedIds, setSelectedIds] = useState([]);
  const [linesConfirmed, setLinesConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null); // { turns: [{ id, number, queueName }] }
  // Arrivals from the kiosk/artist page already picked "Get a turn" there;
  // a direct QR scan hasn't been asked yet.
  const [askedChoice, setAskedChoice] = useState(!!location.state?.artistUsername);
  
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

    const chosen = chosenQueues;
    if (chosen.length === 0) {
      toast.error('Please choose at least one line');
      return;
    }

    setSubmitting(true);

    try {
      // Ties this person's turns together so their status page can show them all
      const joinGroupId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const turns = [];

      for (const queue of chosen) {
        const nextNumber = await getNextNumber(queue.id);

        const docRef = await addDoc(collection(db, 'customers'), {
          queueId: queue.id,
          eventId: eventId,
          number: nextNumber,
          name: formData.name,
          phone: formData.phone,
          status: 'waiting',
          response: null,
          joinGroupId,
          joinedAt: serverTimestamp()
        });

        await updateDoc(doc(db, 'queues', queue.id), {
          waitingCount: (queue.waitingCount || 0) + 1
        });

        turns.push({ id: docRef.id, number: nextNumber, queueName: queue.name });
      }

      // No event write here on purpose. Clients are unauthenticated and the rules
      // only let the owning artist update an event, so this always threw for real
      // clients — and because it ran after the customer document was created,
      // people were told "failed to join" while already in the line, then retried
      // and took extra numbers. Nothing reads the counter now: EventDetails
      // counts customer documents instead.

      setSuccess({ turns });
      const docRef = { id: turns[0].id };

      // Kiosk mode (came from ArtistProfile with kiosk flag): redirect back after 3s
      // Phone mode (direct link): go to CustomerView to track turn
      const isKiosk = !!location.state?.kiosk;
      setTimeout(() => {
        if (isKiosk) {
          navigate(`/artist/${location.state.artistUsername}?kiosk=1`, { state: { returnToChoice: true } });
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
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div>
          <p className="mt-4 text-stone-600">Loading event...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-ink-900 mb-2">Event Not Found</h1>
          <p className="text-stone-600">This event may have been closed or removed.</p>
        </div>
      </div>
    );
  }

  const theme = getTheme(event.colorTheme);

  // Choice screen — only for people who landed here directly
  if (!askedChoice && !success) {
    return (
      <TurnChoice
        title={event.name}
        subtitle="What would you like to do?"
        onGetTurn={() => setAskedChoice(true)}
        onFindTurn={() => navigate(`/event/${eventId}/find`, {
          state: { returnTo: `/join/${eventId}` }
        })}
      />
    );
  }

  // Success screen — shown for 3 seconds after joining
  if (success) {
    return (
      <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center p-6 text-center">
        <CheckCircle size={56} className="text-sage-500 mb-4" />

        {success.turns.length === 1 ? (
          <>
            <p className="text-stone-600 text-lg">Your number is</p>
            <h1 className="text-7xl sm:text-8xl font-black text-sage-400 my-2">
              {success.turns[0].number}
            </h1>
          </>
        ) : (
          <>
            <p className="text-stone-600 text-lg mb-4">
              You&apos;re in {success.turns.length} lines
            </p>
            <div className="w-full max-w-xs space-y-3">
              {success.turns.map(turn => (
                <div
                  key={turn.id}
                  className="bg-white rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm"
                >
                  <span className="font-bold text-ink-900 truncate">{turn.queueName}</span>
                  <span className="text-3xl font-black text-sage-400 shrink-0">
                    {turn.number}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <p className="text-2xl text-ink-900 font-extrabold mt-4">You&apos;re in line!</p>
        <Mascot className="w-28 h-auto mt-4" />
      </div>
    );
  }

  // One line means there's nothing to choose
  const chosenQueues =
    queues.length === 1 ? queues : queues.filter(q => selectedIds.includes(q.id));
  const showForm = queues.length === 1 || linesConfirmed;

  const toggleQueue = (id) =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const handleBack = () => {
    if (location.state?.kiosk && location.state?.artistUsername) {
      navigate(`/artist/${location.state.artistUsername}`, { state: { returnToChoice: true } });
    } else {
      navigate(-1);
    }
  };

  return (
    <div className={`min-h-screen bg-cream-100 pb-10`}>
      {/* Header with back button */}
      <header className="bg-white shadow-sm border-b border-cream-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button
            onClick={handleBack}
            className="text-stone-600 hover:text-ink-900 transition-colors"
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className={`text-lg font-bold ${theme.text}`}>
            {event.name}
          </h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Line selection — pick one, or several to hold a spot in each */}
        {!showForm ? (
          <div className="space-y-4">
            {queues.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <p className="text-stone-600">No lines are open at the moment.</p>
              </div>
            ) : (
              <>
                <div className="mb-5">
                  <h2 className="text-2xl font-extrabold text-ink-900">Which line?</h2>
                  <p className="text-stone-600 mt-1">
                    Pick one, or choose several to get a number in each.
                  </p>
                </div>

                {queues.map((queue) => {
                  const picked = selectedIds.includes(queue.id);
                  return (
                    <button
                      key={queue.id}
                      onClick={() => toggleQueue(queue.id)}
                      aria-pressed={picked}
                      className={`w-full rounded-2xl p-5 text-left transition-colors border-[3px] ${
                        picked
                          ? 'bg-honey-100 border-honey-500'
                          : 'bg-white border-cream-300 hover:border-honey-400'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <span
                          className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center border-2 ${
                            picked
                              ? 'bg-honey-500 border-honey-500'
                              : 'bg-white border-stone-300'
                          }`}
                        >
                          {picked && <Check size={20} className="text-ink-900" strokeWidth={3} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="text-xl font-extrabold text-ink-900 truncate">
                            {queue.name}
                          </h3>
                          <div className="flex items-center gap-2 text-sm text-stone-600 mt-0.5">
                            <Users size={16} />
                            <span>
                              {queue.waitingCount || 0}{' '}
                              {(queue.waitingCount || 0) === 1 ? 'person' : 'people'} waiting
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}

                <button
                  onClick={() => setLinesConfirmed(true)}
                  disabled={selectedIds.length === 0}
                  className="w-full bg-honey-500 text-ink-900 py-4 rounded-2xl font-extrabold text-lg shadow-lg hover:bg-honey-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {selectedIds.length === 0
                    ? 'Choose a line to continue'
                    : selectedIds.length === 1
                    ? 'Continue'
                    : `Continue with ${selectedIds.length} lines`}
                </button>
              </>
            )}
          </div>
        ) : (
          /* Join form — one name and phone covers every chosen line */
          <>
            <div className="mb-5">
              <h2 className="text-2xl font-extrabold text-ink-900">Get in line</h2>
              <p className="text-stone-600 mt-1">
                Add your name and we&apos;ll save your spot.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            {queues.length > 1 && (
              <div className="mb-5 pb-5 border-b border-cream-200">
                <p className="text-sm text-stone-600 mb-1">Getting a number in</p>
                <p className="font-extrabold text-ink-900">
                  {chosenQueues.map(q => q.name).join(' · ')}
                </p>
                <button
                  type="button"
                  onClick={() => setLinesConfirmed(false)}
                  className="text-sm font-bold text-honey-700 hover:text-ink-900 transition-colors mt-1"
                >
                  Change lines
                </button>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-cream-200 rounded-lg focus:border-honey-500 focus:outline-none transition-colors text-lg"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ink-700 mb-2">
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border-2 border-cream-200 rounded-lg focus:border-honey-500 focus:outline-none transition-colors text-lg"
                  placeholder="555-0123"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className={`w-full bg-honey-500 text-ink-900 py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-50`}
              >
                {submitting ? 'Joining...' : chosenQueues.length > 1 ? `Get my ${chosenQueues.length} numbers` : 'Get my turn'}
              </button>
              </form>
            </div>

            {/* People who already took a number often re-scan the code to check
                it — without this they take a second number instead. */}
            <button
              type="button"
              onClick={() =>
                navigate(`/event/${eventId}/find`, {
                  state: {
                    artistUsername: location.state?.artistUsername,
                    kiosk: location.state?.kiosk
                  }
                })
              }
              className="w-full mt-5 py-4 rounded-2xl font-bold text-lg bg-white border-[3px] border-cream-300
                         text-ink-900 hover:border-sage-400 active:border-sage-400 transition-colors
                         flex items-center justify-center gap-2"
            >
              <Search size={20} className="text-sage-500" />
              I already have a turn
            </button>
          </>
        )}
      </main>
    </div>
  );
}

export default ClientJoin;