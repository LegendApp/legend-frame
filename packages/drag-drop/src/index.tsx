import React, { useCallback } from "react";
import type { NativeSyntheticEvent, ViewProps } from "react-native";
import NativeView from "./DesktopDragViewNativeComponent";
export type DragPayload = { files?: string[]; text?: string; urls?: string[] };
export type DropEvent = DragPayload & { x: number; y: number };
export type DragDropViewProps = ViewProps & { disabled?: boolean; source?: DragPayload; onDrop?: (event: DropEvent) => void; onDragEnter?: (event: DropEvent) => void; onDragLeave?: () => void; onDragEnd?: (event: { accepted: boolean }) => void };
export function DragDropView({ source, onDrop, onDragEnter, onDragLeave, onDragEnd, ...props }: DragDropViewProps) {
  if (source?.files?.some(file => !file.startsWith("/"))) throw new Error("Drag source files must use absolute paths");
  const drop = useCallback((event: NativeSyntheticEvent<{ json: string }>) => onDrop?.(JSON.parse(event.nativeEvent.json)), [onDrop]);
  const enter = useCallback((event: NativeSyntheticEvent<{ json: string }>) => onDragEnter?.(JSON.parse(event.nativeEvent.json)), [onDragEnter]);
  const end = useCallback((event: NativeSyntheticEvent<{ json: string }>) => onDragEnd?.(JSON.parse(event.nativeEvent.json)), [onDragEnd]);
  return <NativeView {...props} sourceJson={source ? JSON.stringify(source) : ""} onDrop={drop} onDragEnter={enter} onDragLeave={onDragLeave} onDragEnd={end} />;
}
