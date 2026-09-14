import type { DocumentIO } from "./document";
export const io: DocumentIO = {
  open: () => new Promise((resolve, reject) => {
    const input = document.createElement("input"); input.type = "file"; input.accept = ".txt,.md,.json,text/plain";
    input.oncancel = () => resolve(null);
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      if (file.size > 8 * 1024 * 1024) { reject(new Error("Choose a text file smaller than 8 MB")); return; }
      void file.text().then(text => resolve({ file: { name: file.name }, text }), reject);
    };
    input.click();
  }),
  async save(file, text) {
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = file.name; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return { name: file.name };
  },
  async confirmDiscard(name) { return window.confirm(`Discard unsaved changes to ${name}? Choose Cancel to return and save.`) ? "discard" : "cancel"; },
};
