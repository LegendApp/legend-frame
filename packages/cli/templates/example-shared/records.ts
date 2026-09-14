export interface RecordStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}
type Envelope = { format: 1; revision: number; data: string; checksum: string };
function checksum(text: string) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return (hash >>> 0).toString(16);
}
/** Alternating complete snapshots retain the previous version if a write is interrupted.
 * One writer per key in this JS runtime; not a cross-process database or encryption.
 */
export class Records<T> {
  private revision = 0;
  private loaded = false;
  private tail: Promise<void> = Promise.resolve();
  constructor(private storage: RecordStorage, private key: string, private decode: (value: unknown) => T) {}
  async load(): Promise<{ value: T | null; recovered: boolean }> {
    const raw = await Promise.all([0, 1].map(slot => this.storage.getItem(`${this.key}:${slot}`)));
    const valid: { revision: number; value: T }[] = [];
    let invalid = false;
    for (const text of raw) {
      if (text === null) continue;
      let item: Envelope;
      try {
        item = JSON.parse(text) as Envelope;
        if (item.format !== 1 || !Number.isSafeInteger(item.revision) || item.revision < 1 || typeof item.data !== "string" || item.checksum !== checksum(item.data)) throw new Error("Invalid record");
      } catch { invalid = true; continue; }
      // A valid envelope with an unknown application schema needs migration, not rollback.
      valid.push({ revision: item.revision, value: this.decode(JSON.parse(item.data)) });
    }
    valid.sort((a, b) => b.revision - a.revision);
    if (!valid.length && invalid) throw new Error("Stored data could not be read. It has been preserved; restore a backup before editing.");
    this.revision = valid[0]?.revision ?? 0;
    this.loaded = true;
    return { value: valid[0]?.value ?? null, recovered: invalid };
  }
  save(value: T): Promise<void> {
    // Serialize now so later edits cannot change an in-flight snapshot.
    const data = JSON.stringify(value);
    const write = this.tail.then(async () => {
      if (!this.loaded) throw new Error("Load records before saving");
      const revision = this.revision + 1;
      await this.storage.setItem(`${this.key}:${revision % 2}`, JSON.stringify({ format: 1, revision, data, checksum: checksum(data) }));
      this.revision = revision;
    });
    this.tail = write.catch(() => {});
    return write;
  }
}
