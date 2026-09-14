import { useRef, useState, type ComponentProps } from "react";
import { Text, View } from "react-native";
import { Button } from "./Controls";

type Props = Omit<ComponentProps<typeof Button>, "onPress" | "className" | "style"> & {
  onPress: () => unknown | Promise<unknown>;
};

// Example-only feedback; the framework Button keeps its ordinary React contract.
export function ActionButton({ onPress, disabled, ...props }: Props) {
  const running = useRef(false);
  const [feedback, setFeedback] = useState<{ state: "pending" | "success" | "error"; text: string }>();
  async function press() {
    if (disabled || running.current) return;
    running.current = true;
    setFeedback({ state: "pending", text: "Working…" });
    try {
      const result = await onPress();
      const text = result === undefined ? "Done." : result === null ? "No result."
        : result === "" ? "Empty result." : result === true ? "Yes." : result === false ? "No."
        : Array.isArray(result) && result.length === 0 ? "No items."
        : typeof result === "string" ? result : JSON.stringify(result, null, 2);
      setFeedback({ state: "success", text });
    } catch (error) {
      setFeedback({ state: "error", text: error instanceof Error ? error.message : String(error) });
    } finally { running.current = false; }
  }
  return <View className="w-72 max-w-full gap-2">
    <Button {...props} className="w-full" disabled={disabled || feedback?.state === "pending"} onPress={() => void press()} />
    {feedback && <Text selectable accessibilityLiveRegion="polite"
      testID={props.testID ? `${props.testID}-result` : undefined}
      className={feedback.state === "error" ? "text-sm text-danger" : "text-sm text-muted"}>
      {feedback.state === "error" ? `Failed: ${feedback.text}` : feedback.text}
    </Text>}
  </View>;
}
