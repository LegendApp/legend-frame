import { records } from "./shared/storage";
import { decodeNotebook, NotesModel } from "./model";
export const notes = new NotesModel(records("notes", decodeNotebook));
export const dirty = () => notes.getSnapshot().dirty;
