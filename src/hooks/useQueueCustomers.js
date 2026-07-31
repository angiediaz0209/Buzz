import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Subscribes to the customers of the given queues, chunked for Firestore's
 * 30-value 'in' limit.
 *
 * Exists so callers don't have to trust `queue.waitingCount`: that field is
 * only refreshed while somebody has that queue's manage page open, so it can
 * read 0 while people are actually waiting. `waitingFor` counts real customer
 * docs where we have them and only falls back to the stored counter for
 * queues this hook wasn't asked to watch.
 *
 * @param {string[]} queueIds queue ids to watch
 */
export function useQueueCustomers(queueIds) {
  // Stable primitive key so we only resubscribe when the set really changes
  const key = [...queueIds].sort().join(',');
  const [customers, setCustomers] = useState([]);

  useEffect(() => {
    const ids = key ? key.split(',') : [];
    if (ids.length === 0) return;

    const chunks = [];
    for (let i = 0; i < ids.length; i += 30) {
      chunks.push(ids.slice(i, i + 30));
    }

    const byChunk = new Map();
    const unsubscribes = chunks.map((chunk, index) =>
      onSnapshot(
        query(collection(db, 'customers'), where('queueId', 'in', chunk)),
        (snapshot) => {
          byChunk.set(index, snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
          setCustomers(Array.from(byChunk.values()).flat());
        },
        (error) => console.error('Error loading queue customers:', error)
      )
    );

    return () => unsubscribes.forEach(unsub => unsub());
  }, [key]);

  const covered = new Set(key ? key.split(',') : []);

  return {
    customers,

    /** Customers belonging to one queue */
    forQueue: (queueId) => customers.filter(c => c.queueId === queueId),

    /** Whoever is in the chair right now, if anyone */
    servingIn: (queueId) =>
      customers.find(
        c => c.queueId === queueId && (c.status === 'called' || c.status === 'coming')
      ),

    /** Waiting customers for one queue, in call order */
    waitingListFor: (queueId) =>
      customers
        .filter(c => c.queueId === queueId && c.status === 'waiting')
        .sort((a, b) => (a.number || 0) - (b.number || 0)),

    /** Waiting count, preferring live docs over the stored counter */
    waitingFor: (queue) =>
      covered.has(queue.id)
        ? customers.filter(c => c.queueId === queue.id && c.status === 'waiting').length
        : queue.waitingCount || 0
  };
}

/** Display name for a customer across the old and new field shapes */
export const customerName = (c) => c?.name || c?.childName || c?.parentName || '';
