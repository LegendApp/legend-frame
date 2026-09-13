import { useCallback, useMemo } from "react";
import { selectionIndex } from "./select";
import { Button as ExpoButton, Host, TextField, Picker } from "@expo/ui/swift-ui";
import { frame, padding, accessibilityLabel as labelModifier } from "@expo/ui/swift-ui/modifiers";
import { StyleSheet } from "react-native";
import type { ButtonProps, TextInputProps, SelectProps } from "./types";
export type { ButtonProps, TextInputProps, SelectProps } from "./types";

const fill = [frame({ maxWidth: Infinity, maxHeight: Infinity })];
export function Button({ children, onPress, disabled = false, variant = "default", style, testID }: ButtonProps) {
  return <Host style={[styles.button, style]}>
    <ExpoButton onPress={disabled ? undefined : onPress} disabled={disabled}
      variant={variant} modifiers={fill} testID={testID}>{children}</ExpoButton>
  </Host>;
}
const styles = StyleSheet.create({ button: { width: 160, height: 44 } });

const fieldModifiers = [padding({ horizontal: 8 }), ...fill];
const ignoreText = (_value: string) => {};
export function TextInput({ defaultValue, onChangeText, accessibilityLabel, style, testID }: TextInputProps) {
  const modifiers = useMemo(() => accessibilityLabel ? [...fieldModifiers, labelModifier(accessibilityLabel)] : fieldModifiers, [accessibilityLabel]);
  return <Host style={[{ width: 240, height: 44, borderWidth: StyleSheet.hairlineWidth, borderColor: "#8e8e93", borderRadius: 6 }, style]}><TextField allowNewlines={false} multiline={false} defaultValue={defaultValue} onChangeText={onChangeText ?? ignoreText} modifiers={modifiers} testID={testID} /></Host>;
}
export function Select({ options, value, onValueChange, accessibilityLabel, style, testID }: SelectProps) {
  const selectedIndex = selectionIndex(options, value);
  const labels = useMemo(() => options.map(option => option.label), [options]);
  const changed = useCallback((event: { nativeEvent: { index: number } }) => { const option = options[event.nativeEvent.index]; if (option) onValueChange(option.value); }, [options, onValueChange]);
  const modifiers = useMemo(() => accessibilityLabel ? [labelModifier(accessibilityLabel)] : [], [accessibilityLabel]);
  return <Host style={[{ width: 240, height: 44 }, style]}><Picker variant="menu" options={labels} selectedIndex={selectedIndex} onOptionSelected={changed} modifiers={modifiers} testID={testID} /></Host>;
}
