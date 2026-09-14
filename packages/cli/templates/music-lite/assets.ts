import * as Picker from "expo-document-picker";
import * as Files from "expo-file-system/legacy";
import type { Track } from "./model";
export async function importTracks(): Promise<Track[]> {
  const result = await Picker.getDocumentAsync({ type: "audio/*", multiple: true, copyToCacheDirectory: true });
  if (result.canceled) return [];
  if (!Files.documentDirectory) throw new Error("App document storage is unavailable");
  const directory = `${Files.documentDirectory}music/`;
  await Files.makeDirectoryAsync(directory, { intermediates: true });
  const tracks: Track[] = [];
  for (const asset of result.assets) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const uri = `${directory}${id}-${asset.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    await Files.copyAsync({ from: asset.uri, to: uri }); tracks.push({ id, name: asset.name, uri });
  }
  return tracks;
}
export const resolveTrack = async (track: Track) => ({ uri: track.uri, release() {} });
