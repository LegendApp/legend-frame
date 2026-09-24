import { useCallback, useMemo, useState } from "react";
import { Text, View, TurboModuleRegistry } from "react-native";
import type { NativeSyntheticEvent, TurboModule, StyleProp, ViewStyle } from "react-native";
import NativeButton from "./SparkButtonNativeComponent";
import NativeTextInput from "./SparkTextInputNativeComponent";
import NativeSelect from "./SparkSelectNativeComponent";
import { selectionIndex } from "./select";
import type { ButtonProps, TextInputProps, SelectProps } from "./types";
export type { ButtonProps, TextInputProps, SelectProps } from "./types";
interface Availability extends TurboModule { isAvailable(): boolean }
const available = TurboModuleRegistry.get<Availability>("NativeSparkUI")?.isAvailable() === true;
function useAvailability() {
  const [failed, setFailed] = useState(!available);
  const unavailable = useCallback((event: NativeSyntheticEvent<{ message: string }>) => {
    console.warn(`Windows native control unavailable: ${event.nativeEvent.message}`); setFailed(true);
  }, []);
  return { failed, onUnavailable: unavailable };
}
function Placeholder({ label, style, testID }: { label: string; style?: StyleProp<ViewStyle>; testID?: string }) {
  return <View style={[{ minHeight: 36, padding: 8, borderWidth: 1, borderColor: "#999" }, style]} testID={testID} accessible accessibilityLabel={label} accessibilityState={{ disabled: true }}>
    <Text>{label} — Windows control unavailable; rebuild the development client.</Text>
  </View>;
}
export function Button({ children, onPress, disabled = false, variant = "default", style, testID }: ButtonProps) {
  const { failed, onUnavailable } = useAvailability();
  return failed ? <Placeholder label={children} style={style} testID={testID} /> :
    <NativeButton title={children} disabled={disabled} variant={variant} onButtonPress={disabled ? undefined : onPress} onUnavailable={onUnavailable} testID={testID} style={[{ width: 160, height: 36 }, style]} />;
}
export function TextInput({ defaultValue = "", onChangeText, style, ...props }: TextInputProps) {
  const { failed, onUnavailable } = useAvailability();
  const changed = useCallback((event: NativeSyntheticEvent<{ text: string }>) => onChangeText?.(event.nativeEvent.text), [onChangeText]);
  return failed ? <Placeholder label={props.accessibilityLabel ?? "Text input"} style={style} testID={props.testID} /> :
    <NativeTextInput {...props} defaultText={defaultValue} onTextChange={changed} onUnavailable={onUnavailable} style={[{ width: 240, height: 36 }, style]} />;
}
export function Select({ options, value, onValueChange, style, ...props }: SelectProps) {
  const selected = selectionIndex(options, value);
  const { failed, onUnavailable } = useAvailability();
  const itemsJson = useMemo(() => JSON.stringify(options), [options]);
  const changed = useCallback((event: NativeSyntheticEvent<{ value: string }>) => onValueChange(event.nativeEvent.value), [onValueChange]);
  return failed ? <Placeholder label={`${props.accessibilityLabel ?? "Select"}: ${options[selected]!.label}`} style={style} testID={props.testID} /> :
    <NativeSelect {...props} itemsJson={itemsJson} value={value} onSelectionChange={changed} onUnavailable={onUnavailable} style={[{ width: 240, height: 36 }, style]} />;
}
