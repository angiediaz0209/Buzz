import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { 
  doc, 
  getDoc, 
  collection, 
  addDoc,
  query, 
  where, 
  onSnapshot, 
  updateDoc,
  deleteDoc,
  orderBy,
  serverTimestamp
} from 'firebase/firestore';
import { ArrowLeft, Phone, Mail, Clock, RefreshCw, X, Undo2 } from 'lucide-react';
import toast from 'react-hot-toast';

function ManageQueue() {
  const { queueId } = useParams();
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  
  const [queue, setQueue] = useState(null);
  const [event, setEvent] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!queueId || !currentUser) return;

    // Load queue details
    const loadQueue = async () => {
      try {
        const queueDoc = await getDoc(doc(db, 'queues', queueId));
        if (queueDoc.exists()) {
          const queueData = { id: queueDoc.id, ...queueDoc.data() };
          setQueue(queueData);

          // Load event details
          const eventDoc = await getDoc(doc(db, 'events', queueData.eventId));
          if (eventDoc.exists()) {
            setEvent({ id: eventDoc.id, ...eventDoc.data() });
          }
        } else {
          toast.error('Queue not found');
          navigate('/dashboard');
        }
      } catch (error) {
        console.error('Error loading queue:', error);
        toast.error('Failed to load queue');
      } finally {
        setLoading(false);
      }
    };

    loadQueue();

    // Real-time listener for customers
    const customersRef = collection(db, 'customers');
    const q = query(
    customersRef, 
    where('queueId', '==', queueId),
    orderBy('number', 'asc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
    const customersData = snapshot.docs
        .map(d => ({
        id: d.id,
        ...d.data()
        }));
    setCustomers(customersData);

    // Sync queue doc counters from real data
    const waiting = customersData.filter(c => c.status === 'waiting').length;
    const completed = customersData.filter(c => c.status === 'completed').length;
    const skipped = customersData.filter(c => c.status === 'skipped').length;
    try {
      await updateDoc(doc(db, 'queues', queueId), {
        waitingCount: waiting,
        totalServed: completed,
        skippedCount: skipped
      });
    } catch (e) {
      // Non-critical — queue doc sync failed silently
    }
    });

    return () => unsubscribe();
  }, [queueId, currentUser, navigate]);

  const callNextNumber = async () => {
    const waiting = customers.filter(c => c.status === 'waiting');
    if (waiting.length === 0) {
      toast.error('No customers waiting in queue');
      return;
    }

    const currentlyServing = customers.filter(c => c.status === 'called' || c.status === 'coming');
    const nextCustomer = waiting[0];

    try {
      // Auto-complete everyone currently being served
      for (const serving of currentlyServing) {
        await updateDoc(doc(db, 'customers', serving.id), {
          status: 'completed',
          completedAt: serverTimestamp()
        });
      }

      // Call the next customer
      await updateDoc(doc(db, 'customers', nextCustomer.id), {
        status: 'called',
        calledAt: serverTimestamp()
      });

      // Update queue current number
      await updateDoc(doc(db, 'queues', queueId), {
        currentNumber: nextCustomer.number
      });

      if ('vibrate' in navigator) {
        navigator.vibrate(200);
      }

      toast.success(`Called #${nextCustomer.number} - ${nextCustomer.childName || nextCustomer.parentName}`);

    } catch (error) {
      console.error('Error calling next number:', error);
      toast.error('Failed to call next number');
    }
  };

  const goBack = async () => {
    // Find the most recently completed customer (the one we just auto-completed)
    const completed = customers
      .filter(c => c.status === 'completed' && c.completedAt)
      .sort((a, b) => {
        const aTime = a.completedAt?.toMillis ? a.completedAt.toMillis() : 0;
        const bTime = b.completedAt?.toMillis ? b.completedAt.toMillis() : 0;
        return bTime - aTime;
      });

    const currentlyServing = customers.filter(c => c.status === 'called' || c.status === 'coming');

    if (completed.length === 0) {
      toast.error('Nothing to undo');
      return;
    }

    const lastCompleted = completed[0];

    try {
      // Put current called person back to waiting
      for (const serving of currentlyServing) {
        await updateDoc(doc(db, 'customers', serving.id), {
          status: 'waiting',
          calledAt: null
        });
      }

      // Restore the last completed person back to called
      await updateDoc(doc(db, 'customers', lastCompleted.id), {
        status: 'called',
        completedAt: null
      });

      // Update queue current number back
      await updateDoc(doc(db, 'queues', queueId), {
        currentNumber: lastCompleted.number
      });

      toast.success(`Restored #${lastCompleted.number} - ${lastCompleted.childName || lastCompleted.parentName}`);

    } catch (error) {
      console.error('Error going back:', error);
      toast.error('Failed to go back');
    }
  };

  const resendNotification = async (customer) => {
    if (!customer || !queue) return;

    const method = customer.notificationMethod || (customer.phone ? 'sms' : customer.email ? 'email' : 'none');
    const pushTarget = customer.pushToken || customer.pushSubscription || customer.deviceToken || null;
    const targets = {
      sms: customer.phone,
      email: customer.email,
      push: pushTarget
    };

    if (method === 'none' || !targets[method]) {
      toast.error('No contact information available for this customer');
      return;
    }

    const recipientName = customer.childName || customer.parentName || 'there';
    const queueName = queue.name || 'your artist';
    const message = `Hi ${recipientName}, it's your turn at ${queueName}! Please head over now.`;

    try {
      await addDoc(collection(db, 'notifications'), {
        customerId: customer.id,
        queueId,
        eventId: queue.eventId || null,
        method,
        target: targets[method],
        phone: customer.phone || null,
        email: customer.email || null,
        message,
        type: 'resend',
        triggeredBy: currentUser?.uid || null,
        triggeredByName: currentUser?.displayName || currentUser?.email || null,
        status: 'pending',
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'customers', customer.id), {
        lastNotificationAt: serverTimestamp()
      });

      toast.success(`Notification sent to ${recipientName}`);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast.error('Failed to send notification');
    }
  };

  const removeCustomer = async (customer) => {
    if (!confirm(`Remove ${customer.childName || customer.parentName} from queue?`)) return;

    try {
      await deleteDoc(doc(db, 'customers', customer.id));
      toast.success('Customer removed from queue');
    } catch (error) {
      console.error('Error removing customer:', error);
      toast.error('Failed to remove customer');
    }
  };

  const toggleQueueStatus = async () => {
    if (!queue) return;

    const newStatus = queue.status === 'open' ? 'closed' : 'open';
    
    try {
      await updateDoc(doc(db, 'queues', queueId), {
        status: newStatus
      });
      toast.success(`Queue ${newStatus === 'open' ? 'opened' : 'closed'}`);
    } catch (error) {
      console.error('Error updating queue status:', error);
      toast.error('Failed to update queue status');
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-lavender-50 to-softpink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-lavender-600"></div>
          <p className="mt-4 text-gray-600">Loading queue...</p>
        </div>
      </div>
    );
  }

  if (!queue || !event) return null;

  const waitingCustomers = customers.filter(c => c.status === 'waiting');
  const calledCustomers = customers.filter(c => c.status === 'called');
  const comingCustomers = customers.filter(c => c.status === 'coming');
  const completedCustomers = customers.filter(c => c.status === 'completed');
  const skippedCustomers = customers.filter(c => c.status === 'skipped');
  const servingCustomers = [...calledCustomers, ...comingCustomers];

  return (
    <div className="min-h-screen bg-gradient-to-br from-lavender-50 to-softpink-50 pb-20">
      {/* Queue Controls */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-14 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <button
            onClick={() => navigate(`/event/${event.id}`)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors text-sm mb-2"
          >
            <ArrowLeft size={16} />
            <span>Back to Event</span>
          </button>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{queue.name}</h1>
              <p className="text-sm text-gray-600">{event.name}</p>
            </div>

            <button
              onClick={toggleQueueStatus}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                queue.status === 'open'
                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                  : 'bg-red-100 text-red-700 hover:bg-red-200'
              }`}
            >
              {queue.status === 'open' ? 'Close Queue' : 'Open Queue'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-sm text-gray-600">Now Serving</p>
            <p className="text-3xl font-bold text-lavender-600">
              #{queue.currentNumber || 0}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-sm text-gray-600">Waiting</p>
            <p className="text-3xl font-bold text-softpink-600">
              {waitingCustomers.length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-sm text-gray-600">Completed</p>
            <p className="text-3xl font-bold text-gray-700">
              {completedCustomers.length}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={callNextNumber}
            disabled={waitingCustomers.length === 0}
            className="flex-1 bg-gradient-to-r from-lavender-500 to-softpink-500 text-white py-5 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {servingCustomers.length > 0 ? 'Next Number' : 'Call First Number'}
          </button>
          <button
            onClick={goBack}
            disabled={completedCustomers.length === 0}
            className="px-5 py-5 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo last call"
          >
            <Undo2 size={24} />
          </button>
        </div>

        {/* Currently Serving */}
        {servingCustomers.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Currently Serving</h2>
            {servingCustomers.map((customer) => (
              <div
                key={customer.id}
                className={`rounded-xl p-4 mb-3 ${
                  customer.status === 'coming'
                    ? 'bg-blue-50 border-2 border-blue-300'
                    : 'bg-green-50 border-2 border-green-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-3xl font-bold ${
                        customer.status === 'coming' ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        #{customer.number}
                      </span>
                      <div>
                        <p className="font-bold text-gray-900">
                          {customer.childName || customer.parentName}
                        </p>
                        {customer.childName && customer.parentName && (
                          <p className="text-sm text-gray-600">Parent: {customer.parentName}</p>
                        )}
                        {customer.status === 'coming' && (
                          <p className="text-xs text-blue-600 font-semibold mt-1">On their way</p>
                        )}
                      </div>
                    </div>

                    {customer.phone && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone size={14} />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => resendNotification(customer)}
                    className="px-3 py-2 bg-blue-100 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-200"
                    title="Resend notification"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Waiting Queue */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-gray-900 mb-3">
            Waiting ({waitingCustomers.length})
          </h2>

          {waitingCustomers.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <p className="text-gray-500">No customers waiting</p>
            </div>
          ) : (
            <div className="space-y-3">
              {waitingCustomers.map((customer, index) => (
                <div
                  key={customer.id}
                  className="bg-white rounded-xl p-4 shadow hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-2xl font-bold text-lavender-600">
                        #{customer.number}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900">
                          {customer.childName || customer.parentName}
                        </p>
                        {customer.childName && customer.parentName && (
                          <p className="text-sm text-gray-600">Parent: {customer.parentName}</p>
                        )}

                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-500">
                          {customer.phone && (
                            <div className="flex items-center gap-1">
                              <Phone size={12} />
                              <span>{customer.phone}</span>
                            </div>
                          )}
                          {customer.joinedAt && (
                            <div className="flex items-center gap-1">
                              <Clock size={12} />
                              <span>Joined {formatTime(customer.joinedAt)}</span>
                            </div>
                          )}
                        </div>

                        {index === 0 && (
                          <p className="text-xs text-green-600 font-semibold mt-2">
                            Next in line
                          </p>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => removeCustomer(customer)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                      title="Remove from queue"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Didn't Show */}
        {skippedCustomers.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-500 mb-3">
              Didn't Show ({skippedCustomers.length})
            </h2>
            <div className="space-y-2">
              {skippedCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-gray-400">
                        #{customer.number}
                      </span>
                      <div>
                        <p className="text-sm text-gray-500">
                          {customer.childName || customer.parentName}
                        </p>
                        {customer.childName && customer.parentName && (
                          <p className="text-xs text-gray-400">Parent: {customer.parentName}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">Said no</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {completedCustomers.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-gray-500 mb-3">
              Completed ({completedCustomers.length})
            </h2>
            <div className="space-y-2">
              {completedCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="bg-gray-50 border border-gray-200 rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-400">
                      #{customer.number}
                    </span>
                    <p className="text-sm text-gray-500">
                      {customer.childName || customer.parentName}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default ManageQueue;
