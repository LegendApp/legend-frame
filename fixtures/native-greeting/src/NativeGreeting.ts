import type { TurboModule } from "react-native";
import { TurboModuleRegistry } from "react-native";
export interface Spec extends TurboModule { getGreeting(): string; }
export default TurboModuleRegistry.getEnforcing<Spec>("NativeGreeting");
