import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { doc, getDoc, onSnapshot, updateDoc, collection, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { BuzzMark, Mascot, QueueFigures } from '../components/BuzzBrand';
import ThemeToggle from '../components/ThemeToggle';

function CustomerView() {
  const { customerId } = useParams();
  const navigate = useNavigate();

  const [customer, setCustomer] = useState(null);
  const [groupTurns, setGroupTurns] = useState([]);
  const [queueMap, setQueueMap] = useState({});
  const [peers, setPeers] = useState([]);
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  // The turn named in the URL
  useEffect(() => {
    if (!customerId) return;

    const unsubscribe = onSnapshot(doc(db, 'customers', customerId), (snapshot) => {
      if (!snapshot.exists()) {
        toast.error('Turn not found');
        setLoading(false);
        return;
      }
      setCustomer({ id: snapshot.id, ...snapshot.data() });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [customerId]);

  // Everyone who joined together in one go shares a joinGroupId
  useEffect(() => {
    const groupId = customer?.joinGroupId;
    if (!groupId) return;

    const unsubscribe = onSnapshot(
      query(collection(db, 'customers'), where('joinGroupId', '==', groupId)),
      (snapshot) => setGroupTurns(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))),
      (error) => console.error('Error loading your other turns:', error)
    );

    return () => unsubscribe();
  }, [customer?.joinGroupId]);

  // Derived, never stored — avoids a second render pass just to fall back
  const turns = !customer
    ? []
    : customer.joinGroupId && groupTurns.length
    ? [...groupTurns].sort((a, b) => (a.queueId || '').localeCompare(b.queueId || ''))
    : [customer];

  const queueIdsKey = [...new Set(turns.map(t => t.queueId))].sort().join(',');

  // Live queue docs for every line this person is in
  useEffect(() => {
    const ids = queueIdsKey ? queueIdsKey.split(',') : [];
    if (ids.length === 0) return;

    const unsubscribes = ids.map(id =>
      onSnapshot(doc(db, 'queues', id), (snapshot) => {
        if (snapshot.exists()) {
          setQueueMap(prev => ({ ...prev, [id]: { id: snapshot.id, ...snapshot.data() } }));
        }
      })
    );

    return () => unsubscribes.forEach(unsub => unsub());
  }, [queueIdsKey]);

  // Everyone else in those lines, so we can count who's ahead
  useEffect(() => {
    const ids = queueIdsKey ? queueIdsKey.split(',') : [];
    if (ids.length === 0) return;

    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) chunks.push(ids.slice(i, i + 30));

    const byChunk = new Map();
    const unsubscribes = chunks.map((chunk, index) =>
      onSnapshot(
        query(collection(db, 'customers'), where('queueId', 'in', chunk)),
        (snapshot) => {
          byChunk.set(index, snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          setPeers(Array.from(byChunk.values()).flat());
        },
        (error) => console.error('Error loading line positions:', error)
      )
    );

    return () => unsubscribes.forEach(unsub => unsub());
  }, [queueIdsKey]);

  // Event details, for the name on screen
  useEffect(() => {
    const eventId = customer?.eventId;
    if (!eventId) return;

    getDoc(doc(db, 'events', eventId))
      .then(snap => {
        if (snap.exists()) setEvent({ id: snap.id, ...snap.data() });
      })
      .catch(error => console.error('Error loading event:', error));
  }, [customer?.eventId]);

  const aheadOf = (turn) =>
    peers.filter(
      c => c.queueId === turn.queueId && c.status === 'waiting' && c.number < turn.number
    ).length;

  const waitFor = (turn) => {
    const ahead = aheadOf(turn);
    if (!ahead) return 'Any moment';
    const avg = queueMap[turn.queueId]?.avgServiceTime || 5;
    return `${ahead * avg + 2} min`;
  };

  const queueName = (turn) => queueMap[turn.queueId]?.name || 'this line';

  const respond = async (turn, response) => {
    try {
      if (response === 'coming') {
        await updateDoc(doc(db, 'customers', turn.id), {
          status: 'coming',
          response: 'coming',
          respondedAt: new Date()
        });
        toast.success("Great — we'll see you soon!");
      } else if (confirm(`Leave the ${queueName(turn)} line?`)) {
        await updateDoc(doc(db, 'customers', turn.id), {
          status: 'skipped',
          response: 'skipped',
          respondedAt: new Date()
        });
        toast.success('Taken out of that line.');
      }
    } catch (error) {
      console.error('Error updating response:', error);
      toast.error('Failed to update. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-honey-500"></div>
          <p className="mt-4 text-stone-600">Finding your place in line...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <Mascot className="w-32 h-auto mx-auto mb-4" />
          <h1 className="text-2xl font-extrabold text-ink-900 mb-2">Not found</h1>
          <p className="text-stone-600">This spot in line doesn&apos;t exist any more.</p>
        </div>
      </div>
    );
  }

  const name = customer.name || customer.childName || customer.parentName;
  const live = turns.filter(t => t.status !== 'completed' && t.status !== 'skipped');
  const called = live.filter(t => t.status === 'called');
  const header = (
    <header className="px-6 pt-6 flex items-center justify-center gap-2">
      <BuzzMark size={26} textClass="text-lg" className="text-ink-900" />
      <ThemeToggle />
    </header>
  );

  // ---- Nothing left in any line ------------------------------------------
  if (live.length === 0) {
    const allDone = turns.every(t => t.status === 'completed');
    return (
      <div className="min-h-screen bg-cream-100 flex flex-col items-center justify-center p-6 text-center">
        <Mascot className="w-40 h-auto mb-2" />
        <h1 className="text-3xl font-extrabold text-ink-900 mb-2">
          {allDone ? 'All done!' : 'See you next time!'}
        </h1>
        <p className="text-stone-600 mb-8">
          {allDone
            ? `Thanks for visiting ${event?.name || 'us'}.`
            : 'You can hop back in whenever you like.'}
        </p>
        {event && (
          <button
            onClick={() => navigate(`/join/${event.id}`)}
            className="bg-honey-500 text-ink-900 px-7 py-4 rounded-2xl font-extrabold hover:bg-honey-600 transition-colors shadow-lg"
          >
            Join a line again
          </button>
        )}
      </div>
    );
  }

  // ---- Single line: the full-screen status view ---------------------------
  if (turns.length === 1) {
    const turn = live[0];
    const ahead = aheadOf(turn);
    const isCalled = turn.status === 'called';
    const isComing = turn.status === 'coming';

    if (isCalled || isComing) {
      return (
        <div className="min-h-screen bg-cream-100 flex flex-col">
          {header}
          <main className="flex-1 flex flex-col items-center justify-center px-6 text-center">
            <div className="w-full max-w-sm bg-honey-400 rounded-[2rem] px-6 py-10 shadow-lg">
              <p className="text-sm font-bold uppercase tracking-[0.15em] text-honey-700 mb-2">
                {isComing ? "You're on your way" : "It's your turn"}
              </p>
              <p className="text-6xl font-black text-ink-900 leading-none mb-3">{turn.number}</p>
              {name && <p className="text-lg font-bold text-ink-900">{name}</p>}
              <p className="text-ink-700 mt-2">Come on over to {queueName(turn)}</p>
            </div>

            <Mascot className="w-36 h-auto mt-6" />

            {isComing ? (
              <p className="mt-2 text-sage-600 font-bold">✓ We know you&apos;re coming</p>
            ) : (
              <div className="w-full max-w-sm mt-4 space-y-3">
                <button
                  onClick={() => respond(turn, 'coming')}
                  className="w-full bg-sage-400 text-ink-900 py-4 rounded-2xl font-extrabold hover:bg-sage-500 transition-colors"
                >
                  I&apos;ll be right there
                </button>
                <button
                  onClick={() => respond(turn, 'skip')}
                  className="w-full bg-white text-ink-700 py-4 rounded-2xl font-bold border-2 border-cream-300 hover:border-stone-400 transition-colors"
                >
                  I can&apos;t make it
                </button>
              </div>
            )}
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-cream-100 flex flex-col">
        {header}
        <main className="flex-1 flex flex-col items-center px-6 pt-8 pb-6 text-center">
          <h1 className="text-3xl font-extrabold text-ink-900">You&apos;re in line!</h1>
          <p className="text-stone-500 mt-1">Thank you for waiting.</p>

          <div className="w-full max-w-sm border-t border-cream-300 mt-6 pt-8">
            <p className="text-stone-500">Your number</p>
            <p className="text-[5.5rem] leading-none font-black text-sage-400 my-2">
              {turn.number}
            </p>

            <p className="text-stone-500 mt-6">Estimated wait time</p>
            <p className="text-2xl font-extrabold text-ink-900 mt-1">{waitFor(turn)}</p>

            <p className="text-sm text-stone-500 mt-6">
              {ahead === 0 ? (
                <>You&apos;re next — stay close by</>
              ) : (
                <>
                  <strong className="text-ink-900">{ahead}</strong>{' '}
                  {ahead === 1 ? 'person' : 'people'} ahead of you
                </>
              )}
            </p>
          </div>

          <div className="flex-1" />

          <div className="w-full max-w-sm flex items-end justify-center gap-3 mt-8">
            <QueueFigures count={ahead} />
            <Mascot className="w-24 h-auto" />
          </div>

          <div className="w-full max-w-sm mt-6 space-y-2">
            <p className="text-xs text-stone-500">
              Keep this page open — it updates by itself.
            </p>
            <button
              onClick={() => respond(turn, 'skip')}
              className="w-full py-3 text-stone-600 font-semibold hover:text-ink-900 transition-colors"
            >
              Can&apos;t make it? Leave the line
            </button>
          </div>
        </main>
      </div>
    );
  }

  // ---- Several lines: one card each ---------------------------------------
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col">
      {header}

      <main className="flex-1 w-full max-w-md mx-auto px-5 pt-6 pb-8">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-ink-900">
            {called.length > 0 ? "It's your turn!" : "You're in line!"}
          </h1>
          <p className="text-stone-500 mt-1">
            {called.length > 0
              ? `${queueName(called[0])} is ready for you`
              : `${live.length} lines · thank you for waiting.`}
          </p>
        </div>

        <div className="space-y-4">
          {live.map(turn => {
            const ahead = aheadOf(turn);
            const isCalled = turn.status === 'called';
            const isComing = turn.status === 'coming';

            return (
              <div
                key={turn.id}
                className={`rounded-[1.75rem] p-5 shadow-sm border-[3px] ${
                  isCalled
                    ? 'bg-honey-400 border-honey-500'
                    : isComing
                    ? 'bg-sage-100 border-sage-300'
                    : 'bg-white border-cream-300'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-extrabold text-ink-900 truncate">{queueName(turn)}</p>
                    <p className="text-sm mt-0.5 text-stone-600">
                      {isCalled
                        ? 'Ready for you now'
                        : isComing
                        ? "You said you're coming"
                        : ahead === 0
                        ? "You're next"
                        : `${ahead} ${ahead === 1 ? 'person' : 'people'} ahead · ${waitFor(turn)}`}
                    </p>
                  </div>
                  <p
                    className={`text-5xl font-black leading-none shrink-0 ${
                      isCalled ? 'text-ink-900' : 'text-sage-400'
                    }`}
                  >
                    {turn.number}
                  </p>
                </div>

                {isCalled && (
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <button
                      onClick={() => respond(turn, 'coming')}
                      className="bg-ink-900 text-white py-3 rounded-xl font-extrabold hover:bg-ink-700 transition-colors"
                    >
                      On my way
                    </button>
                    <button
                      onClick={() => respond(turn, 'skip')}
                      className="bg-white text-ink-700 py-3 rounded-xl font-bold border-2 border-cream-300 hover:border-stone-400 transition-colors"
                    >
                      Can&apos;t make it
                    </button>
                  </div>
                )}

                {!isCalled && !isComing && (
                  <button
                    onClick={() => respond(turn, 'skip')}
                    className="text-sm text-stone-500 font-semibold hover:text-ink-900 transition-colors mt-3"
                  >
                    Leave this line
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-end justify-center mt-8">
          <Mascot className="w-28 h-auto" />
        </div>
        <p className="text-xs text-stone-500 text-center mt-2">
          Keep this page open — it updates by itself.
        </p>
      </main>
    </div>
  );
}

export default CustomerView;
