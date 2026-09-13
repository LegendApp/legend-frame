import type { ButtonProps, TextInputProps, SelectProps } from "./types";
export type { ButtonProps, TextInputProps, SelectProps } from "./types";
export function Button(_props: ButtonProps): never {
  throw Object.assign(new Error("Native Button has no Windows backend yet"), { code: "E_UNAVAILABLE" });
}

export function TextInput(_props: TextInputProps): never { throw Object.assign(new Error("Native TextInput has no Windows backend yet"), { code: "E_UNAVAILABLE" }); }
export function Select(_props: SelectProps): never { throw Object.assign(new Error("Native Select has no Windows backend yet"), { code: "E_UNAVAILABLE" }); }
