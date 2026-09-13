import type { SelectProps } from "./types";
export function selectionIndex(options: SelectProps["options"], value: string) {
  if (!options.length || new Set(options.map(option => option.value)).size !== options.length) throw new Error("Select options must be nonempty with unique values");
  const index = options.findIndex(option => option.value === value);
  if (index < 0) throw new Error("Select value must match an option");
  return index;
}
