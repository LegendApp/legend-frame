import { useEffect } from "react";
import type { DocumentSession } from "./document";
export function Integration({ session }: { session: DocumentSession; windowId: string; documentId: string; onReady: (ready: boolean) => void }) {
  useEffect(() => {
    const unload = (event: BeforeUnloadEvent) => { if (session.dirty) { event.preventDefault(); event.returnValue = ""; } };
    const key = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !["s", "o"].includes(event.key.toLowerCase())) return;
      event.preventDefault(); if (event.key.toLowerCase() === "s") void session.save(event.shiftKey); else void session.open();
    };
    window.addEventListener("beforeunload", unload); window.addEventListener("keydown", key);
    return () => { window.removeEventListener("beforeunload", unload); window.removeEventListener("keydown", key); };
  }, [session]);
  return null;
}
