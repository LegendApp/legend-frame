import { useEffect } from "react";
import type { LifecycleProps } from "./lifecycle-types";
export function Lifecycle({ title, dirty, flush, commands }: LifecycleProps) {
  useEffect(() => { document.title = title; }, [title]);
  useEffect(() => {
    const close = (event: BeforeUnloadEvent) => { if (dirty()) { event.preventDefault(); event.returnValue = ""; } };
    const background = () => { if (document.visibilityState === "hidden") void flush(); };
    const key = (event: KeyboardEvent) => {
      if (event.isComposing || event.altKey || !(event.metaKey || event.ctrlKey)) return;
      const command = commands.find(command => {
        const parts = command.key.toLowerCase().split("+");
        return parts.includes("shift") === event.shiftKey && parts.at(-1) === event.key.toLowerCase();
      });
      if (command) { event.preventDefault(); command.run(); }
    };
    window.addEventListener("beforeunload", close); window.addEventListener("keydown", key); document.addEventListener("visibilitychange", background);
    return () => { window.removeEventListener("beforeunload", close); window.removeEventListener("keydown", key); document.removeEventListener("visibilitychange", background); };
  }, [dirty, flush, commands]);
  return null;
}
