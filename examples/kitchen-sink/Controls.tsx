import type { ComponentProps } from "react";
import { Button as NativeButton } from "@legendapp/spark/ui/uniwind";

// Leave room for the kitchen sink's descriptive action labels.
export function Button(props: ComponentProps<typeof NativeButton>) {
  return <NativeButton className="w-72 max-w-full" {...props} />;
}
