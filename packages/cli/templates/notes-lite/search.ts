const listeners = new Set<() => void>();
export function requestSearch() { for (const listener of listeners) listener(); }
export function onSearch(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
