import { Button } from "@legend-apps/ui";
import { openWindow } from "@legend-apps/desktop-windows";
let next = 0;
export function Secondary({ noteId, onError }: { noteId: string; onError(message: string): void }) {
  return <Button onPress={() => { void openWindow({ id: `note-${++next}`, title: "Notes", width: 700, height: 600, props: { noteId } }).catch(error => onError(String(error))); }}>Open another view</Button>;
}
