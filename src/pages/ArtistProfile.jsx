import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import {
  collection,
  query,
  where,
  doc,
  getDoc,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import TurnChoice from '../components/TurnChoice';

function ArtistProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [artist, setArtist] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  // A scanned code lands straight on the two buttons. There is no splash step:
  // someone standing at the table with their phone out is already committed.
  const [step, setStep] = useState('choice');
  // Which button brought them to the event picker: 'join' or 'find'.
  const [intent, setIntent] = useState('join');

  // Kiosk mode is enabled via ?kiosk=1 in the URL (set once on the iPad)
  const isKiosk = new URLSearchParams(location.search).get('kiosk') === '1';

  useEffect(() => {
    if (!username) return;

    let unsubscribe;

    // This runs on a client's phone over venue wifi, so every round trip here
    // is felt. It used to make three, one waiting on the next: look up the
    // username, load the artist profile, then query events. Two are gone —
    // the username lookup is a direct document read instead of a query, and
    // the profile fetch was only ever used for a display name this screen no
    // longer shows, so events are queried straight off the username doc.
    const loadArtistProfile = async () => {
      try {
        const usernameDoc = await getDoc(doc(db, 'usernames', username.toLowerCase()));

        if (!usernameDoc.exists()) {
          toast.error('Artist not found');
          setLoading(false);
          return;
        }

        const userId = usernameDoc.data().userId;
        // The username document existing is what proves the artist does; the
        // profile document is not on the critical path any more.
        setArtist({ id: userId });

        // What clients see is the artist's explicit choice: an active event
        // that hasn't been hidden. There is deliberately no date filter — it
        // used to compare a UTC-midnight event date against local midnight,
        // which hid an event on its own day for anyone west of UTC.
        const q = query(
          collection(db, 'events'),
          where('artistId', '==', userId),
          where('status', '==', 'active'),
          orderBy('date', 'asc')
        );

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const eventsData = snapshot.docs
              .map(d => ({ id: d.id, ...d.data() }))
              // legacy events predate the flag, so only an explicit false hides one
              .filter(event => event.isVisible !== false);

            setEvents(eventsData);
            setLoading(false);
          },
          (error) => {
            console.error('Error loading events:', error);
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Error loading artist profile:', error);
        toast.error('Failed to load artist profile');
        setLoading(false);
      }
    };

    loadArtistProfile();

    return () => unsubscribe?.();
  }, [username]);


  if (loading) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-honey-500"></div>
          <p className="mt-4 text-stone-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-cream-100 flex items-center justify-center p-6">
        <div className="text-center">
          <h1 className="text-2xl font-extrabold text-ink-900 mb-2">Artist not found</h1>
          <p className="text-stone-600">This profile doesn&apos;t exist.</p>
        </div>
      </div>
    );
  }

  // Choice screen — take a number, or look up one you already have
  if (step === 'choice') {
    return (
      // No artist name here on purpose — a client scanning a code already knows
      // whose table they are standing at, and the two buttons are the whole point.
      <TurnChoice
        onGetTurn={() => {
          setIntent('join');
          if (events.length === 1) {
            navigate(`/join/${events[0].id}`, {
              state: { artistUsername: username, kiosk: isKiosk }
            });
          } else {
            setStep('events');
          }
        }}
        onFindTurn={() => {
          setIntent('find');
          if (events.length === 1) {
            navigate(`/event/${events[0].id}/find`, {
              state: { artistUsername: username, kiosk: isKiosk }
            });
          } else {
            setStep('events');
          }
        }}
      />
    );
  }

  // Event picker (only shown when multiple events)
  return (
    <div className="min-h-screen bg-cream-100 flex flex-col p-6">
      <button
        onClick={() => setStep('choice')}
        className="flex items-center gap-2 text-stone-600 hover:text-ink-900 transition-colors w-fit"
      >
        <ArrowLeft size={20} />
        <span className="font-semibold">Back</span>
      </button>

      <main className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full py-8">
        {events.length === 0 ? (
          <div className="text-center">
            <h3 className="text-xl font-extrabold text-ink-900 mb-2">Nothing on right now</h3>
            <p className="text-stone-600">
              This artist doesn&apos;t have any upcoming events.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-extrabold text-ink-900 mb-4">
              {intent === 'find' ? 'Which event are you in line for?' : 'Choose an event'}
            </h2>
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() =>
                  navigate(
                    intent === 'find' ? `/event/${event.id}/find` : `/join/${event.id}`,
                    { state: { artistUsername: username, kiosk: isKiosk } }
                  )
                }
                className="w-full bg-white hover:border-honey-400 border-2 border-cream-300 rounded-2xl p-6 text-left transition-colors shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-extrabold text-ink-900">{event.name}</h3>
                  <span className="text-sm font-bold text-honey-700">
                    {intent === 'find' ? 'Find →' : 'Join →'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default ArtistProfile;