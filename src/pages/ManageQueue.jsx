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
import { ArrowLeft, Phone, Mail, Clock, RefreshCw, X, Undo2, Check } from 'lucide-react';
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

    // Real-time listener for the queue, so "Now Serving" and the open/closed
    // state stay current while numbers are being called
    let loadedEventFor = null;
    const unsubscribeQueue = onSnapshot(
      doc(db, 'queues', queueId),
      async (queueDoc) => {
        if (!queueDoc.exists()) {
          toast.error('Queue not found');
          navigate('/dashboard');
          return;
        }

        const queueData = { id: queueDoc.id, ...queueDoc.data() };
        setQueue(queueData);
        setLoading(false);

        // Load event details once — they don't change as numbers are called
        if (queueData.eventId && loadedEventFor !== queueData.eventId) {
          loadedEventFor = queueData.eventId;
          const eventDoc = await getDoc(doc(db, 'events', queueData.eventId));
          if (eventDoc.exists()) {
            setEvent({ id: eventDoc.id, ...eventDoc.data() });
          }
        }
      },
      (error) => {
        console.error('Error loading queue:', error);
        toast.error('Failed to load queue');
        setLoading(false);
      }
    );

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
    } catch {
      // Non-critical — queue doc counter sync failed
    }
    });

    return () => {
      unsubscribeQueue();
      unsubscribe();
    };
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

      toast.success(`Called #${nextCustomer.number} - ${nextCustomer.name || nextCustomer.childName || nextCustomer.parentName}`);

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

      toast.success(`Restored #${lastCompleted.number} - ${lastCompleted.name || lastCompleted.childName || lastCompleted.parentName}`);

    } catch (error) {
      console.error('Error going back:', error);
      toast.error('Failed to go back');
    }
  };

  // Mark the person in the chair as done without needing to call someone else.
  // Without this, the last customer of the day never counts as completed.
  const completeCustomer = async (customer) => {
    try {
      await updateDoc(doc(db, 'customers', customer.id), {
        status: 'completed',
        completedAt: serverTimestamp()
      });
      toast.success(`#${customer.number} done`);
    } catch (error) {
      console.error('Error completing customer:', error);
      toast.error('Failed to mark as done');
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

    const recipientName = customer.name || customer.childName || customer.parentName || "there";
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
    if (!confirm(`Remove ${customer.name || customer.childName || customer.parentName} from queue?`)) return;

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
      <div className="min-h-screen bg-cream-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-honey-500"></div>
          <p className="mt-4 text-stone-600">Loading queue...</p>
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
    <div className="min-h-screen bg-cream-100 pb-20">
      {/* Queue Controls */}
      <div className="bg-white shadow-sm border-b border-cream-200 sticky top-14 z-10">
        <div className="max-w-4xl mx-auto px-4 py-3">
          <button
            onClick={() => navigate(`/event/${event.id}`)}
            className="flex items-center gap-2 text-stone-600 hover:text-ink-900 transition-colors text-sm mb-2"
          >
            <ArrowLeft size={16} />
            <span>Back to Event</span>
          </button>

          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-ink-900">{queue.name}</h1>
              <p className="text-sm text-stone-600">{event.name}</p>
            </div>

            <button
              onClick={toggleQueueStatus}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                queue.status === 'open'
                  ? 'bg-sage-100 text-sage-600 hover:bg-green-200'
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
            <p className="text-sm text-stone-600">Now Serving</p>
            <p className="text-3xl font-bold text-ink-900">
              {/* Who's actually in the chair — currentNumber keeps the last
                  number called even after that person is done */}
              {servingCustomers[0] ? `#${servingCustomers[0].number}` : '—'}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-sm text-stone-600">Waiting</p>
            <p className="text-3xl font-bold text-sage-500">
              {waitingCustomers.length}
            </p>
          </div>
          <div className="bg-white rounded-xl shadow p-4 text-center">
            <p className="text-sm text-stone-600">Completed</p>
            <p className="text-3xl font-bold text-ink-700">
              {completedCustomers.length}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 mb-6">
          <button
            onClick={callNextNumber}
            disabled={waitingCustomers.length === 0}
            className="flex-1 bg-honey-500 text-ink-900 py-5 rounded-xl font-bold text-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {servingCustomers.length > 0 ? 'Next Number' : 'Call First Number'}
          </button>
          <button
            onClick={goBack}
            disabled={completedCustomers.length === 0}
            className="px-5 py-5 bg-white border-2 border-cream-300 text-ink-700 rounded-xl font-semibold hover:bg-cream-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo last call"
          >
            <Undo2 size={24} />
          </button>
        </div>

        {/* Currently Serving */}
        {servingCustomers.length > 0 && (
          <div className="mb-6">
            <h2 className="text-lg font-bold text-ink-900 mb-3">Currently Serving</h2>
            {servingCustomers.map((customer) => (
              <div
                key={customer.id}
                className={`rounded-xl p-4 mb-3 ${
                  customer.status === 'coming'
                    ? 'bg-blue-50 border-2 border-sage-300'
                    : 'bg-sage-100 border-2 border-sage-300'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-3xl font-bold ${
                        customer.status === 'coming' ? 'text-sage-600' : 'text-sage-600'
                      }`}>
                        #{customer.number}
                      </span>
                      <div>
                        <p className="font-bold text-ink-900">
                          {customer.name || customer.childName || customer.parentName}
                        </p>
                        {customer.childName && customer.parentName && (
                          <p className="text-sm text-stone-600">Parent: {customer.parentName}</p>
                        )}
                        {customer.status === 'coming' && (
                          <p className="text-xs text-sage-600 font-semibold mt-1">On their way</p>
                        )}
                      </div>
                    </div>

                    {customer.phone && (
                      <div className="flex items-center gap-2 text-sm text-stone-600">
                        <Phone size={14} />
                        <span>{customer.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => completeCustomer(customer)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-sage-500 text-white rounded-lg text-sm font-semibold hover:bg-sage-600 transition-colors"
                      title="Mark as done"
                    >
                      <Check size={16} />
                      Done
                    </button>
                    <button
                      onClick={() => resendNotification(customer)}
                      className="px-3 py-2 bg-sage-100 text-sage-600 rounded-lg text-sm font-medium hover:bg-sage-200"
                      title="Resend notification"
                      aria-label="Resend notification"
                    >
                      <RefreshCw size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Waiting Queue */}
        <div className="mb-6">
          <h2 className="text-lg font-bold text-ink-900 mb-3">
            Waiting ({waitingCustomers.length})
          </h2>

          {waitingCustomers.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <p className="text-stone-500">No customers waiting</p>
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
                      <span className="text-2xl font-bold text-ink-900">
                        #{customer.number}
                      </span>
                      <div className="flex-1">
                        <p className="font-semibold text-ink-900">
                          {customer.name || customer.childName || customer.parentName}
                        </p>
                        {customer.childName && customer.parentName && (
                          <p className="text-sm text-stone-600">Parent: {customer.parentName}</p>
                        )}

                        <div className="flex flex-wrap gap-3 mt-2 text-xs text-stone-500">
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
                          <p className="text-xs text-sage-600 font-semibold mt-2">
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
            <h2 className="text-lg font-bold text-stone-500 mb-3">
              Didn't Show ({skippedCustomers.length})
            </h2>
            <div className="space-y-2">
              {skippedCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="bg-cream-50 border border-cream-200 rounded-xl p-3"
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-stone-400">
                        #{customer.number}
                      </span>
                      <div>
                        <p className="text-sm text-stone-500">
                          {customer.name || customer.childName || customer.parentName}
                        </p>
                        {customer.childName && customer.parentName && (
                          <p className="text-xs text-stone-400">Parent: {customer.parentName}</p>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-stone-400">Said no</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed */}
        {completedCustomers.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-stone-500 mb-3">
              Completed ({completedCustomers.length})
            </h2>
            <div className="space-y-2">
              {completedCustomers.map((customer) => (
                <div
                  key={customer.id}
                  className="bg-cream-50 border border-cream-200 rounded-xl p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-stone-400">
                      #{customer.number}
                    </span>
                    <p className="text-sm text-stone-500">
                      {customer.name || customer.childName || customer.parentName}
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
