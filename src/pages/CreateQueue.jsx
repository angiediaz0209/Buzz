import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

function CreateQueue() {
  const { eventId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    isVisible: true
  });

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setFormData({
      ...formData,
      [e.target.name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const queueData = {
        eventId,
        artistId: currentUser.uid,
        name: formData.name,
        isVisible: formData.isVisible,
        status: 'open',
        currentNumber: 0,
        lastNumber: 0,
        waitingCount: 0,
        totalServed: 0,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'queues'), queueData);
      
      toast.success('Queue created successfully! 🎉');
      navigate(`/event/${eventId}`);
    } catch (error) {
      console.error('Error creating queue:', error);
      toast.error('Failed to create queue. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-lavender-50 to-softpink-50">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(`/event/${eventId}`)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm mb-6"
        >
          <ArrowLeft size={16} />
          <span>Back to Event</span>
        </button>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-lavender-600 mb-2">
            Create New Queue
          </h1>
          <p className="text-gray-600 mb-8">
            Add a queue to your event (e.g., "Face Painting", "Balloon Animals")
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Queue Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Queue Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-lavender-500 focus:outline-none transition-colors"
                placeholder="Face Painting Line"
              />
              <p className="text-xs text-gray-500 mt-1">
                This name will be shown to clients when they join the queue
              </p>
            </div>

            {/* Visibility Toggle */}
            <div className="bg-lavender-50 rounded-xl p-6 border-2 border-lavender-200">
              <div className="flex items-start gap-4">
                <input
                  type="checkbox"
                  name="isVisible"
                  id="isVisible"
                  checked={formData.isVisible}
                  onChange={handleChange}
                  className="mt-1 w-5 h-5 text-lavender-600 border-gray-300 rounded focus:ring-lavender-500"
                />
                <div className="flex-1">
                  <label htmlFor="isVisible" className="font-semibold text-gray-900 cursor-pointer">
                    Visible to Clients
                  </label>
                  <p className="text-sm text-gray-600 mt-1">
                    When enabled, clients will see this queue when they scan the QR code. 
                    Disable if you want to manage this queue privately or use it only on specific kiosk stations.
                  </p>
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
              <p className="text-sm text-blue-900">
                <strong>💡 Tip:</strong> You can create multiple queues for different activities at the same event. 
                For example: "Quick Face Paint" and "Full Face Designs" or "Face Painting" and "Balloon Animals".
              </p>
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate(`/event/${eventId}`)}
                className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-gradient-to-r from-lavender-500 to-softpink-500 text-white px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Queue'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default CreateQueue;