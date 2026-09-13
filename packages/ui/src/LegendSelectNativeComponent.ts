import type { HostComponent, ViewProps } from "react-native";
import type { DirectEventHandler } from "react-native/Libraries/Types/CodegenTypes";
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";
export interface NativeProps extends ViewProps {
  itemsJson: string;
  value: string;
  onSelectionChange?: DirectEventHandler<Readonly<{ value: string }>>;
}
export default codegenNativeComponent<NativeProps>("LegendSelect") as HostComponent<NativeProps>;
