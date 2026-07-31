import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { LogOut, Home, Users, QrCode } from 'lucide-react';
import toast from 'react-hot-toast';
import { BuzzMark } from './BuzzBrand';
import ThemeToggle from './ThemeToggle';
import { useQueueCustomers } from '../hooks/useQueueCustomers';

function NavBar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeEvents, setActiveEvents] = useState([]);
  const [queues, setQueues] = useState([]);

  // Load active events
  useEffect(() => {
    if (!currentUser) return;

    // No orderBy here on purpose: these events are only used to filter queues,
    // and adding one would require an (artistId, status, createdAt) composite
    // index. Without it Firestore rejects the listener and the nav goes empty.
    const eventsRef = collection(db, 'events');
    const q = query(
      eventsRef,
      where('artistId', '==', currentUser.uid),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setActiveEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      },
      (error) => console.error('Error loading active events:', error)
    );

    return () => unsubscribe();
  }, [currentUser]);

  const activeEventIdsKey = activeEvents.map(e => e.id).sort().join(',');

  // Load queues for active events
  useEffect(() => {
    const eventIds = activeEventIdsKey ? activeEventIdsKey.split(',') : [];
    if (eventIds.length === 0) return;

    const queuesRef = collection(db, 'queues');
    const unsubscribe = onSnapshot(
      query(queuesRef, where('eventId', 'in', eventIds.slice(0, 30))),
      (snapshot) => setQueues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })))
    );

    return () => unsubscribe();
  }, [activeEventIdsKey]);

  const openQueues = queues.filter(
    q => q.status === 'open' && activeEvents.some(e => e.id === q.eventId)
  );

  // Hooks must run before the early return below
  const { waitingFor } = useQueueCustomers(openQueues.map(q => q.id));

  if (!currentUser) return null;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/');
    } catch {
      toast.error('Failed to logout');
    }
  };

  const totalWaiting = openQueues.reduce((sum, q) => sum + waitingFor(q), 0);

  const onDashboard = location.pathname === '/dashboard';
  const onShare = location.pathname === '/share';
  const onQueue = location.pathname.startsWith('/queue/');

  // One open queue goes straight to it; otherwise land on the dashboard,
  // where "Live now" lists them all.
  const goToQueues = () => {
    if (openQueues.length === 1) {
      navigate(`/queue/${openQueues[0].id}/manage`);
    } else {
      navigate('/dashboard');
    }
  };

  const tabClass = (active) =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 rounded-xl transition-colors ${
      active ? 'text-ink-900 bg-cream-50' : 'text-stone-500 hover:text-ink-700'
    }`;

  return (
    <>
      {/* Top bar */}
      <nav className="bg-white shadow-sm border-b border-cream-200 sticky top-0 z-50 print-hide">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <button
              onClick={() => navigate('/dashboard')}
              className="shrink-0"
              aria-label="Buzz home"
            >
              <BuzzMark size={28} textClass="text-xl" className="text-ink-900" />
            </button>

            {/* Desktop links */}
            <div className="hidden md:flex items-center gap-1">
              <button
                onClick={() => navigate('/dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  onDashboard
                    ? 'bg-honey-100 text-ink-900'
                    : 'text-stone-600 hover:bg-cream-200 hover:text-ink-900'
                }`}
              >
                <Home size={16} />
                Dashboard
              </button>

              {openQueues.map((queue) => (
                <button
                  key={queue.id}
                  onClick={() => navigate(`/queue/${queue.id}/manage`)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === `/queue/${queue.id}/manage`
                      ? 'bg-honey-100 text-ink-900'
                      : 'text-stone-600 hover:bg-cream-200 hover:text-ink-900'
                  }`}
                >
                  <Users size={16} />
                  {queue.name}
                  {waitingFor(queue) > 0 && (
                    <span className="bg-sage-100 text-sage-600 text-xs font-bold px-2 py-0.5 rounded-full">
                      {waitingFor(queue)}
                    </span>
                  )}
                </button>
              ))}

              <button
                onClick={() => navigate('/share')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  onShare
                    ? 'bg-honey-100 text-ink-900'
                    : 'text-stone-600 hover:bg-cream-200 hover:text-ink-900'
                }`}
              >
                <QrCode size={16} />
                Share
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <ThemeToggle />
              {/* Logout — icon only on mobile, since nav lives in the bottom bar */}
              <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 text-sm text-stone-600 hover:bg-cream-200 rounded-lg transition-colors"
              aria-label="Log out"
            >
                <LogOut size={16} />
                <span className="hidden md:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Bottom tab bar — mobile only, app-style navigation */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-cream-200 shadow-lg print-hide"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Main"
      >
        <div className="flex items-stretch gap-1 px-2 pt-1 pb-1">
          <button onClick={() => navigate('/dashboard')} className={tabClass(onDashboard)}>
            <Home size={22} />
            <span className="text-[11px] font-semibold">Home</span>
          </button>

          <button onClick={goToQueues} className={tabClass(onQueue)}>
            <span className="relative">
              <Users size={22} />
              {totalWaiting > 0 && (
                <span className="absolute -top-1.5 -right-2 bg-sage-400 text-ink-900 text-[10px] font-bold min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center">
                  {totalWaiting}
                </span>
              )}
            </span>
            <span className="text-[11px] font-semibold">Queues</span>
          </button>

          <button onClick={() => navigate('/share')} className={tabClass(onShare)}>
            <QrCode size={22} />
            <span className="text-[11px] font-semibold">Share</span>
          </button>
        </div>
      </nav>
    </>
  );
}

export default NavBar;
