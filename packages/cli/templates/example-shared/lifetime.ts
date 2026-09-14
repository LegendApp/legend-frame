type Subscription = { remove(): void | Promise<void> };
const lifetimes = new Map<string, Promise<void>>();
/** Serialize teardown/re-registration across Strict Mode and Fast Refresh. */
export function mountSerial(key: string, setup: (retain: (item: Promise<Subscription>) => Promise<void>) => Promise<void>, onError: (message: string) => void) {
  const previous = lifetimes.get(key) ?? Promise.resolve();
  let finished!: () => void;
  const closed = new Promise<void>(resolve => { finished = resolve; });
  lifetimes.set(key, closed);
  let removed = false;
  const subscriptions: Subscription[] = [];
  const ready = previous.then(async () => {
    if (removed) return;
    await setup(async item => { const subscription = await item; if (removed) await subscription.remove(); else subscriptions.push(subscription); });
  }).catch(error => onError(String(error)));
  return () => {
    if (removed) return;
    removed = true;
    void ready.then(async () => {
      try { for (const subscription of subscriptions.reverse()) { try { await subscription.remove(); } catch (error) { onError(String(error)); } } }
      finally { finished(); if (lifetimes.get(key) === closed) lifetimes.delete(key); }
    });
  };
}
