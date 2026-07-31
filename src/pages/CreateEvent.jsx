import { useState } from 'react';
import { THEME_OPTIONS } from '../utils/theme';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ArrowLeft, Calendar, MapPin, Palette } from 'lucide-react';
import toast from 'react-hot-toast';

const EVENT_TYPES = [
  { value: 'birthday', label: '🎂 Birthday Party', emoji: '🎂' },
  { value: 'festival', label: '🎪 Festival / Fair', emoji: '🎪' },
  { value: 'corporate', label: '💼 Corporate / Private Event', emoji: '💼' },
  { value: 'school', label: '🏫 School Event', emoji: '🏫' },
  { value: 'other', label: '🎨 Other', emoji: '🎨' }
];

const COLOR_THEMES = THEME_OPTIONS;

function CreateEvent() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    date: '',
    eventType: '',
    colorTheme: 'honey',
    notes: ''
  });

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const eventData = {
        artistId: currentUser.uid,
        name: formData.name,
        location: {
          address: formData.location
        },
        date: new Date(formData.date),
        colorTheme: formData.colorTheme,
        status: 'active',
        eventType: formData.eventType || null,
        notes: formData.notes || '',
        queueCount: 0,
        totalCustomers: 0,
        createdAt: serverTimestamp()
      };

      const docRef = await addDoc(collection(db, 'events'), eventData);
      
      toast.success('Event created successfully! 🎉');
      navigate(`/event/${docRef.id}`);
    } catch (error) {
      console.error('Error creating event:', error);
      toast.error('Failed to create event. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-cream-100">
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-stone-600 hover:text-ink-900 transition-colors text-sm mb-6"
        >
          <ArrowLeft size={16} />
          <span>Back to Dashboard</span>
        </button>
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-ink-900 mb-2">
            Create New Event
          </h1>
          <p className="text-stone-600 mb-8">
            Set up your event and start managing queues
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Event Name */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Event Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className="w-full px-4 py-3 border-2 border-cream-200 rounded-lg focus:border-honey-500 focus:outline-none transition-colors"
                placeholder="Emma's 5th Birthday Party"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Location <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3.5 text-stone-400" size={20} />
                <input
                  type="text"
                  name="location"
                  value={formData.location}
                  onChange={handleChange}
                  required
                  className="w-full pl-11 pr-4 py-3 border-2 border-cream-200 rounded-lg focus:border-honey-500 focus:outline-none transition-colors"
                  placeholder="123 Main Street, Brooklyn, NY"
                />
              </div>
              <p className="text-xs text-stone-500 mt-1">
                Enter the full address where the event will take place
              </p>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-2">
                Event Date <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3.5 text-stone-400" size={20} />
                <input
                  type="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full pl-11 pr-4 py-3 border-2 border-cream-200 rounded-lg focus:border-honey-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Color Theme */}
            <div>
              <label className="block text-sm font-medium text-ink-700 mb-3">
                <Palette className="inline mr-2" size={18} />
                Color Theme
              </label>
              <div className="grid grid-cols-5 gap-3">
                {COLOR_THEMES.map((theme) => (
                  <button
                    key={theme.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, colorTheme: theme.value })}
                    className={`relative p-4 rounded-xl border-2 transition-all ${
                      formData.colorTheme === theme.value
                        ? 'border-gray-800 shadow-lg'
                        : 'border-cream-200 hover:border-cream-300'
                    }`}
                  >
                    <div className={`w-full h-12 rounded-lg ${theme.color}`}></div>
                    <p className="text-xs text-center mt-2 font-medium">{theme.label}</p>
                    {formData.colorTheme === theme.value && (
                      <div className="absolute -top-2 -right-2 bg-sage-1000 text-white rounded-full w-6 h-6 flex items-center justify-center">
                        ✓
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Advanced Options */}
            <div className="border-t border-cream-200 pt-6">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 text-ink-900 hover:text-ink-900 font-medium mb-4"
              >
                <span>{showAdvanced ? '▼' : '▶'}</span>
                Advanced Options (Optional)
              </button>

              {showAdvanced && (
                <div className="space-y-4 pl-6">
                  {/* Event Type */}
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-2">
                      Event Type
                    </label>
                    <select
                      name="eventType"
                      value={formData.eventType}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border-2 border-cream-200 rounded-lg focus:border-honey-500 focus:outline-none transition-colors"
                    >
                      <option value="">Select type (optional)</option>
                      {EVENT_TYPES.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Internal Notes */}
                  <div>
                    <label className="block text-sm font-medium text-ink-700 mb-2">
                      Internal Notes
                    </label>
                    <textarea
                      name="notes"
                      value={formData.notes}
                      onChange={handleChange}
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-cream-200 rounded-lg focus:border-honey-500 focus:outline-none transition-colors resize-none"
                      placeholder="Any notes for yourself about this event..."
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <button
                type="button"
                onClick={() => navigate('/dashboard')}
                className="flex-1 px-6 py-3 border-2 border-cream-300 text-ink-700 rounded-lg font-semibold hover:bg-cream-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-honey-500 text-ink-900 px-6 py-3 rounded-lg font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Event'}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

export default CreateEvent;