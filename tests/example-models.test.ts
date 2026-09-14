import { describe, expect, test } from "bun:test";
import { Records } from "../packages/cli/templates/example-shared/records";
import { NotesModel, decodeNotebook } from "../packages/cli/templates/notes-lite/model";
function memory() { const map = new Map<string, string>(); return { map, getItem: async (key: string) => map.get(key) ?? null, setItem: async (key: string, value: string) => { map.set(key, value); } }; }
describe("example persistence", () => {
  test("recovers a preceding snapshot without discarding corrupt data", async () => {
    const storage = memory(); const records = new Records(storage, "notes", decodeNotebook); await records.load();
    const first = { version: 1 as const, notes: [], selectedId: null }; await records.save(first); await records.save(first);
    storage.map.set("notes:0", "broken");
    expect(await new Records(storage, "notes", decodeNotebook).load()).toEqual({ value: first, recovered: true });
    expect(storage.map.get("notes:0")).toBe("broken");
  });
  test("unreadable storage does not become an empty notebook", async () => {
    const storage = memory(); storage.map.set("notes:1", "broken");
    const model = new NotesModel(new Records(storage, "notes", decodeNotebook)); await model.load(); model.create("must not overwrite");
    expect(model.getSnapshot().ready).toBe(false); expect(await model.flush()).toBe(false); expect(storage.map.get("notes:1")).toBe("broken");
  });
  test("autosave retains edits made while an earlier snapshot is being saved", async () => {
    let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); const snapshots: any[] = [];
    const model = new NotesModel({ load: async () => ({ value: null, recovered: false }), save: async value => { snapshots.push(value); if (snapshots.length === 1) await gate; } });
    await model.load(); model.create("first"); const id = model.getSnapshot().selectedId!;
    const saving = model.flush(); model.edit(id, "second"); release(); expect(await saving).toBe(true);
    expect(snapshots.at(-1).notes[0].text).toBe("second"); expect(model.getSnapshot().dirty).toBe(false);
  });
  test("failed saves remain dirty and can be retried", async () => {
    let fail = true; const model = new NotesModel({ load: async () => ({ value: null, recovered: false }), save: async () => { if (fail) throw Error("disk full"); } });
    await model.load(); model.create("keep me"); expect(await model.flush()).toBe(false); expect(model.getSnapshot().dirty).toBe(true);
    fail = false; expect(await model.flush()).toBe(true); expect(model.getSnapshot().dirty).toBe(false);
  });
  test("delete and restore survive reopening", async () => {
    const storage = memory(); const model = new NotesModel(new Records(storage, "notes", decodeNotebook)); await model.load(); model.create("recover me");
    const id = model.getSnapshot().selectedId!; model.setDeleted(id, true); await model.flush();
    const reopened = new NotesModel(new Records(storage, "notes", decodeNotebook)); await reopened.load(); expect(reopened.getSnapshot().notes[0]?.deleted).toBe(true);
    reopened.setDeleted(id, false); await reopened.flush(); expect(reopened.getSnapshot().notes[0]?.text).toBe("recover me");
  });
});

import { mountSerial } from '../packages/cli/templates/example-shared/lifetime';
test('Strict Mode remount waits for asynchronous guard teardown', async () => {
  const calls: string[] = []; let finish!: () => void;
  const gate = new Promise<void>(resolve => { finish = resolve; });
  const first = mountSerial('test-window', async retain => { calls.push('first'); await retain(Promise.resolve({ remove: async () => { calls.push('remove-first'); await gate; } })); }, message => { throw Error(message); });
  await new Promise(resolve => setTimeout(resolve, 0)); first();
  const second = mountSerial('test-window', async () => { calls.push('second'); }, message => { throw Error(message); });
  await new Promise(resolve => setTimeout(resolve, 0)); expect(calls).toEqual(['first','remove-first']); finish();
  await new Promise(resolve => setTimeout(resolve, 0)); expect(calls).toEqual(['first','remove-first','second']); second();
});

test('a newer application schema is preserved for migration instead of silently rolled back', async () => {
  const storage = memory();
  const writer = new Records<unknown>(storage, 'future', value => value); await writer.load();
  await writer.save({ version: 1, notes: [], selectedId: null });
  await writer.save({ version: 2, notes: [], selectedId: null });
  await expect(new Records(storage, 'future', decodeNotebook).load()).rejects.toThrow('Unsupported');
});
