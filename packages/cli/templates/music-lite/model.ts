import type { AudioPlayer, AudioStatus } from "@legendapp/frame-audio";
export type Track = { id: string; name: string; uri: string };
export type Library = { version: 1; tracks: Track[]; currentId: string | null; position: number };
export function decodeLibrary(value: unknown): Library {
  const data = value as Library;
  if (data?.version !== 1 || !Array.isArray(data.tracks) || !data.tracks.every(track => track && typeof track.id === "string" && typeof track.name === "string" && typeof track.uri === "string") || !Number.isFinite(data.position) || data.position < 0 || (data.currentId !== null && typeof data.currentId !== "string")) throw new Error("Unsupported music library format");
  return data;
}
const stopped: AudioStatus = { playing: false, currentTime: 0, duration: 0, didJustFinish: false, error: null, volume: 1 };
export class MusicModel {
  private state = { version: 1 as const, tracks: [] as Track[], currentId: null as string | null, position: 0, status: stopped, ready: false, busy: false, dirty: false, error: null as string | null };
  private listeners = new Set<() => void>();
  private player?: AudioPlayer;
  private release?: () => void;
  private loading?: Promise<void>;
  private polling = false;
  private lastSave = 0;
  private finishedPlayback = false;
  private revision = 0;
  private activeOperation?: Promise<void>;
  private disposing?: Promise<void>;
  constructor(private records: { load(): Promise<{ value: Library | null; recovered: boolean }>; save(value: Library): Promise<void> }, private createPlayer: (track: Track) => Promise<{ player: AudioPlayer; release(): void }>) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<typeof this.state>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  private changed(patch: Partial<typeof this.state>) { this.revision++; this.update({ ...patch, dirty: true }); }
  load = () => this.loading ??= (async () => {
    try { const saved = await this.records.load(); this.update({ ...saved.value, ready: true, error: saved.recovered ? "Recovered the previous saved queue." : null }); }
    catch (error) { this.update({ error: String(error) }); }
  })();
  add = async (tracks: Track[]) => { if (!this.state.ready) return; const ids = new Set(this.state.tracks.map(track => track.id)); this.changed({ tracks: [...this.state.tracks, ...tracks.filter(track => !ids.has(track.id) && !!ids.add(track.id))] }); await this.flush(); };
  private async operation(action: () => Promise<void>) {
    if (this.disposing) await this.disposing;
    if (this.state.busy || !this.state.ready) return;
    this.update({ busy: true, error: null });
    const pending = action(); this.activeOperation = pending;
    try { await pending; } catch (error) { this.update({ error: String(error) }); }
    finally { this.activeOperation = undefined; this.update({ busy: false }); }
  }
  play = (id = this.state.currentId ?? this.state.tracks[0]?.id) => this.operation(async () => {
    const track = this.state.tracks.find(track => track.id === id); if (!track) return;
    if (!this.player || id !== this.state.currentId) {
      const next = await this.createPlayer(track);
      try { if (this.player) await this.player.remove(); } catch (error) { await next.player.remove(); next.release(); throw error; }
      this.release?.(); this.player = next.player; this.release = next.release;
      const position = id === this.state.currentId ? this.state.position : 0;
      this.changed({ currentId: id!, position, status: stopped });
      if (position > 0) await this.player.seekTo(position);
    }
    if (this.state.status.didJustFinish) await this.player.seekTo(0);
    this.finishedPlayback = false;
    await this.player.play(); await this.tick(); await this.flush();
  });
  pause = () => this.operation(async () => { await this.player?.pause(); await this.tick(); await this.flush(); });
  seek = (seconds: number) => this.operation(async () => { if (this.player) { await this.player.seekTo(Math.max(0, seconds)); await this.tick(); await this.flush(); } });
  next = () => { const index = this.state.tracks.findIndex(track => track.id === this.state.currentId); const track = this.state.tracks[index + 1]; return track ? this.play(track.id) : this.pause(); };
  tick = async () => {
    if (!this.player || this.polling) return;
    this.polling = true; const player = this.player;
    try {
      const status = await player.getStatus(); if (player !== this.player) return;
      if (status.currentTime !== this.state.position) this.changed({ position: status.currentTime });
      this.update({ status, ...(status.error ? { error: status.error } : {}) });
      if (status.didJustFinish && !this.state.busy && !this.finishedPlayback) { this.finishedPlayback = true; void this.next(); }
      if (Date.now() - this.lastSave > 5000) { this.lastSave = Date.now(); await this.flush(); }
    } catch (error) { this.update({ error: String(error) }); }
    finally { this.polling = false; }
  };
  flush = async () => {
    if (!this.state.ready) return false;
    if (!this.state.dirty) return true;
    try {
      while (this.state.dirty) {
        const revision = this.revision;
        const { tracks, currentId, position } = this.state;
        await this.records.save({ version: 1, tracks, currentId, position });
        if (revision === this.revision) this.update({ dirty: false });
      }
      return true;
    }
    catch (error) { this.update({ error: String(error) }); return false; }
  };
  dispose = () => this.disposing ??= (async () => {
    try {
      await this.activeOperation?.catch(() => {}); await this.flush();
      const player = this.player, release = this.release;
      this.player = undefined; this.release = undefined;
      try { await player?.remove(); } finally { release?.(); this.update({ status: stopped }); }
    } finally { this.disposing = undefined; }
  })();
}
