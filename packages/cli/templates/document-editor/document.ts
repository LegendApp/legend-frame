export type FileReference = { name: string; location?: string; handle?: unknown };
export type DocumentState = { text: string; savedText: string; file: FileReference; busy: boolean; error: string | null; revision: number };
export type DocumentIO = {
  open(): Promise<{ file: FileReference; text: string } | null>;
  save(file: FileReference, text: string, expected: string, saveAs: boolean): Promise<FileReference | null>;
  confirmDiscard(name: string): Promise<"save" | "discard" | "cancel">;
};
/** One document model is shared by its windows; I/O always works on a snapshot. */
export class DocumentSession {
  private state: DocumentState = { text: "", savedText: "", file: { name: "Untitled.txt" }, busy: false, error: null, revision: 0 };
  private listeners = new Set<() => void>();
  private active = false;
  constructor(readonly io: DocumentIO) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private update(patch: Partial<DocumentState>) { this.state = { ...this.state, ...patch }; for (const listener of this.listeners) listener(); }
  edit = (text: string) => { if (text !== this.state.text) this.update({ text, revision: this.state.revision + 1 }); };
  get dirty() { return this.state.text !== this.state.savedText; }
  private async operation(action: () => Promise<boolean>) {
    if (this.active) return false;
    this.active = true; this.update({ busy: true, error: null });
    try { return await action(); }
    catch (error) { this.update({ error: error instanceof Error ? error.message : String(error) }); return false; }
    finally { this.active = false; this.update({ busy: false }); }
  }
  private async saveSnapshot(saveAs: boolean) {
    const snapshot = this.state;
    const file = await this.io.save(snapshot.file, snapshot.text, snapshot.savedText, saveAs);
    if (!file) return false;
    // Edits typed during an asynchronous save remain dirty.
    this.update({ file, savedText: snapshot.text }); return true;
  }
  save = (saveAs = false) => this.operation(() => this.saveSnapshot(saveAs));
  private async mayReplace() {
    if (!this.dirty) return true;
    const revision = this.state.revision;
    const answer = await this.io.confirmDiscard(this.state.file.name);
    if (answer === "cancel") return false;
    if (answer === "save") return await this.saveSnapshot(false) && !this.dirty;
    return revision === this.state.revision;
  }
  canClose = () => this.operation(() => this.mayReplace());
  newDocument = () => this.operation(async () => {
    if (!await this.mayReplace()) return false;
    this.update({ text: "", savedText: "", file: { name: "Untitled.txt" }, revision: this.state.revision + 1 }); return true;
  });
  open = () => this.operation(async () => {
    if (!await this.mayReplace()) return false;
    const revision = this.state.revision;
    const loaded = await this.io.open();
    if (!loaded || revision !== this.state.revision) return false;
    this.update({ file: loaded.file, text: loaded.text, savedText: loaded.text, revision: revision + 1 }); return true;
  });
  load = (file: FileReference, text: string) => this.operation(async () => {
    if (!await this.mayReplace()) return false;
    this.update({ file, text, savedText: text, revision: this.state.revision + 1 }); return true;
  });
}
