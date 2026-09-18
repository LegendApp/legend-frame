import type { HostComponent, ViewProps } from "react-native";
import type { DirectEventHandler } from "react-native/Libraries/Types/CodegenTypes";
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";
export interface NativeProps extends ViewProps {
  onUnavailable?: DirectEventHandler<Readonly<{ message: string }>>;
  defaultText?: string;
  onTextChange?: DirectEventHandler<Readonly<{ text: string }>>;
}
export default codegenNativeComponent<NativeProps>("FrameTextInput") as HostComponent<NativeProps>;
