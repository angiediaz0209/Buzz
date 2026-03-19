import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { Plus, Calendar, MapPin, QrCode, Monitor, Link as LinkIcon, Copy, Printer } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import toast from 'react-hot-toast';
import { collection, query, where, onSnapshot, orderBy, deleteDoc, getDocs, doc, getDoc } from 'firebase/firestore';
import { getTheme } from '../utils/theme';

function Dashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [artistUsername, setArtistUsername] = useState('');
  const [showClientQR, setShowClientQR] = useState(false);
  const [showDisplayQR, setShowDisplayQR] = useState(false);
  const [selectedDisplayEvent, setSelectedDisplayEvent] = useState(null);

  const permanentUrl = artistUsername ? `${window.location.origin}/artist/${artistUsername}` : '';

  // Load artist username
  useEffect(() => {
    if (!currentUser) return;
    const loadUsername = async () => {
      try {
        const artistDoc = await getDoc(doc(db, 'artists', currentUser.uid));
        if (artistDoc.exists()) {
          setArtistUsername(artistDoc.data().username);
        }
      } catch (error) {
        console.error('Error loading artist profile:', error);
      }
    };
    loadUsername();
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

  const formatDate = (timestamp) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };
  const handleDeleteEvent = async (e, eventId) => {
    e.stopPropagation();
    if (!confirm('Delete this event? This cannot be undone.')) return;
  
    try {
      // Delete all queues for this event
      const queuesSnapshot = await getDocs(
        query(collection(db, 'queues'), where('eventId', '==', eventId))
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
      await deleteDoc(doc(db, 'events', eventId));
      toast.success('Event deleted!');
    } catch (error) {
      console.error('Error deleting event:', error);
      toast.error('Failed to delete event');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-lavender-50 to-softpink-50">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Setup & Share Section */}
        {artistUsername && (
          <div id="setup-share" className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {/* Client Link Card */}
            <div className="bg-white rounded-2xl shadow-lg p-5 border-2 border-gray-100">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-2 bg-lavender-100 rounded-lg">
                  <LinkIcon size={18} className="text-lavender-600" />
                </div>
                <h3 className="font-bold text-gray-900">Client Link</h3>
              </div>

              <p className="text-xs text-gray-500 font-mono truncate mb-3" title={permanentUrl}>
                {permanentUrl}
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(permanentUrl);
                    toast.success('Link copied!');
                  }}
                  className="flex-1 flex items-center justify-center gap-2 bg-lavender-100 text-lavender-700 py-2 rounded-lg text-sm font-semibold hover:bg-lavender-200 transition-colors"
                >
                  <Copy size={16} />
                  Copy
                </button>
                <button
                  onClick={() => setShowClientQR(!showClientQR)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    showClientQR
                      ? 'bg-lavender-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <QrCode size={16} />
                  QR Code
                </button>
              </div>

              {showClientQR && (
                <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                  <QRCodeSVG
                    value={permanentUrl}
                    size={160}
                    level="H"
                    includeMargin={true}
                    fgColor="#7C3AED"
                  />
                  <button
                    onClick={() => window.print()}
                    className="mt-3 flex items-center justify-center gap-2 text-sm text-lavender-600 font-medium hover:text-lavender-800 transition-colors mx-auto"
                  >
                    <Printer size={14} />
                    Print QR
                  </button>
                </div>
              )}
            </div>

            {/* Display Screen Card */}
            {(() => {
              const activeEvents = events.filter(e => e.status === 'active');
              const displayEvent = selectedDisplayEvent
                ? activeEvents.find(e => e.id === selectedDisplayEvent) || activeEvents[0]
                : activeEvents[0];
              const displayUrl = displayEvent
                ? `${window.location.origin}/display/${displayEvent.id}`
                : '';

              if (!displayEvent) return null;

              return (
                <div className="bg-white rounded-2xl shadow-lg p-5 border-2 border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-2 bg-softpink-100 rounded-lg">
                      <Monitor size={18} className="text-softpink-600" />
                    </div>
                    <h3 className="font-bold text-gray-900">Display Screen</h3>
                  </div>

                  {/* Event picker (if multiple active) */}
                  {activeEvents.length > 1 && (
                    <div className="flex gap-1 mb-3 overflow-x-auto">
                      {activeEvents.map(ev => (
                        <button
                          key={ev.id}
                          onClick={() => setSelectedDisplayEvent(ev.id)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                            displayEvent.id === ev.id
                              ? 'bg-softpink-600 text-white'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {ev.name}
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 font-mono truncate mb-3" title={displayUrl}>
                    {displayUrl}
                  </p>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(displayUrl);
                        toast.success('Display link copied!');
                      }}
                      className="flex-1 flex items-center justify-center gap-2 bg-softpink-100 text-softpink-700 py-2 rounded-lg text-sm font-semibold hover:bg-softpink-200 transition-colors"
                    >
                      <Copy size={16} />
                      Copy
                    </button>
                    <button
                      onClick={() => setShowDisplayQR(!showDisplayQR)}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-semibold transition-colors ${
                        showDisplayQR
                          ? 'bg-softpink-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      <QrCode size={16} />
                      QR Code
                    </button>
                  </div>

                  {showDisplayQR && (
                    <div className="mt-4 pt-4 border-t border-gray-100 text-center">
                      <QRCodeSVG
                        value={displayUrl}
                        size={160}
                        level="H"
                        includeMargin={true}
                        fgColor="#DB2777"
                      />
                      <p className="text-gray-400 text-xs mt-2">
                        Scan on TV/tablet — pick your queue there
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* Events Section */}
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Your Events</h2>
          <button
            onClick={() => navigate('/create-event')}
            className="flex items-center gap-2 bg-gradient-to-r from-lavender-500 to-softpink-500 text-white px-5 py-2.5 rounded-xl font-semibold text-sm shadow-lg hover:shadow-xl transition-all"
          >
            <Plus size={18} />
            Create Event
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-lavender-600"></div>
            <p className="mt-4 text-gray-600">Loading your events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
            <div className="text-6xl mb-4">🎨</div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">No Events Yet</h2>
            <p className="text-gray-600 mb-6">
              Create your first event to start managing queues!
            </p>
            <button
              onClick={() => navigate('/create-event')}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-lavender-500 to-softpink-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
            >
              <Plus size={20} />
              Create Event
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event) => (
              <div
              key={event.id}
              onClick={() => navigate(`/event/${event.id}`)}
              className={`bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all cursor-pointer border-2 border-transparent ${getTheme(event.colorTheme).hoverBorder}`}
            >
              {/* Event Header */}
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 flex-1">
                  {event.name}
                </h3>
                <div className="flex items-center gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    event.status === 'active' 
                      ? 'bg-green-100 text-green-700'
                      : event.status === 'completed'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-red-100 text-red-700'
                  }`}>
                    {event.status || 'active'}
                  </span>
                  <button
                    onClick={(e) => handleDeleteEvent(e, event.id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete event"
                  >
                    🗑️
                  </button>
                </div>
              </div>

                {/* Event Details */}
                <div className="space-y-2 text-sm text-gray-600">
                  <div className="flex items-center gap-2">
                    <Calendar size={16} className="text-lavender-500" />
                    <span>{formatDate(event.date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin size={16} className="text-lavender-500" />
                    <span className="truncate">{event.location?.address || 'No location'}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Queues</span>
                    <span className="font-semibold text-lavender-600">
                      {event.queueCount || 0}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm mt-1">
                    <span className="text-gray-600">Total Served</span>
                    <span className="font-semibold text-softpink-600">
                      {event.totalCustomers || 0}
                    </span>
                  </div>
                </div>

                {/* Color Theme Indicator */}
                <div className="mt-4 flex gap-1">
                  <div
                    className={`h-2 w-full rounded-full ${getTheme(event.colorTheme).accent}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default Dashboard;