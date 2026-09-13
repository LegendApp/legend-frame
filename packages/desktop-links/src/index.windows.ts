export type { OpenEvent, URLListener } from "./index";
const unavailable = (..._args: unknown[]): never => { throw Object.assign(new Error("Linking has no Windows backend yet"), { code: "E_UNAVAILABLE" }); };
const unavailableAsync = async (...args: unknown[]): Promise<never> => unavailable(...args);
export const openURL = unavailableAsync, canOpenURL = unavailableAsync, getInitialURL = unavailableAsync;
export const onOpen = unavailableAsync, noteRecentDocument = unavailableAsync, clearRecentDocuments = unavailableAsync, getRecentDocuments = unavailableAsync;
export const addEventListener = unavailable;
