import { useCallback, useMemo } from "react";
import { selectionIndex } from "./select";
import { Button as ExpoButton, TextInput as ExpoTextInput, Picker } from "@expo/ui/jetpack-compose";
import { StyleSheet, View } from "react-native";
import type { ButtonProps, TextInputProps, SelectProps } from "./types";
export type { ButtonProps, TextInputProps, SelectProps } from "./types";

export function Button({ children, onPress, disabled = false, variant = "default", style, testID }: ButtonProps) {
  return <View style={[styles.button, style]} testID={testID}>
    <ExpoButton style={styles.content} onPress={disabled ? undefined : onPress}
      disabled={disabled} variant={variant}>{children}</ExpoButton>
  </View>;
}
const styles = StyleSheet.create({ button: { width: 160, height: 48 }, content: { flex: 1 } });

const ignoreText = (_value: string) => {};
export function TextInput({ defaultValue, onChangeText, accessibilityLabel, style, testID }: TextInputProps) {
  return <View style={[{ width: 240, height: 56 }, style]} testID={testID}><ExpoTextInput defaultValue={defaultValue} onChangeText={onChangeText ?? ignoreText} style={styles.content} {...{ accessibilityLabel }} /></View>;
}
export function Select({ options, value, onValueChange, accessibilityLabel, style, testID }: SelectProps) {
  const selectedIndex = selectionIndex(options, value);
  const labels = useMemo(() => options.map(option => option.label), [options]);
  const changed = useCallback((event: { nativeEvent: { index: number } }) => { const option = options[event.nativeEvent.index]; if (option) onValueChange(option.value); }, [options, onValueChange]);
  return <View style={[{ width: 280, height: 48 }, style]} testID={testID}><Picker variant="segmented" options={labels} selectedIndex={selectedIndex} onOptionSelected={changed} style={styles.content} {...{ accessibilityLabel }} /></View>;
}
