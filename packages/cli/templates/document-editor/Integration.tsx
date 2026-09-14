import { useEffect } from "react";
import { BackHandler } from "react-native";
import type { DocumentSession } from "./document";
export function Integration({ session }: { session: DocumentSession; windowId: string; documentId: string; onReady: (ready: boolean) => void }) {
  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!session.dirty) return false;
      void session.canClose().then(allow => { if (allow) BackHandler.exitApp(); }); return true;
    });
    return () => back.remove();
  }, [session]);
  return null;
}
