import React, { useCallback, useState } from "react";
import { Platform, Text, View, type NativeSyntheticEvent, type ViewProps } from "react-native";
import NativeView from "./DesktopDragViewNativeComponent";
import { dragConfiguration, type DragPayload, type DragOptions, type DragOperation, type DragOverEvent, type DropEvent } from "./contracts";
export type { DragPayload, DragOptions, DragOperation, DragOverEvent, DropEvent } from "./contracts";
export type DragDropViewProps = ViewProps & DragOptions & { disabled?: boolean; source?: DragPayload; onDrop?: (event: DropEvent) => void; onDragEnter?: (event: DropEvent) => void; onDragOver?: (event: DragOverEvent) => void; onDragLeave?: () => void; onDragEnd?: (event: { accepted: boolean; operation: DragOperation | "none" }) => void };
export function DragDropView({ source, sourceOperations, acceptedOperations, acceptedTypes, onDrop, onDragEnter, onDragOver, onDragLeave, onDragEnd, ...props }: DragDropViewProps) {
  const optionsJson = dragConfiguration(source, { sourceOperations, acceptedOperations, acceptedTypes }, Platform.OS);
  const [failure, setFailure] = useState<string>();
  const unavailable = useCallback((event: NativeSyntheticEvent<{ json: string }>) => setFailure(JSON.parse(event.nativeEvent.json).message), []);
  const drop = useCallback((event: NativeSyntheticEvent<{ json: string }>) => onDrop?.(JSON.parse(event.nativeEvent.json)), [onDrop]);
  const enter = useCallback((event: NativeSyntheticEvent<{ json: string }>) => onDragEnter?.(JSON.parse(event.nativeEvent.json)), [onDragEnter]);
  const over = useCallback((event: NativeSyntheticEvent<{ json: string }>) => onDragOver?.(JSON.parse(event.nativeEvent.json)), [onDragOver]);
  const end = useCallback((event: NativeSyntheticEvent<{ json: string }>) => onDragEnd?.(JSON.parse(event.nativeEvent.json)), [onDragEnd]);
  if (failure) return <View {...props}><Text>Drag and drop is unavailable: {failure}</Text>{props.children}</View>;
  return <NativeView optionsJson={optionsJson} onDragOver={onDragOver ? over : undefined} onUnavailable={unavailable} {...props} sourceJson={source ? JSON.stringify(source) : ""} onDrop={drop} onDragEnter={enter} onDragLeave={onDragLeave} onDragEnd={end} />;
}
