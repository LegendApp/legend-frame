import { DocumentSession } from "./document";
import { io } from "./io";
// Secondary macOS roots share this JS heap and therefore the same document data.
export const sessions = new Map<string, DocumentSession>();
export function sessionFor(id: string) {
  if (!sessions.has(id)) sessions.set(id, new DocumentSession(io));
  return sessions.get(id)!;
}
