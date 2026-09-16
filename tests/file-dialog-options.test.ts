import { expect, test } from "bun:test";
import { validateDialogOptions } from "../packages/file-dialog/src/options";
test("file picker preserves mixed selection on macOS and rejects it explicitly on Windows", () => {
  expect(() => validateDialogOptions({ canChooseFiles: true, canChooseDirectories: true }, false)).not.toThrow();
  expect(() => validateDialogOptions({ canChooseDirectories: true }, true)).toThrow("cannot select files and directories together");
  expect(() => validateDialogOptions({ canChooseFiles: false, canChooseDirectories: true }, true)).not.toThrow();
  expect(() => validateDialogOptions({ canChooseFiles: false }, true)).toThrow("Choose files or directories");
});
test("dialog options validate strings and filters before opening native UI", () => {
  expect(() => validateDialogOptions({ directoryURL: "file:///C:/Users", prompt: "Choose", message: "Select a document", allowedFileTypes: ["txt"] }, true)).not.toThrow();
  expect(() => validateDialogOptions({ directory: "C:\\Users\0" }, true)).toThrow();
  expect(() => validateDialogOptions({ allowedFileTypes: ["txt;*"] }, true)).toThrow();
});
