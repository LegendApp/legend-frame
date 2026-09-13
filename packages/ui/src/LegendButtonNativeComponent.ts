import type { HostComponent, ViewProps } from "react-native";
import type { DirectEventHandler, WithDefault } from "react-native/Libraries/Types/CodegenTypes";
import codegenNativeComponent from "react-native/Libraries/Utilities/codegenNativeComponent";

export interface NativeProps extends ViewProps {
  title: string;
  disabled?: WithDefault<boolean, false>;
  variant?: WithDefault<"default" | "bordered" | "borderless", "default">;
  onButtonPress?: DirectEventHandler<Readonly<{}>>;
}
export default codegenNativeComponent<NativeProps>("LegendButton") as HostComponent<NativeProps>;
