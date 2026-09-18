import React from "react";
import { ScrollView } from "react-native";
import { NitroCompatibility } from "./NitroCompatibility";
export default function App({ launchArguments = [] }: { launchArguments?: string[] }) {
  const at = launchArguments.indexOf("--frame-camera-proof");
  return <ScrollView contentContainerStyle={{ padding: 32 }}><NitroCompatibility report={at >= 0 ? launchArguments[at + 1] : undefined} /></ScrollView>;
}
