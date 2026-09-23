import { createAudioPlayer } from "@legendapp/spark/audio";
import { records } from "./shared/storage";
import { resolveTrack } from "./assets";
import { MusicModel, decodeLibrary } from "./model";
export const music = new MusicModel(records("music", decodeLibrary), async track => {
  const source = await resolveTrack(track);
  try { return { player: await createAudioPlayer({ uri: source.uri, title: track.name }), release: source.release }; }
  catch (error) { source.release(); throw error; }
});
export const dirty = () => music.getSnapshot().dirty;
