import { createElement, type ComponentType } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import { useResolveClassNames } from "uniwind";
import { Button as NativeButton, TextInput as NativeTextInput, Select as NativeSelect } from "./src/index";

function withFrameClasses<Props extends { style?: StyleProp<ViewStyle> }>(Component: ComponentType<Props>) {
  return function UniwindControl({ className = "", style, ...props }: Props & { className?: string }) {
    // withUniwind emits CSS classes on web, which cannot override our inline
    // default frames. Resolve through Uniwind so style-array precedence survives.
    const resolved = useResolveClassNames(className);
    return createElement(Component, { ...props, style: [resolved as ViewStyle, style] } as Props);
  };
}

export const Button = withFrameClasses(NativeButton);
export const TextInput = withFrameClasses(NativeTextInput);
export const Select = withFrameClasses(NativeSelect);
