import React, { useCallback, useState } from "react";
import { Platform, Text, View, type NativeSyntheticEvent, type ViewProps } from "react-native";
import NativeView from "./DesktopDragViewNativeComponent";
export type DragPayload = { files?: string[]; text?: string; urls?: string[] };
export type DropEvent = DragPayload & { x: number; y: number };
export type DragDropViewProps = ViewProps & { disabled?: boolean; source?: DragPayload; onDrop?: (event: DropEvent) => void; onDragEnter?: (event: DropEvent) => void; onDragLeave?: () => void; onDragEnd?: (event: { accepted: boolean }) => void };
export function DragDropView({ source, onDrop, onDragEnter, onDragLeave, onDragEnd, ...props }: DragDropViewProps) {
  if (source?.files?.some(file => Platform.OS === "windows" ? !/^(?:[a-z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+)/i.test(file) : !file.startsWith("/"))) throw new Error("Drag source files must use absolute paths");
  const [failure, setFailure] = useState<string>();
  const unavailable = useCallback((event: NativeSyntheticEvent<{ json: string }>) => setFailure(JSON.parse(event.nativeEvent.json).message), []);
  const drop = useCallback((event: NativeSyntheticEvent<{ json: string }>) => onDrop?.(JSON.parse(event.nativeEvent.json)), [onDrop]);
  const enter = useCallback((event: NativeSyntheticEvent<{ json: string }>) => onDragEnter?.(JSON.parse(event.nativeEvent.json)), [onDragEnter]);
  const end = useCallback((event: NativeSyntheticEvent<{ json: string }>) => onDragEnd?.(JSON.parse(event.nativeEvent.json)), [onDragEnd]);
  if (failure) return <View {...props}><Text>Drag and drop is unavailable: {failure}</Text>{props.children}</View>;
  return <NativeView onUnavailable={unavailable} {...props} sourceJson={source ? JSON.stringify(source) : ""} onDrop={drop} onDragEnter={enter} onDragLeave={onDragLeave} onDragEnd={end} />;
}
