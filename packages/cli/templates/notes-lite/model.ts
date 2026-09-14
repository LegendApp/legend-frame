export type Note = { id: string; text: string; updatedAt: number; deleted: boolean };
export type Notebook = { version: 1; notes: Note[]; selectedId: string | null };
export function decodeNotebook(value: unknown): Notebook {
  const data = value as Notebook;
  if (data?.version !== 1 || !Array.isArray(data.notes) || !data.notes.every(note => note && typeof note.id === "string" && typeof note.text === "string" && Number.isFinite(note.updatedAt) && typeof note.deleted === "boolean") || new Set(data.notes.map(note => note.id)).size !== data.notes.length || (data.selectedId !== null && typeof data.selectedId !== "string")) throw new Error("Unsupported notes format");
  return data;
}
export type NotesState = Notebook & { ready: boolean; dirty: boolean; saving: boolean; error: string | null; recovered: boolean };
export class NotesModel {
  private state: NotesState = { version: 1, notes: [], selectedId: null, ready: false, dirty: false, saving: false, error: null, recovered: false };
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | undefined;
  private revision = 0;
  private loading?: Promise<void>;
  private saving?: Promise<boolean>;
  constructor(private records: { load(): Promise<{ value: Notebook | null; recovered: boolean }>; save(value: Notebook): Promise<void> }) {}
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.state;
  private update(patch: Partial<NotesState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  load = () => this.loading ??= (async () => {
    try { const saved = await this.records.load(); this.update({ ...saved.value, ready: true, recovered: saved.recovered }); }
    catch (error) { this.update({ error: String(error) }); }
  })();
  private change(patch: Partial<Notebook>) {
    if (!this.state.ready) return;
    this.revision++; this.update({ ...patch, dirty: true });
    clearTimeout(this.timer); this.timer = setTimeout(() => { void this.flush(); }, 250);
  }
  create = (text = "") => {
    if (!this.state.ready) return;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
    this.change({ notes: [{ id, text, updatedAt: Date.now(), deleted: false }, ...this.state.notes], selectedId: id });
  };
  select = (selectedId: string | null) => { if (selectedId !== this.state.selectedId) this.change({ selectedId }); };
  edit = (id: string, text: string) => {
    const note = this.state.notes.find(item => item.id === id);
    if (!note || note.text === text || note.deleted) return;
    this.change({ notes: this.state.notes.map(item => item.id === id ? { ...item, text, updatedAt: Date.now() } : item) });
  };
  setDeleted = (id: string, deleted: boolean) => this.change({ notes: this.state.notes.map(note => note.id === id ? { ...note, deleted, updatedAt: Date.now() } : note), selectedId: null });
  flush = (): Promise<boolean> => {
    clearTimeout(this.timer);
    if (this.saving) return this.saving.then(ok => ok ? this.flush() : false);
    if (!this.state.ready) return Promise.resolve(false);
    if (!this.state.dirty) return Promise.resolve(true);
    const revision = this.revision;
    const { notes, selectedId } = this.state;
    this.update({ saving: true, error: null });
    this.saving = this.records.save({ version: 1, notes, selectedId }).then(() => {
      this.update({ dirty: revision !== this.revision }); return true;
    }, error => { this.update({ error: String(error) }); return false; }).finally(() => { this.saving = undefined; this.update({ saving: false }); });
    return this.saving.then(ok => ok && this.state.dirty ? this.flush() : ok);
  };
}
export const title = (note: Note) => note.text.split("\n").find(line => line.trim())?.replace(/^#+\s*/, "").slice(0, 80) || "Untitled note";
