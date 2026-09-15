import React, { useState } from 'react';
import { NativeModules, requireNativeComponent, Text, View, type NativeSyntheticEvent } from 'react-native';
import type { NativeProps } from './NativeThreadedRuntimeSurface';
export type { NativeProps } from './NativeThreadedRuntimeSurface';
const Surface = requireNativeComponent<NativeProps & { onRuntimeError?: (event: NativeSyntheticEvent<{ message: string }>) => void }>('ThreadedRuntimeSurface');
export default function ThreadedRuntimeSurface(props: NativeProps) {
  const [failure, setFailure] = useState('');
  if (!NativeModules.ThreadedRuntime || failure) return <View style={props.style} testID={props.testID} accessibilityLabel={props.accessibilityLabel}>
    <Text>Threaded surface unavailable: {failure || 'Rebuild the desktop runtime with Runtimes included.'}</Text>
  </View>;
  return <Surface {...props} onRuntimeError={event => setFailure(event.nativeEvent.message)} />;
}
