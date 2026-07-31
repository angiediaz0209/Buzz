import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { BuzzMark, Mascot } from '../components/BuzzBrand';
import TurnChoice from '../components/TurnChoice';

function ArtistProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [artist, setArtist] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(location.state?.returnToChoice ? 'choice' : 'welcome');

  // Kiosk mode is enabled via ?kiosk=1 in the URL (set once on the iPad)
  const isKiosk = new URLSearchParams(location.search).get('kiosk') === '1';

  useEffect(() => {
    if (!username) return;

    const loadArtistProfile = async () => {
      try {
        // Find artist by username
        const usernameDoc = await getDocs(
          query(collection(db, 'usernames'), where('__name__', '==', username.toLowerCase()))
        );

        if (usernameDoc.empty) {
          toast.error('Artist not found');
          setLoading(false);
          return;
        }

        const userId = usernameDoc.docs[0].data().userId;

        // Load artist profile
        const artistDoc = await getDocs(
          query(collection(db, 'artists'), where('__name__', '==', userId))
        );

        if (!artistDoc.empty) {
          setArtist({ id: userId, ...artistDoc.docs[0].data() });

          // Load active events for this artist
          const eventsRef = collection(db, 'events');
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const q = query(
            eventsRef,
            where('artistId', '==', userId),
            where('status', '==', 'active'),
            orderBy('date', 'asc')
          );

          const unsubscribe = onSnapshot(q, (snapshot) => {
            const eventsData = snapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              }))
              .filter(event => {
                const eventDate = event.date.toDate ? event.date.toDate() : new Date(event.date);
                return eventDate >= today;
              });

            setEvents(eventsData);
            setLoading(false);
          });

          return () => unsubscribe();
        }
      } catch (error) {
        console.error('Error loading artist profile:', error);
        toast.error('Failed to load artist profile');
        setLoading(false);
      }
    };

    loadArtistProfile();
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

  // Welcome / splash screen
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-cream-100 flex flex-col items-center px-6 py-10">
        <BuzzMark size={40} textClass="text-4xl" className="text-ink-900" />

        <div className="flex-1 flex items-center justify-center w-full">
          <Mascot className="w-56 sm:w-72 h-auto" alt="Buzz the bee, ready to take your name" />
        </div>

        <p className="text-2xl font-extrabold text-ink-900 text-center leading-snug mb-8">
          Your place in line,
          <br />
          made <span className="text-honey-500">simple</span>.
        </p>

        <button
          onClick={() => setStep('choice')}
          className="bg-honey-500 text-ink-900 font-extrabold text-2xl w-full max-w-sm py-5 rounded-2xl shadow-lg hover:bg-honey-600 transition-colors"
        >
          Start
        </button>
      </div>
    );
  }

  // Choice screen — take a number, or look up one you already have
  if (step === 'choice') {
    return (
      <TurnChoice
        title={artist.displayName || artist.username}
        subtitle="What would you like to do?"
        onBack={() => setStep('welcome')}
        onGetTurn={() => {
          if (events.length === 1) {
            navigate(`/join/${events[0].id}`, {
              state: { artistUsername: username, kiosk: isKiosk }
            });
          } else {
            setStep('events');
          }
        }}
        onFindTurn={() => {
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
            <h2 className="text-2xl font-extrabold text-ink-900 mb-4">Choose an event</h2>
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => navigate(`/join/${event.id}`)}
                className="w-full bg-white hover:border-honey-400 border-2 border-cream-300 rounded-2xl p-6 text-left transition-colors shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-extrabold text-ink-900">{event.name}</h3>
                  <span className="text-sm font-bold text-honey-700">Join →</span>
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