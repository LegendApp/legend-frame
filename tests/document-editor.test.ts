import { expect, test } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DocumentSession, type DocumentIO } from "../packages/cli/templates/document-editor/document.ts";
function fixture(overrides: Partial<DocumentIO> = {}) {
  return new DocumentSession({ open: async () => null, save: async file => ({ ...file, location: "/test.txt" }), confirmDiscard: async () => "cancel", ...overrides });
}
test("save records its snapshot; newer edits stay dirty", async () => {
  let complete!: () => void;
  const session = fixture({ save: async file => { await new Promise<void>(resolve => complete = resolve); return file; } });
  session.edit("first"); const pending = session.save(); session.edit("second"); complete();
  expect(await pending).toBe(true); expect(session.getSnapshot().savedText).toBe("first"); expect(session.dirty).toBe(true);
});
test("canceled and failed saves retain the document", async () => {
  const canceled = fixture({ save: async () => null }); canceled.edit("keep");
  expect(await canceled.save()).toBe(false); expect(canceled.dirty).toBe(true);
  const failed = fixture({ save: async () => { throw new Error("Disk full"); } }); failed.edit("keep");
  expect(await failed.save()).toBe(false); expect(failed.getSnapshot().error).toBe("Disk full"); expect(failed.getSnapshot().text).toBe("keep");
});
test("save-before-close cannot discard edits made during saving", async () => {
  let complete!: () => void;
  const session = fixture({ confirmDiscard: async () => "save", save: async file => { await new Promise<void>(resolve => complete = resolve); return file; } });
  session.edit("first"); const pending = session.canClose(); await Promise.resolve(); session.edit("newer"); complete();
  expect(await pending).toBe(false); expect(session.dirty).toBe(true);
});
test("editing in another window while an open dialog waits preserves those edits", async () => {
  let complete!: (value: { file: { name: string }; text: string }) => void;
  const session = fixture({ open: () => new Promise(resolve => complete = resolve) });
  const pending = session.open(); await Promise.resolve(); session.edit("keep"); complete({ file: { name: "other.txt" }, text: "replace" });
  expect(await pending).toBe(false); expect(session.getSnapshot().text).toBe("keep");
});
test("overlapping commands do not open a second dialog", async () => {
  let complete!: () => void;
  const session = fixture({ open: async () => { await new Promise<void>(resolve => complete = resolve); return null; } });
  const pending = session.open(); await Promise.resolve(); expect(await session.newDocument()).toBe(false); complete(); await pending;
  expect(session.getSnapshot().busy).toBe(false);
});
test("cancel and discard have distinct behavior", async () => {
  const canceled = fixture(); canceled.edit("keep"); expect(await canceled.newDocument()).toBe(false);
  const discarded = fixture({ confirmDiscard: async () => "discard" }); discarded.edit("remove"); expect(await discarded.newDocument()).toBe(true); expect(discarded.dirty).toBe(false);
});

test('mobile React Native codegen excludes desktop providers alongside Expo autolinking', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'frame-codegen-'));
  try {
    writeFileSync(path.join(root, 'app.json'), JSON.stringify({ expo: { platforms: ['ios'], autolinking: { exclude: ['@legendapp/frame-message-dialog'] } } }));
    const config = require('../packages/cli/src/universal.cjs').nativeConfig(root);
    expect(config.dependencies['@legendapp/frame-message-dialog'].platforms.ios).toBeNull();
    expect(config.dependencies['@legendapp/frame-message-dialog'].platforms.android).toBeNull();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
