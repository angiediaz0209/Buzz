import { useState, useEffect } from 'react';
import TurnChoice from '../components/TurnChoice';
import { Mascot } from '../components/BuzzBrand';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import {
  doc,
  getDoc,
  collection,
  query,
  where,
  addDoc,
  serverTimestamp,
  onSnapshot,
  runTransaction,
  increment
} from 'firebase/firestore';
import { Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { getTheme } from '../utils/theme';

const RESET_SECONDS = 10;

function Kiosk() {
  const { eventId, queueId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState('choice'); // choice | select | form | success
  const [countdown, setCountdown] = useState(RESET_SECONDS);
  const [assignedNumber, setAssignedNumber] = useState(null);
  // Kiosk users can take a number in several lines in one go
  const [selectedIds, setSelectedIds] = useState([]);
  const [assignedTurns, setAssignedTurns] = useState([]);

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

    // The queues listener only needs eventId, which comes from the URL — it was
    // waiting on the event document for no reason, costing the kiosk a round
    // trip before it could show anything. Fired first, in parallel.
    let unsubQueues;
    if (!queueId) {
      const q = query(
        collection(db, 'queues'),
        where('eventId', '==', eventId),
        where('isVisible', '==', true),
        where('status', '==', 'open')
      );
      unsubQueues = onSnapshot(q, (snapshot) => {
        setQueues(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      });
    }

    const loadData = async () => {
      try {
        const eventDoc = await getDoc(doc(db, 'events', eventId));
        if (!eventDoc.exists()) {
          setLoading(false);
          return;
        }
        setEvent({ id: eventDoc.id, ...eventDoc.data() });

        // A kiosk pinned to one specific line still needs that document.
        if (queueId) {
          const queueDoc = await getDoc(doc(db, 'queues', queueId));
          if (queueDoc.exists()) {
            setQueues([{ id: queueDoc.id, ...queueDoc.data() }]);
          }
          setLoading(false);
        }
      } catch (error) {
        console.error('Error loading data:', error);
        setLoading(false);
      }
    };

    loadData();

    // The previous version returned this cleanup from inside an async function,
    // which React never receives — so the queues listener was never torn down.
    return () => unsubQueues?.();
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
    setAssignedTurns([]);
    setSelectedIds([]);

    // Back to the two-option screen — the kiosk's resting state
    setStep('choice');
  };

  // One transaction per line, mirroring ClientJoin. Was four sequential round
  // trips per line (transaction, addDoc, updateDoc) awaited line by line; now
  // the customer document is written inside the transaction that already reads
  // the queue, using a locally generated ref that costs no round trip.
  // waitingCount uses increment() so simultaneous joins can't overwrite each
  // other's count.
  const joinOneLine = async (queue, joinGroupId) => {
    const queueRef = doc(db, 'queues', queue.id);
    const customerRef = doc(collection(db, 'customers'));

    const number = await runTransaction(db, async (transaction) => {
      const queueSnap = await transaction.get(queueRef);
      const next = (queueSnap.data().lastNumber || 0) + 1;

      transaction.update(queueRef, {
        lastNumber: next,
        waitingCount: increment(1)
      });

      transaction.set(customerRef, {
        queueId: queue.id,
        eventId,
        number: next,
        childName: formData.isChild ? formData.childName : '',
        parentName: formData.parentName || '',
        isChild: formData.isChild,
        phone: formData.phone || '',
        email: '',
        notificationMethod: 'screen',
        status: 'waiting',
        response: null,
        joinGroupId,
        joinedAt: serverTimestamp(),
        isKiosk: true
      });

      return next;
    });

    return { number, queueName: queue.name };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const chosen = chosenQueues;
    if (chosen.length === 0) return;

    setSubmitting(true);

    try {
      // Links this person's turns so their status page can show them together
      const joinGroupId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

      // All chosen lines at once rather than one after another.
      const turns = await Promise.all(
        chosen.map(queue => joinOneLine(queue, joinGroupId))
      );

      // Save to contacts if consent given — deliberately NOT awaited. This is
      // best-effort marketing capture, and awaiting it put a whole extra round
      // trip between the person finishing the form and seeing their number.
      if (formData.marketingConsent && formData.phone) {
        addDoc(collection(db, 'contacts'), {
          parentName: formData.parentName || formData.childName,
          phone: formData.phone || '',
          email: '',
          // The artist running the line they joined — not the event's host, who
          // may be a different artist entirely once guest lines are in play.
          artistId: chosen[0]?.artistId || event.artistId,
          eventId: eventId,
          eventType: event.eventType || 'other',
          consentDate: serverTimestamp(),
          consentText: "Yes! Notify me about future events from this artist and Buzz.",
          source: 'kiosk'
        }).catch(() => {
          // consent capture failed; the join itself has already succeeded
        });
      }
  
      // No event write here on purpose. Clients are unauthenticated and the rules
      // only let the owning artist update an event, so this always threw for real
      // clients — and because it ran after the customer document was created,
      // people were told "failed to join" while already in the line, then retried
      // and took extra numbers. Nothing reads the counter now: EventDetails
      // counts customer documents instead.

      setAssignedTurns(turns);
      setAssignedNumber(turns[0].number);
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

  // One line (or a pinned queueId) means there's nothing to choose
  const chosenQueues =
    queueId || queues.length === 1
      ? queues
      : queues.filter(q => selectedIds.includes(q.id));

  const toggleQueue = (id) =>
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-16 w-16 border-b-4 border-honey-500"></div>
          <p className="mt-4 text-2xl text-stone-600">Loading...</p>
        </div>
      </div>
    );
  }

  const theme = getTheme(event?.colorTheme);

  // SUCCESS SCREEN
  if (step === 'success') {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4 sm:p-8">
        <div className="text-center w-full max-w-xl">
          <Mascot className="w-28 sm:w-36 h-auto mx-auto mb-2" />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-ink-900 mb-4 sm:mb-6">You&apos;re in!</h1>

          {assignedTurns.length <= 1 ? (
            <>
              <p className="text-xl text-stone-600 mb-2">Your number is</p>
              <div className="text-[5rem] sm:text-[7rem] leading-none font-black text-sage-400 mb-4">
                {assignedNumber}
              </div>
              {assignedTurns[0] && (
                <p className="text-xl text-ink-900 font-bold mb-6">
                  {assignedTurns[0].queueName}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-xl text-stone-600 mb-4">
                You have {assignedTurns.length} numbers
              </p>
              <div className="space-y-3 mb-6">
                {assignedTurns.map(turn => (
                  <div
                    key={turn.queueName}
                    className="bg-white rounded-2xl px-6 py-4 flex items-center justify-between gap-4 shadow-sm"
                  >
                    <span className="text-xl font-extrabold text-ink-900 truncate">
                      {turn.queueName}
                    </span>
                    <span className="text-4xl font-black text-sage-400 shrink-0">
                      {turn.number}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          <p className="text-lg text-stone-600 mb-8">
            Watch the display screen for your number.
          </p>

          <div className="bg-white rounded-2xl p-6 border-2 border-cream-300">
            <p className="text-stone-600 mb-1">Next person in</p>
            <div className="text-5xl font-black text-ink-900">{countdown}</div>
          </div>

          <button
            onClick={handleReset}
            className="mt-8 bg-honey-500 text-ink-900 px-8 py-4 rounded-2xl font-extrabold text-lg hover:bg-honey-600 transition-colors shadow-lg"
          >
            Next person →
          </button>
        </div>
      </div>
    );
  }

  // CHOICE SCREEN — the kiosk's resting state
  if (step === 'choice') {
    return (
      <TurnChoice
        title={event?.name}
        subtitle="What would you like to do?"
        onGetTurn={() => setStep(queueId || queues.length === 1 ? 'form' : 'select')}
        onFindTurn={() => navigate(`/event/${eventId}/find`, {
          state: { returnTo: `/kiosk/${eventId}` }
        })}
      />
    );
  }

  // QUEUE SELECTION SCREEN
  if (step === 'select') {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-6 sm:mb-10">
            <h1 className="text-3xl sm:text-5xl font-extrabold text-ink-900 mb-2">
              Choose a line
            </h1>
            <p className="text-base sm:text-2xl text-stone-600">
              Tap one, or several to get a number in each
            </p>
          </div>

          <div className="space-y-4">
            {queues.map((queue) => {
              const picked = selectedIds.includes(queue.id);
              return (
                <button
                  key={queue.id}
                  onClick={() => toggleQueue(queue.id)}
                  aria-pressed={picked}
                  className={`w-full rounded-2xl p-4 sm:p-8 text-left transition-colors border-[3px] ${
                    picked
                      ? 'bg-honey-100 border-honey-500'
                      : 'bg-white border-cream-300 hover:border-honey-400'
                  }`}
                >
                  <div className="flex items-center gap-3 sm:gap-5">
                    <span
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl shrink-0 flex items-center justify-center border-[3px] ${
                        picked ? 'bg-honey-500 border-honey-500' : 'bg-white border-stone-300'
                      }`}
                    >
                      {picked && (
                        <Check className="text-ink-900 w-6 h-6 sm:w-7 sm:h-7" strokeWidth={3} />
                      )}
                    </span>

                    <div className="min-w-0 flex-1">
                      <h2 className="text-xl sm:text-3xl font-extrabold text-ink-900 leading-tight">
                        {queue.name}
                      </h2>
                      <p className="text-sm sm:text-xl text-stone-600 mt-0.5 sm:mt-1">
                        {queue.waitingCount || 0}{' '}
                        {(queue.waitingCount || 0) === 1 ? 'person' : 'people'} waiting
                        {/* On phones the separate column below is hidden, so show it here */}
                        <span className="sm:hidden">
                          {' · now serving '}
                          {queue.currentNumber || '—'}
                        </span>
                      </p>
                    </div>

                    <div className="hidden sm:block text-right shrink-0">
                      <p className="text-stone-500 text-base">Now serving</p>
                      <p className="text-5xl font-black text-sage-400">
                        {queue.currentNumber || '—'}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              onClick={() => setStep('form')}
              disabled={selectedIds.length === 0}
              className="w-full bg-honey-500 text-ink-900 py-4 sm:py-5 rounded-2xl font-extrabold text-lg sm:text-2xl shadow-lg hover:bg-honey-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {selectedIds.length === 0
                ? 'Tap a line to continue'
                : selectedIds.length === 1
                ? 'Continue'
                : `Continue with ${selectedIds.length} lines`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // FORM SCREEN
  return (
    <div className="min-h-screen bg-cream-100 flex items-center justify-center p-4 sm:p-8">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-5 sm:mb-8">
          <h1 className={`text-2xl sm:text-4xl font-extrabold ${theme.text} mb-2`}>
            Join {chosenQueues.map(q => q.name).join(' + ') || 'the line'}
          </h1>
          <p className="text-base sm:text-xl text-stone-600">Enter your info below</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-5 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            {/* Name */}
            <div>
              <label className="block text-base sm:text-xl font-semibold text-ink-700 mb-2 sm:mb-3">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="childName"
                value={formData.childName}
                onChange={handleChange}
                required
                className="w-full px-4 sm:px-6 py-3.5 sm:py-4 text-lg sm:text-xl border-2 border-cream-200 rounded-xl focus:border-honey-500 focus:outline-none transition-colors"
                placeholder="Enter name"
              />
            </div>

            {/* Is Child */}
            <div className="bg-cream-50 rounded-xl p-5 border-2 border-cream-300">
              <label className="flex items-center gap-4 cursor-pointer">
                <input
                  type="checkbox"
                  name="isChild"
                  checked={formData.isChild}
                  onChange={handleChange}
                  className="w-6 h-6 sm:w-7 sm:h-7 shrink-0 accent-honey-500 rounded"
                />
                <span className="text-base sm:text-xl font-semibold text-ink-900">
                  This is a child's name
                </span>
              </label>
            </div>

            {/* Parent Name */}
            {formData.isChild && (
              <div>
                <label className="block text-base sm:text-xl font-semibold text-ink-700 mb-2 sm:mb-3">
                  Parent/Guardian Name
                </label>
                <input
                  type="text"
                  name="parentName"
                  value={formData.parentName}
                  onChange={handleChange}
                  className="w-full px-4 sm:px-6 py-3.5 sm:py-4 text-lg sm:text-xl border-2 border-cream-200 rounded-xl focus:border-honey-500 focus:outline-none transition-colors"
                  placeholder="Parent's name (optional)"
                />
              </div>
            )}

            {/* Phone */}
            <div>
              <label className="block text-base sm:text-xl font-semibold text-ink-700 mb-2 sm:mb-3">
                Phone Number (Optional)
              </label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className="w-full px-4 sm:px-6 py-3.5 sm:py-4 text-lg sm:text-xl border-2 border-cream-200 rounded-xl focus:border-honey-500 focus:outline-none transition-colors"
                placeholder="For notifications (optional)"
              />
            </div>


            {/* Marketing Consent */}
            <div className="bg-cream-50 rounded-xl p-5 border-2 border-cream-300">
            <label className="flex items-start gap-4 cursor-pointer">
                <input
                type="checkbox"
                name="marketingConsent"
                checked={formData.marketingConsent}
                onChange={handleChange}
                className="mt-1 w-6 h-6 sm:w-7 sm:h-7 shrink-0 accent-honey-500 rounded"
                />
                <div>
                <p className="text-xl font-semibold text-ink-900">
                    Hear about future events!
                </p>
                <p className="text-base text-stone-600 mt-1">
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
              className={`w-full bg-honey-500 text-ink-900 py-6 rounded-xl font-bold text-2xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50`}
            >
              {submitting ? 'Joining...' : chosenQueues.length > 1 ? `Get my ${chosenQueues.length} numbers` : 'Get my number'}
            </button>
          </form>
        </div>

        {/* Back button (only if multiple queues) */}
        {queues.length > 1 && (
          <button
            onClick={() => {
              setStep('select');
            }}
            className="w-full mt-4 py-4 text-stone-600 font-medium text-lg"
          >
            ← Choose Different Queue
          </button>
        )}
      </div>
    </div>
  );
}

export default Kiosk;