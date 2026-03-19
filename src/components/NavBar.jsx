import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { LogOut, Menu, X, Home, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import Logo from './Logo';

function NavBar() {
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeEvents, setActiveEvents] = useState([]);
  const [queues, setQueues] = useState([]);

  // Load active events
  useEffect(() => {
    if (!currentUser) return;

    const eventsRef = collection(db, 'events');
    const q = query(
      eventsRef,
      where('artistId', '==', currentUser.uid),
      where('status', '==', 'active'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setActiveEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Load queues for active events
  useEffect(() => {
    if (!currentUser || activeEvents.length === 0) {
      setQueues([]);
      return;
    }

    const eventIds = activeEvents.map(e => e.id);
    const queuesRef = collection(db, 'queues');
    const q = query(queuesRef, where('eventId', 'in', eventIds));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setQueues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsubscribe();
  }, [currentUser, activeEvents]);

  if (!currentUser) return null;

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Logged out successfully');
      navigate('/');
    } catch (error) {
      toast.error('Failed to logout');
    }
  };

  const isActive = (path) => location.pathname === path;

  const getQueuesForEvent = (eventId) => queues.filter(q => q.eventId === eventId);

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            {/* Logo */}
            <button
              onClick={() => navigate('/dashboard')}
              className="text-xl font-bold text-lavender-600 shrink-0"
            >
              <Logo size={28} className="inline-block mr-1.5 -mt-0.5" /> ArtistLine
            </button>

            {/* Desktop Links */}
            <div className="hidden md:flex items-center gap-1">
              <button
                onClick={() => navigate('/dashboard')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive('/dashboard')
                    ? 'bg-lavender-100 text-lavender-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
              >
                <Home size={16} />
                Dashboard
              </button>

              {/* Active queues as desktop quick-links */}
              {activeEvents.map((event) => {
                const eventQueues = getQueuesForEvent(event.id);
                if (eventQueues.length === 0) return null;
                return eventQueues.map((queue) => (
                  <button
                    key={queue.id}
                    onClick={() => navigate(`/queue/${queue.id}/manage`)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === `/queue/${queue.id}/manage`
                        ? 'bg-lavender-100 text-lavender-700'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Users size={16} />
                    {queue.name}
                    {queue.waitingCount > 0 && (
                      <span className="bg-softpink-100 text-softpink-700 text-xs font-bold px-2 py-0.5 rounded-full">
                        {queue.waitingCount}
                      </span>
                    )}
                  </button>
                ));
              })}
            </div>

            {/* Desktop Logout */}
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <LogOut size={16} />
              Logout
            </button>

            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              {mobileOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="px-4 py-3 space-y-1">
              {/* Active queues grouped by event */}
              {activeEvents.map((event) => {
                const eventQueues = getQueuesForEvent(event.id);
                if (eventQueues.length === 0) return null;
                return (
                  <div key={event.id}>
                    <button
                      onClick={() => {
                        navigate(`/event/${event.id}`);
                        setMobileOpen(false);
                      }}
                      className="w-full flex items-center gap-2 px-4 py-2 text-xs font-semibold text-green-700 uppercase tracking-wide"
                    >
                      <span className="w-2 h-2 bg-green-500 rounded-full" />
                      {event.name}
                    </button>
                    {eventQueues.map((queue) => (
                      <button
                        key={queue.id}
                        onClick={() => {
                          navigate(`/queue/${queue.id}/manage`);
                          setMobileOpen(false);
                        }}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-left font-medium transition-colors ${
                          location.pathname === `/queue/${queue.id}/manage`
                            ? 'bg-lavender-100 text-lavender-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <Users size={20} />
                          {queue.name}
                        </div>
                        {queue.waitingCount > 0 && (
                          <span className="bg-softpink-100 text-softpink-700 text-xs font-bold px-2.5 py-1 rounded-full">
                            {queue.waitingCount} waiting
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                );
              })}

              {/* Divider if there were active queues */}
              {activeEvents.some(e => getQueuesForEvent(e.id).length > 0) && (
                <div className="border-t border-gray-200 pt-2 mt-2" />
              )}

              {/* Dashboard */}
              <button
                onClick={() => {
                  navigate('/dashboard');
                  setMobileOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium transition-colors ${
                  isActive('/dashboard')
                    ? 'bg-lavender-100 text-lavender-700'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Home size={20} />
                Dashboard
              </button>

              {/* Logout */}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <button
                  onClick={() => {
                    handleLogout();
                    setMobileOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left font-medium text-red-600 hover:bg-red-50 transition-colors"
                >
                  <LogOut size={20} />
                  Logout
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
    </>
  );
}

export default NavBar;
