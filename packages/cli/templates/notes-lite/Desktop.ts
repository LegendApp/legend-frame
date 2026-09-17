export const desktop = false;
export async function openNote(_noteId: string) {}
export async function showNotebook() {}
export async function openSettings() {}
export async function restoreSession() {}
export async function flushSession() { return true; }
export function watchSession(_onError: (message: string) => void) { return { remove() {} }; }
