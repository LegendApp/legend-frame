import type { HostComponent, ViewProps } from "react-native";
import type { DirectEventHandler } from "react-native/Libraries/Types/CodegenTypes";
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";
export interface NativeProps extends ViewProps {
  onUnavailable?: DirectEventHandler<Readonly<{ message: string }>>;
  itemsJson: string;
  value: string;
  onSelectionChange?: DirectEventHandler<Readonly<{ value: string }>>;
}
export default codegenNativeComponent<NativeProps>("FrameSelect") as HostComponent<NativeProps>;
