export type Theme = "system" | "light" | "dark";
export type Frame = { x: number; y: number; width: number; height: number };
export type SavedWindow = { id: string; noteId?: string; frame: Frame };
export function decodeWindows(value: unknown): SavedWindow[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every(item => item && typeof item.id === "string" && /^(main|settings|note-[a-zA-Z0-9_-]+)$/.test(item.id) && (item.noteId === undefined || typeof item.noteId === "string") && item.frame && ["x", "y", "width", "height"].every(key => Number.isFinite(item.frame[key])) && item.frame.width >= 100 && item.frame.height >= 100 && item.frame.width <= 20000 && item.frame.height <= 20000) || new Set(value.map(item => item.id)).size !== value.length) throw new Error("Unsupported window session");
  return value;
}
/** Both platforms return frames/work areas in their own matching coordinate system. */
export function fitFrame(frame: Frame, workAreas: Frame[]): Frame {
  if (!workAreas.length) return frame;
  const overlap = (area: Frame) => Math.max(0, Math.min(frame.x + frame.width, area.x + area.width) - Math.max(frame.x, area.x)) * Math.max(0, Math.min(frame.y + frame.height, area.y + area.height) - Math.max(frame.y, area.y));
  const area = workAreas.reduce((best, current) => overlap(current) > overlap(best) ? current : best);
  const width = Math.min(frame.width, area.width), height = Math.min(frame.height, area.height);
  return { x: Math.max(area.x, Math.min(frame.x, area.x + area.width - width)), y: Math.max(area.y, Math.min(frame.y, area.y + area.height - height)), width, height };
}
