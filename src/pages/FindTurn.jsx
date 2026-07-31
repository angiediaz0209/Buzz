import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { ArrowLeft, Search } from 'lucide-react';
import toast from 'react-hot-toast';

function FindTurn() {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const artistUsername = location.state?.artistUsername;
  const returnTo = location.state?.returnTo;

  // Whoever sent us here said where to go back to; otherwise fall back to the
  // artist's page, then to plain history.
  const goBack = () => {
    if (returnTo) navigate(returnTo);
    else if (artistUsername) navigate(`/artist/${artistUsername}`, { state: { returnToChoice: true } });
    else navigate(-1);
  };
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e) => {
    e.preventDefault();

    if (!searchQuery.trim()) {
      toast.error('Please enter a name or phone number');
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const customersRef = collection(db, 'customers');
      
      // Search by phone
      const phoneQuery = query(
        customersRef,
        where('eventId', '==', eventId),
        where('phone', '==', searchQuery.trim())
      );

      // Search by name
      const nameQuery = query(
        customersRef,
        where('eventId', '==', eventId),
        where('name', '==', searchQuery.trim())
      );

      const [phoneResults, nameResults] = await Promise.all([
        getDocs(phoneQuery),
        getDocs(nameQuery)
      ]);

      // Combine results and remove duplicates
      const allDocs = [
        ...phoneResults.docs,
        ...nameResults.docs
      ];

      const uniqueIds = new Set();
      const uniqueResults = allDocs
        .filter(doc => {
          if (uniqueIds.has(doc.id)) return false;
          uniqueIds.add(doc.id);
          return true;
        })
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(customer => customer.status !== 'completed');

      setResults(uniqueResults);

      if (uniqueResults.length === 0) {
        toast.error('No turns found. Try a different name or phone number.');
      } else {
        toast.success(`Found ${uniqueResults.length} turn(s)!`);
      }

    } catch (error) {
      console.error('Error searching:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'called': return 'bg-sage-100 text-sage-600 border-sage-300';
      case 'coming': return 'bg-blue-100 text-sage-600 border-sage-300';
      case 'waiting': return 'bg-honey-100 text-ink-900 border-honey-300';
      default: return 'bg-cream-200 text-ink-700 border-cream-300';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'called': return "It's your turn!";
      case 'coming': return '✓ Marked as coming';
      case 'waiting': return '⏳ Waiting in queue';
      default: return status;
    }
  };

  return (
    <div className="min-h-screen bg-cream-100 pb-10">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-cream-200">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <button
            onClick={goBack}
            className="flex items-center gap-2 text-stone-600 hover:text-ink-900 transition-colors mb-3"
          >
            <ArrowLeft size={20} />
            <span>Back</span>
          </button>
          <h1 className="text-2xl font-bold text-ink-900">
            Find Your Turn
          </h1>
          <p className="text-stone-600 text-sm mt-1">
            Enter your name or phone number to find your place in the queue
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Search Form */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <form onSubmit={handleSearch} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Name or Phone Number
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 text-stone-400" size={20} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 border-2 border-cream-200 rounded-lg focus:border-honey-500 focus:outline-none transition-colors"
                  placeholder="Emma, John, or 555-0123"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-honey-500 text-ink-900 py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Searching...' : 'Find My Turn'}
            </button>
          </form>
        </div>

        {/* Results */}
        {searched && (
          <div className="space-y-4">
            {results.length === 0 && !loading ? (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-lg font-bold text-ink-900 mb-2">
                  No turns found
                </h3>
                <p className="text-stone-600 mb-4">
                  Try searching with a different name or phone number
                </p>
                <button
                  onClick={goBack}
                  className="bg-honey-500 text-ink-900 px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                >
                  Go Back
                </button>
              </div>
            ) : (
              results.map((customer) => (
                <div
                  key={customer.id}
                  className={`bg-white rounded-2xl shadow-lg p-6 border-2 ${getStatusColor(customer.status)}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-2xl font-bold text-ink-900">
                        {customer.name || customer.childName || customer.parentName}
                      </h3>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-stone-600">Turn Number</p>
                      <p className="text-4xl font-bold text-ink-900">
                        #{customer.number}
                      </p>
                    </div>
                  </div>

                  <div className={`inline-block px-4 py-2 rounded-full text-sm font-semibold border-2 mb-4 ${getStatusColor(customer.status)}`}>
                    {getStatusText(customer.status)}
                  </div>

                  <button
                    onClick={() => navigate(`/customer/${customer.id}`)}
                    className="w-full bg-honey-500 text-ink-900 py-3 rounded-xl font-semibold hover:shadow-lg transition-all"
                  >
                    View My Turn Details →
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default FindTurn;