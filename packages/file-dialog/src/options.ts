import type { FileDialogOpenOptions, FileDialogSaveOptions } from "./index";
function invalid(message: string, code = "E_INVALID_ARGUMENT"): never { throw Object.assign(new Error(message), { code }); }
export function validateDialogOptions(options: FileDialogOpenOptions | FileDialogSaveOptions, windows: boolean) {
  for (const [name, value] of Object.entries(options)) {
    if (value === undefined || value === null) continue;
    if (["canChooseFiles", "canChooseDirectories", "allowsMultipleSelection"].includes(name)) {
      if (typeof value !== "boolean") invalid(`${name} must be boolean`);
    } else if (name === "allowedFileTypes") {
      if (!Array.isArray(value) || value.some(type => typeof type !== "string" || !type || /[\0*;\\/]/.test(type))) invalid("Invalid file type filter");
    } else if (!["directoryURL", "directory", "prompt", "message", "title", "defaultName"].includes(name) || typeof value !== "string" || value.includes("\0")) invalid(`Invalid dialog option: ${name}`);
  }
  const open = options as FileDialogOpenOptions;
  if (open.canChooseFiles === false && !open.canChooseDirectories) invalid("Choose files or directories");
  if (windows && open.canChooseDirectories && open.canChooseFiles !== false)
    invalid("Windows cannot select files and directories together; set canChooseFiles: false for folders", "E_UNSUPPORTED_OPTION");
}
