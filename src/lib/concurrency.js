/**
 * Runs `worker` over every item in `items`, but never more than `limit`
 * calls in flight at once.
 *
 * The trick: start exactly `limit` independent "worker" loops. Each one
 * repeatedly claims the next unclaimed item (via the shared `nextIndex`
 * counter) and awaits the work for it, then loops back for another —
 * so a fast module frees up a slot immediately, rather than everything
 * waiting in lockstep batches of `limit`.
 *
 * @template T
 * @param {T[]} items
 * @param {number} limit
 * @param {(item: T) => Promise<void>} worker
 */
export async function runWithConcurrencyLimit(items, limit, worker) {
  let nextIndex = 0;

  async function runNext() {
    const index = nextIndex++;
    if (index >= items.length) return;
    await worker(items[index]);
    return runNext();
  }

  const workerCount = Math.min(limit, items.length);
  await Promise.all(Array.from({ length: workerCount }, runNext));
}
