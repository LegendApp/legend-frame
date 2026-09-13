export { openURL, canOpenURL, getInitialURL, addEventListener } from "expo-linking";
export type { OpenEvent, URLListener } from "./index";
/** Legacy desktop facilities have no shared equivalent. */
const unavailable = async (..._args: unknown[]): Promise<never> => { throw Object.assign(new Error("Desktop document events/history are unavailable on this platform; use URL events instead"), { code: "E_UNAVAILABLE" }); };
export const onOpen = unavailable, noteRecentDocument = unavailable, clearRecentDocuments = unavailable, getRecentDocuments = unavailable;
