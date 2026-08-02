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
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import {
  Eye, EyeOff, ArrowLeft, Phone, Clock, RefreshCw, X, Undo2, Check,
  ChevronRight, ChevronDown
} from 'lucide-react';
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
    // Last counter values written to the queue doc, so identical writes are skipped.
    let lastCounterSignature = null;
    const unsubscribeQueue = onSnapshot(
      doc(db, 'queues', queueId),
      async (queueDoc) => {
        if (!queueDoc.exists()) {
          toast.error('Queue not found');
          navigate('/dashboard');
          return;
        }

        const queueData = { id: queueDoc.id, ...queueDoc.data() };

        // Only the artist who owns a line may work it. Guest artists share an
        // event, not each other's queues — and every write here would be
        // rejected by the rules anyway, so failing early beats a page of
        // buttons that silently don't work.
        if (queueData.artistId && queueData.artistId !== currentUser.uid) {
          toast.error("That line belongs to another artist");
          navigate(`/event/${queueData.eventId}`);
          return;
        }

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

    // Sync queue doc counters from real data.
    //
    // This used to write on every single snapshot, which made the artist's open
    // ManageQueue tab an amplifier: one client joining fired a customers
    // snapshot here, which wrote the queue document, which pushed a queue
    // snapshot to every client phone, kiosk and display screen watching it.
    // Writing only when a count actually changed removes almost all of that
    // traffic — and the write is what clients feel, because it's their
    // connection it travels down.
    const waiting = customersData.filter(c => c.status === 'waiting').length;
    const completed = customersData.filter(c => c.status === 'completed').length;
    const skipped = customersData.filter(c => c.status === 'skipped').length;
    const signature = `${waiting}/${completed}/${skipped}`;

    if (signature !== lastCounterSignature) {
      lastCounterSignature = signature;
      try {
        await updateDoc(doc(db, 'queues', queueId), {
          waitingCount: waiting,
          totalServed: completed,
          skippedCount: skipped
        });
      } catch {
        // Non-critical — queue doc counter sync failed
        lastCounterSignature = null; // let the next snapshot retry
      }
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
      // One batch, one round trip. This used to be a sequential updateDoc per
      // person being served, then the call, then the queue — so the person
      // being called only found out on their phone after every completion
      // ahead of them had finished landing. Batching also makes it atomic:
      // there's no longer a window where the old turn is completed but the new
      // one was never called.
      const batch = writeBatch(db);

      for (const serving of currentlyServing) {
        batch.update(doc(db, 'customers', serving.id), {
          status: 'completed',
          completedAt: serverTimestamp()
        });
      }

      batch.update(doc(db, 'customers', nextCustomer.id), {
        status: 'called',
        calledAt: serverTimestamp()
      });

      batch.update(doc(db, 'queues', queueId), {
        currentNumber: nextCustomer.number
      });

      await batch.commit();

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
      // Batched for the same reasons as callNextNumber: one round trip, and an
      // undo can't half-apply.
      const batch = writeBatch(db);

      for (const serving of currentlyServing) {
        batch.update(doc(db, 'customers', serving.id), {
          status: 'waiting',
          calledAt: null
        });
      }

      batch.update(doc(db, 'customers', lastCompleted.id), {
        status: 'called',
        completedAt: null
      });

      batch.update(doc(db, 'queues', queueId), {
        currentNumber: lastCompleted.number
      });

      await batch.commit();

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

  // isVisible has existed on queues since creation but had no control after
  // that. It decides whether clients are offered this line at all — separate
  // from open/closed, which is whether it's currently taking people.
  const toggleQueueVisibility = async () => {
    const next = queue.isVisible === false;
    try {
      await updateDoc(doc(db, 'queues', queueId), { isVisible: next });
      toast.success(next ? 'Clients can pick this line' : 'Hidden from clients');
    } catch (error) {
      console.error('Error updating visibility:', error);
      toast.error('Failed to update visibility');
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
    <div className="min-h-screen bg-cream-100">
      {/* One line carries the name, the state and the counts. The three stat
          tiles that used to sit here repeated the section headings below them,
          and cost a third of the screen on a phone. */}
      <div className="bg-white shadow-sm border-b border-cream-200 sticky top-14 z-30">
        <div className="max-w-4xl mx-auto px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/event/${event.id}`)}
              className="text-stone-500 hover:text-ink-900 transition-colors shrink-0"
              aria-label="Back to event"
              title="Back to event"
            >
              <ArrowLeft size={18} />
            </button>

            <h1 className="text-lg font-extrabold text-ink-900 truncate">{queue.name}</h1>
            <span className="text-xs text-stone-500 truncate hidden sm:inline">{event.name}</span>

            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              <button
                onClick={toggleQueueVisibility}
                className={`p-1.5 rounded-full transition-colors ${
                  queue.isVisible === false
                    ? 'text-stone-400 hover:text-stone-600 hover:bg-cream-100'
                    : 'text-sage-600 hover:bg-sage-100'
                }`}
                title={
                  queue.isVisible === false
                    ? 'Hidden — clients are not offered this line'
                    : 'Clients can pick this line'
                }
                aria-label={
                  queue.isVisible === false ? 'Show this line to clients' : 'Hide this line from clients'
                }
              >
                {queue.isVisible === false ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>

              {/* The pill states what the line is doing; tapping it flips that */}
              <button
                onClick={toggleQueueStatus}
                className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-full transition-colors ${
                  queue.status === 'open'
                    ? 'bg-sage-100 text-sage-600 hover:bg-sage-200'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
                title={queue.status === 'open' ? 'Tap to stop taking people' : 'Tap to start taking people'}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    queue.status === 'open' ? 'bg-sage-500' : 'bg-red-500'
                  }`}
                />
                {queue.status === 'open' ? 'Open' : 'Closed'}
              </button>
            </div>
          </div>

          <p className="text-xs text-stone-500 mt-1">
            {/* Who's actually in the chair — currentNumber keeps the last number
                called even after that person is done */}
            Serving{' '}
            <span className="font-bold text-ink-900">
              {servingCustomers[0] ? `#${servingCustomers[0].number}` : '—'}
            </span>
            <span className="mx-1.5">·</span>
            <span className="font-bold text-ink-900">{waitingCustomers.length}</span> waiting
            <span className="mx-1.5">·</span>
            <span className="font-bold text-ink-900">{completedCustomers.length}</span> done
          </p>
        </div>
      </div>

      {/* Bottom padding clears the action bar, which is fixed above the mobile
          tab bar on phones and against the window edge from md up. */}
      <main className="max-w-4xl mx-auto px-4 pt-3 pb-32 md:pb-28">
        {servingCustomers.map((customer) => (
          <div
            key={customer.id}
            className={`rounded-xl px-4 py-3 mb-3 border-2 ${
              customer.status === 'coming'
                ? 'bg-blue-50 border-sage-300'
                : 'bg-sage-100 border-sage-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-sage-600 tabular-nums shrink-0">
                #{customer.number}
              </span>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-ink-900 truncate">
                  {customer.name || customer.childName || customer.parentName}
                </p>
                <p className="text-xs text-stone-600 truncate">
                  {customer.status === 'coming' && (
                    <span className="text-sage-600 font-semibold">On their way</span>
                  )}
                  {customer.status === 'coming' && customer.phone && ' · '}
                  {customer.phone}
                  {customer.childName && customer.parentName && ` · Parent: ${customer.parentName}`}
                </p>
              </div>

              <button
                onClick={() => resendNotification(customer)}
                className="p-2 bg-white/70 text-sage-600 rounded-lg hover:bg-white transition-colors shrink-0"
                title="Resend notification"
                aria-label="Resend notification"
              >
                <RefreshCw size={16} />
              </button>
              <button
                onClick={() => completeCustomer(customer)}
                className="flex items-center gap-1.5 px-3 py-2 bg-sage-500 text-white rounded-lg text-sm font-bold hover:bg-sage-600 transition-colors shrink-0"
                title="Mark as done"
              >
                <Check size={16} />
                Done
              </button>
            </div>
          </div>
        ))}

        {waitingCustomers.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center">
            <p className="text-stone-500">No one waiting</p>
          </div>
        ) : (
          <div className="space-y-2">
            {waitingCustomers.map((customer, index) => (
              <WaitingRow
                key={customer.id}
                customer={customer}
                isNext={index === 0}
                joinedAt={formatTime(customer.joinedAt)}
                onRemove={() => removeCustomer(customer)}
              />
            ))}
          </div>
        )}

        {/* History, out of the way. It used to render every person served, so a
            busy day buried the live list under dozens of finished rows. */}
        {(completedCustomers.length > 0 || skippedCustomers.length > 0) && (
          <div className="mt-4">
            {completedCustomers.length > 0 && (
              <Disclosure label="completed" count={completedCustomers.length}>
                {completedCustomers.map((customer) => (
                  <PastRow key={customer.id} customer={customer} />
                ))}
              </Disclosure>
            )}

            {skippedCustomers.length > 0 && (
              <Disclosure label="didn't show" count={skippedCustomers.length}>
                {skippedCustomers.map((customer) => (
                  <PastRow key={customer.id} customer={customer} note="Said no" />
                ))}
              </Disclosure>
            )}
          </div>
        )}
      </main>

      {/* The one control that gets pressed all night, always in thumb reach.
          The offset clears the mobile tab bar; from md up there isn't one. */}
      <div className="fixed left-0 right-0 z-40 bottom-[calc(3.9rem+env(safe-area-inset-bottom))] md:bottom-0 bg-white border-t border-cream-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex gap-3">
          <button
            onClick={callNextNumber}
            disabled={waitingCustomers.length === 0}
            className="flex-1 bg-honey-500 text-ink-900 py-4 rounded-xl font-extrabold text-lg shadow hover:bg-honey-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {servingCustomers.length > 0 ? 'Next number' : 'Call first number'}
          </button>
          <button
            onClick={goBack}
            disabled={completedCustomers.length === 0}
            className="px-5 bg-white border-2 border-cream-300 text-ink-700 rounded-xl font-semibold hover:bg-cream-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Undo last call"
            aria-label="Undo last call"
          >
            <Undo2 size={22} />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * A waiting row is a number and a name — that's what the artist scans for.
 * Phone, join time and Remove live behind a tap, which also puts the one
 * destructive control on this screen behind a deliberate action instead of
 * leaving it exposed on every row.
 */
function WaitingRow({ customer, isNext, joinedAt, onRemove }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full px-4 py-3 text-left flex items-center gap-3"
      >
        <span className="text-xl font-bold text-ink-900 tabular-nums shrink-0">
          #{customer.number}
        </span>
        <span className="font-semibold text-ink-900 flex-1 truncate">
          {customer.name || customer.childName || customer.parentName}
        </span>
        {isNext && (
          <span className="text-[10px] font-bold uppercase tracking-wide text-sage-600 bg-sage-100 px-2 py-0.5 rounded-full shrink-0">
            Next
          </span>
        )}
        <ChevronRight
          size={16}
          className={`text-stone-400 transition-transform shrink-0 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {open && (
        <div className="px-4 pb-3 -mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-stone-500">
          {customer.phone && (
            <a
              href={`tel:${customer.phone}`}
              className="flex items-center gap-1 hover:text-ink-900 transition-colors"
            >
              <Phone size={12} />
              {customer.phone}
            </a>
          )}
          <span className="flex items-center gap-1">
            <Clock size={12} />
            Joined {joinedAt}
          </span>
          {customer.childName && customer.parentName && (
            <span>Parent: {customer.parentName}</span>
          )}
          <button
            onClick={onRemove}
            className="ml-auto flex items-center gap-1 font-semibold text-red-400 hover:text-red-600 transition-colors"
          >
            <X size={12} />
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

/** Collapsed history — a count you can open, not a wall of finished rows. */
function Disclosure({ label, count, children }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-t border-cream-200">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full flex items-center justify-between py-3 text-sm font-semibold text-stone-500 hover:text-ink-700 transition-colors"
      >
        <span>
          {count} {label}
        </span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && <div className="pb-3">{children}</div>}
    </div>
  );
}

function PastRow({ customer, note }) {
  return (
    <div className="flex items-center gap-3 px-1 py-2 text-sm text-stone-500">
      <span className="font-bold text-stone-400 tabular-nums w-10 shrink-0">
        #{customer.number}
      </span>
      <span className="truncate">
        {customer.name || customer.childName || customer.parentName}
      </span>
      {note && <span className="ml-auto text-xs text-stone-400 shrink-0">{note}</span>}
    </div>
  );
}

export default ManageQueue;
