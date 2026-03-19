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
import { UserPlus, Search, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import Logo from '../components/Logo';

function ArtistProfile() {
  const { username } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [artist, setArtist] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(location.state?.returnToChoice ? 'choice' : 'welcome');

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
      <div className="min-h-screen bg-gradient-to-br from-lavender-50 to-softpink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-lavender-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!artist) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lavender-50 to-softpink-50 flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Artist Not Found</h1>
          <p className="text-gray-600">This artist profile doesn't exist.</p>
        </div>
      </div>
    );
  }

  // Welcome screen
  if (step === 'welcome') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col p-6 overflow-hidden">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <span className="text-lg font-bold text-white/70" style={{ fontFamily: "'Poppins', sans-serif" }}>ArtistLine</span>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <h1
            className="font-black text-white leading-none tracking-tight mb-10"
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 'clamp(4rem, 14vw, 10rem)',
            }}
          >
            Get in<br />Line
          </h1>
          <button
            onClick={() => setStep('choice')}
            className="bg-white text-gray-900 font-extrabold text-3xl w-full max-w-xs py-6 rounded-2xl shadow-lg hover:shadow-xl hover:scale-105 transition-all"
            style={{ fontFamily: "'Poppins', sans-serif" }}
          >
            Start
          </button>
        </div>
      </div>
    );
  }

  // Choice screen — Get a Turn or Already in Line
  if (step === 'choice') {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col p-6">
        {/* Back button */}
        <button
          onClick={() => setStep('welcome')}
          className="flex items-center gap-2 text-white/60 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft size={20} />
          <span className="font-medium">Back</span>
        </button>

        {/* Two big buttons */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="grid grid-cols-2 gap-5 sm:gap-8 w-full max-w-2xl">
            <button
              onClick={() => {
                if (events.length === 1) {
                  navigate(`/join/${events[0].id}`, { state: { artistUsername: username } });
                } else {
                  setStep('events');
                }
              }}
              className="bg-white/10 hover:bg-white/15 border-2 border-white/20 rounded-3xl aspect-square flex flex-col items-center justify-center gap-6 transition-all hover:scale-105"
            >
              <UserPlus size={72} className="text-white" />
              <span className="text-white text-2xl sm:text-3xl font-bold">Get a Turn</span>
            </button>

            <button
              onClick={() => {
                if (events.length === 1) {
                  navigate(`/event/${events[0].id}/find`, { state: { artistUsername: username } });
                } else {
                  setStep('events');
                }
              }}
              className="bg-white/10 hover:bg-white/15 border-2 border-white/20 rounded-3xl aspect-square flex flex-col items-center justify-center gap-6 transition-all hover:scale-105"
            >
              <Search size={72} className="text-white" />
              <span className="text-white text-2xl sm:text-3xl font-bold">Already in Line?</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Event picker (only shown when multiple events)
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col p-6">
      <button
        onClick={() => setStep('choice')}
        className="flex items-center gap-2 text-white/60 hover:text-white transition-colors w-fit"
      >
        <ArrowLeft size={20} />
        <span className="font-medium">Back</span>
      </button>

      <main className="flex-1 flex flex-col justify-center max-w-lg mx-auto w-full py-8">
        {events.length === 0 ? (
          <div className="text-center">
            <h3 className="text-xl font-bold text-white mb-2">No Active Events</h3>
            <p className="text-white/60">
              This artist doesn't have any upcoming events at the moment.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-white mb-4">Choose an Event</h2>
            {events.map((event) => (
              <button
                key={event.id}
                onClick={() => navigate(`/join/${event.id}`)}
                className="w-full bg-white/10 hover:bg-white/15 border-2 border-white/20 rounded-2xl p-6 text-left transition-all"
              >
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-white">{event.name}</h3>
                  <span className="text-sm font-semibold text-white/60">Join →</span>
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