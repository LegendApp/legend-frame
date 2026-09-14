import { useSyncExternalStore } from "react";
import type { DocumentSession } from "./document";
/** React adapter for the document model shared by native window roots. */
export function useDocument(session: DocumentSession) {
  return useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
}
