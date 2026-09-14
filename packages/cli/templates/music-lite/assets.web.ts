import { projectId } from "./shared/identity";
import type { Track } from "./model";
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(`legend-music-${projectId}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("audio");
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
}
async function store(id: string, file: File) {
  const db = await database();
  try { await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction("audio", "readwrite"); transaction.objectStore("audio").put(file, id);
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error ?? new Error("Audio import was aborted"));
  }); } finally { db.close(); }
}
export async function importTracks(): Promise<Track[]> {
  const files = await new Promise<File[]>(resolve => {
    const input = document.createElement("input"); input.type = "file"; input.multiple = true; input.accept = "audio/*";
    input.oncancel = () => resolve([]); input.onchange = () => resolve(Array.from(input.files ?? [])); input.click();
  });
  const tracks: Track[] = [];
  for (const file of files) {
    const id = crypto.randomUUID(); await store(id, file); tracks.push({ id, uri: `library:${id}`, name: file.name });
  }
  return tracks;
}
export async function resolveTrack(track: Track) {
  const db = await database();
  try {
    const blob = await new Promise<Blob>((resolve, reject) => {
      const request = db.transaction("audio").objectStore("audio").get(track.id);
      request.onsuccess = () => request.result instanceof Blob ? resolve(request.result) : reject(new Error("Audio is missing from browser storage. Import the file again.")); request.onerror = () => reject(request.error);
    });
    const uri = URL.createObjectURL(blob); return { uri, release() { URL.revokeObjectURL(uri); } };
  } finally { db.close(); }
}
