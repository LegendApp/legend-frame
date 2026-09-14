import { useEffect } from "react";
import { AppState, BackHandler } from "react-native";
import type { LifecycleProps } from "./lifecycle-types";
export function Lifecycle({ flush, dirty }: LifecycleProps) {
  useEffect(() => {
    const state = AppState.addEventListener("change", state => { if (state !== "active") void flush(); });
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (!dirty()) return false;
      void flush().then(ok => { if (ok && !dirty()) BackHandler.exitApp(); }); return true;
    });
    return () => { state.remove(); back.remove(); };
  }, [flush, dirty]);
  return null;
}
