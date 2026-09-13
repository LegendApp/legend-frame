import { selectionIndex } from "./select";
import type { CSSProperties } from "react";
import { StyleSheet, View } from "react-native";
import type { ButtonProps, TextInputProps, SelectProps } from "./types";
export type { ButtonProps, TextInputProps, SelectProps } from "./types";

const nativeStyle: CSSProperties = { width: "100%", height: "100%", boxSizing: "border-box", font: "14px system-ui" };
const borderlessStyle: CSSProperties = { ...nativeStyle, border: "none", background: "transparent" };
export function Button({ children, onPress, disabled = false, variant = "default", style, testID }: ButtonProps) {
  return <View style={[styles.button, style]} testID={testID}>
    <button type="button" disabled={disabled} onClick={disabled ? undefined : onPress}
      style={variant === "borderless" ? borderlessStyle : nativeStyle}>{children}</button>
  </View>;
}
const styles = StyleSheet.create({ button: { width: 160, height: 36 } });

export function TextInput({ defaultValue, onChangeText, accessibilityLabel, style, testID }: TextInputProps) {
  return <View style={[{ width: 240, height: 36 }, style]} testID={testID}><input type="text" defaultValue={defaultValue} onChange={event => onChangeText?.(event.currentTarget.value)} aria-label={accessibilityLabel} style={nativeStyle} /></View>;
}
export function Select({ options, value, onValueChange, accessibilityLabel, style, testID }: SelectProps) {
  selectionIndex(options, value);
  return <View style={[{ width: 240, height: 36 }, style]} testID={testID}><select value={value} onChange={event => onValueChange(event.currentTarget.value)} aria-label={accessibilityLabel} style={nativeStyle}>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></View>;
}
