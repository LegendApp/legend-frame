import { useSyncExternalStore } from "react";
export interface Model<T> { subscribe(listener: () => void): () => void; getSnapshot(): T }
/** React adapter for these examples' external application models. */
export function useModel<T>(model: Model<T>): T {
  return useSyncExternalStore(model.subscribe, model.getSnapshot, model.getSnapshot);
}
