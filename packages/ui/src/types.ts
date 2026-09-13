import type { StyleProp, ViewStyle } from "react-native";

/** A native text button. Layout styles affect its frame, not OS-managed chrome. */
export type ButtonProps = {
  children: string;
  onPress?: () => void;
  disabled?: boolean;
  variant?: "default" | "bordered" | "borderless";
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Uncontrolled single-line input. defaultValue is read once per mount. */
export type TextInputProps = {
  defaultValue?: string;
  onChangeText?: (text: string) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
export type SelectProps = {
  options: readonly { label: string; value: string }[];
  value: string;
  onValueChange: (value: string) => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};
