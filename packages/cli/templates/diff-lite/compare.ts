import { diffLines } from "diff";
export type DiffLine = { kind: "same" | "added" | "removed"; text: string; left: number | null; right: number | null };
export function compare(left: string, right: string): DiffLine[] {
  if (left.length + right.length > 400_000) throw new Error("Choose text files smaller than 200,000 characters each for this example.");
  const changes = diffLines(left, right, { timeout: 300 });
  if (!changes) throw new Error("These files take too long to compare. Try a smaller selection.");
  let a = 0, b = 0;
  return changes.flatMap(change => {
    const lines = change.value.split("\n"); if (lines.at(-1) === "") lines.pop();
    return lines.map(text => ({ kind: change.added ? "added" as const : change.removed ? "removed" as const : "same" as const, text, left: change.added ? null : ++a, right: change.removed ? null : ++b }));
  });
}
