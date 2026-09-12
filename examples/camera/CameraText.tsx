import React from "react";
import { Text as NativeText, type TextProps } from "react-native";

/** This example uses a fixed light surface, independent of the system appearance. */
export function Text({ style, ...props }: TextProps) {
  return <NativeText {...props} style={[{ color: "#172b3a" }, style]} />;
}
