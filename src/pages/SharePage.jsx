import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { QrCode, Monitor, Link as LinkIcon } from 'lucide-react';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ShareCard, SharePlaceholder } from '../components/ShareCard';
import { TONES } from '../utils/shareTones';
import { appUrl } from '../utils/urls';

function SharePage() {
  const { currentUser } = useAuth();

  const [events, setEvents] = useState([]);
  const [queues, setQueues] = useState([]);
  const [artistUsername, setArtistUsername] = useState('');
  const [artistName, setArtistName] = useState('');
  const [loading, setLoading] = useState(true);

  const [showKioskQR, setShowKioskQR] = useState(false);
  const [showClientQR, setShowClientQR] = useState(true);
  const [showDisplayQR, setShowDisplayQR] = useState(false);
  const [selectedDisplayEvent, setSelectedDisplayEvent] = useState(null);
  const [printTarget, setPrintTarget] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    const loadArtist = async () => {
      try {
        const artistDoc = await getDoc(doc(db, 'artists', currentUser.uid));
        if (artistDoc.exists()) {
          setArtistUsername(artistDoc.data().username);
          setArtistName(artistDoc.data().displayName || artistDoc.data().username || '');
        }
      } catch (error) {
        console.error('Error loading artist profile:', error);
      }
    };
    loadArtist();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, 'events'),
        where('artistId', '==', currentUser.uid),
        orderBy('createdAt', 'desc')
      ),
      (snapshot) => {
        setEvents(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const eventIdsKey = events.map(e => e.id).sort().join(',');

  // Queues only so we can prefer the event that's actually running
  useEffect(() => {
    const eventIds = eventIdsKey ? eventIdsKey.split(',') : [];
    if (eventIds.length === 0) return;

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

  // Hand off to the browser's print dialog once the sign has mounted.
  // The body class is what hides the rest of the app on paper (see index.css);
  // it goes on right before print() and comes off as soon as the dialog closes.
  useEffect(() => {
    if (!printTarget) return;
    const timer = setTimeout(() => {
      document.body.classList.add('printing-sign');
      try {
        window.print();
      } finally {
        document.body.classList.remove('printing-sign');
        setPrintTarget(null);
      }
    }, 80);
    return () => clearTimeout(timer);
  }, [printTarget]);

  const copyLink = async (url, label) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success(`${label} copied!`);
    } catch (error) {
      console.error('Error copying link:', error);
      toast.error('Could not copy. Select the link and copy it manually.');
    }
  };

  const activeEvents = events.filter(e => e.status === 'active');
  // exactly what the permanent client link resolves to
  const visibleEvents = activeEvents.filter(e => e.isVisible !== false);

  // Prefer the event with an open queue over merely the newest one
  const liveEventId = queues.find(q => q.status === 'open')?.eventId;
  const defaultEvent = activeEvents.find(e => e.id === liveEventId) || activeEvents[0];

  const displayEvent = selectedDisplayEvent
    ? activeEvents.find(e => e.id === selectedDisplayEvent) || defaultEvent
    : defaultEvent;

  const kioskUrl = artistUsername ? appUrl(`artist/${artistUsername}?kiosk=1`) : '';
  // Permanent: print once, never again. Resolves at scan time to whichever
  // events the artist has left visible, so a new event needs no new QR code.
  const clientUrl = artistUsername ? appUrl(`artist/${artistUsername}`) : '';
  const displayUrl = displayEvent ? appUrl(`display/${displayEvent.id}`) : '';

  const eventPicker = (tone, current, onPick) =>
    activeEvents.length > 1 ? (
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {activeEvents.map(ev => (
          <button
            key={ev.id}
            onClick={() => onPick(ev.id)}
            className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              current?.id === ev.id
                ? TONES[tone].pillActive
                : 'bg-cream-200 text-stone-600 hover:bg-cream-300'
            }`}
          >
            {ev.name}
          </button>
        ))}
      </div>
    ) : null;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div>
          <p className="mt-4 text-stone-600">Loading your links...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8 print-hide">
          <h1 className="text-2xl font-bold text-ink-900">Share &amp; setup</h1>
          <p className="text-sm text-stone-500 mt-1">
            Your links and QR codes. Print the client sign for your table.
          </p>
        </div>

        {activeEvents.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border-2 border-cream-200 print-hide">
            <p className="text-stone-600">
              You don&apos;t have an active event yet. Create one and your client and display
              links will show up here.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {artistUsername ? (
            <ShareCard
              tone="sage"
              icon={QrCode}
              audience="For clients"
              purpose="One code for every event — print it once"
              url={clientUrl}
              openLabel="Open client join page in a new tab"
              qrOpen={showClientQR}
              onToggleQR={() => setShowClientQR(!showClientQR)}
              onCopy={() => copyLink(clientUrl, 'Client link')}
              onPrint={() => setPrintTarget('client')}
              printing={printTarget === 'client'}
              signEyebrow={artistName}
              signHeadline="Scan to get in line"
              signSubhead="Get your turn here — no app, no sign-up sheet."
              signSteps={[
                'Scan the code with your phone camera',
                'Add your name and pick your line',
                'Watch your turn move on your phone'
              ]}
              qrNote={
                visibleEvents.length === 0
                  ? 'No events are visible to clients right now'
                  : visibleEvents.length === 1
                  ? `Clients will land on ${visibleEvents[0].name}`
                  : `Clients will choose between ${visibleEvents.length} events`
              }
            />
          ) : (
            <SharePlaceholder
              icon={QrCode}
              audience="For clients"
              blurb="Finish setting up your profile to get the permanent link clients scan."
            />
          )}

          <ShareCard
            tone="honey"
            icon={LinkIcon}
            audience="For my iPad"
            purpose="Self check-in kiosk at your table"
            url={kioskUrl}
            openLabel="Open kiosk in a new tab"
            qrOpen={showKioskQR}
            onToggleQR={() => setShowKioskQR(!showKioskQR)}
            onCopy={() => copyLink(kioskUrl, 'Kiosk link')}
            onPrint={() => setPrintTarget('kiosk')}
            printing={printTarget === 'kiosk'}
            signHeadline="Open the check-in kiosk"
            signSubhead="Scan with the iPad, then leave the page running on your table."
            qrNote="Open this on the iPad once, then leave it running"
          />

          {displayEvent ? (
            <ShareCard
              tone="ink"
              icon={Monitor}
              audience="For the TV"
              purpose="Shows the number now being served"
              url={displayUrl}
              openLabel="Open display screen in a new tab"
              qrOpen={showDisplayQR}
              onToggleQR={() => setShowDisplayQR(!showDisplayQR)}
              onCopy={() => copyLink(displayUrl, 'Display link')}
              onPrint={() => setPrintTarget('display')}
              printing={printTarget === 'display'}
              signEyebrow={displayEvent.name}
              signHeadline="Open the display screen"
              signSubhead="Scan with the TV or tablet to show the number now being served."
              picker={eventPicker('ink', displayEvent, setSelectedDisplayEvent)}
              qrNote="Scan on the TV or tablet — pick your queue there"
            />
          ) : (
            <SharePlaceholder
              icon={Monitor}
              audience="For the TV"
              blurb="Create an active event to get a screen you can put on a TV or tablet showing the number now being served."
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default SharePage;
