import AsyncStorage from "@react-native-async-storage/async-storage";
import { Records } from "./records";
import { projectId } from "./identity";
export function records<T>(name: string, decode: (value: unknown) => T) {
  return new Records(AsyncStorage, `legend:${projectId.length}:${projectId}:${name}`, decode);
}
