import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { readJson, writeJson } from "./project.ts";
import { run } from "./commands.ts";

// Native versions tested with the local Go runtime. This is a compatibility
// matrix, not the module-inclusion registry; discovery remains package-owned.
const nativeVersions = {
  "expo-asset": "12.0.13",
  "expo-constants": "18.0.14",
  "expo-file-system": "19.0.24",
  "expo-font": "14.0.12",
  "expo-keep-awake": "15.0.8",
  "expo-modules-core": "3.0.30",
  "expo-desktop-modules-core": "54.0.14-beta.0",
  "expo-desktop-stubs": "54.0.14-beta.0",
};

export async function create(root: string, archiveManifest: string) {
  if (existsSync(path.join(root, "package.json")))
    throw new Error(`Project already exists: ${root}`);
  const archives: Record<string, string> = readJson(archiveManifest);
  const local = Object.fromEntries(
    Object.entries(archives).map(([name, file]) => [
      name,
      path.resolve(path.dirname(archiveManifest), file),
    ]),
  );
  mkdirSync(root, { recursive: true });
  const name = path.basename(root).replace(/[^a-zA-Z0-9]/g, "") || "HelloWorld";
  const deps = {
    "@legend-apps/cli": local["@legend-apps/cli"],
    "@legend-apps/desktop": local["@legend-apps/desktop"],
    "@legend-apps/desktop-config": local["@legend-apps/desktop-config"],
    expo: "54.0.37",
    "expo-desktop": "1.0.0-beta.5",
    "expo-desktop-prebuild-config": "1.1.0-beta.1",
    "expo-desktop-config-plugins": "1.2.0-beta.0",
    "expo-desktop-metro-config": "54.81.0-beta.3",
    "expo-desktop-template-bare-minimum": "54.81.1-beta.5",
    react: "19.1.4",
    "react-native": "0.81.6",
    "react-native-macos": "0.81.7",
    "@react-native-community/cli": "20.1.3",
    typescript: "5.9.3",
    "@types/react": "19.1.10",
  };
  writeJson(path.join(root, "package.json"), {
    name: name.toLowerCase(),
    version: "0.0.1",
    private: true,
    main: "index.ts",
    scripts: {
      dev: "legend dev",
      build: "legend build --release",
      doctor: "legend doctor",
    },
    dependencies: deps,
    overrides: {
      ...nativeVersions,
      ...local,
      react: "19.1.4",
      "react-native": "0.81.6",
    },
    expo: { install: { exclude: ["react", "react-native"] } },
  });
  writeJson(path.join(root, "app.json"), {
    expo: {
      name,
      slug: name.toLowerCase(),
      version: "0.0.1",
      platforms: ["macos"],
      newArchEnabled: true,
      macos: {
        bundleIdentifier: `so.legend.prototype.${name.toLowerCase()}`,
        infoPlist: { CFBundleName: name },
      },
      // beta.5's template expansion asserts these even with --platform macos.
      windows: {
        namespace: "LegendPrototype",
        displayName: name,
        packageGuid: crypto.randomUUID(),
        projectGuid: crypto.randomUUID(),
      },
      experiments: { outOfTreePlatforms: true },
      plugins: ["@legend-apps/desktop-config"],
    },
  });
  writeFileSync(
    path.join(root, "metro.config.js"),
    `const { makeMetroConfig } = require("expo-desktop-metro-config");\nconst { gate } = require("@legend-apps/cli/src/metro-gate.cjs");\nconst config = makeMetroConfig(__dirname);\nconfig.server = { ...config.server, enhanceMiddleware: (middleware) => gate(__dirname, middleware) };\nmodule.exports = config;\n`,
  );
  writeFileSync(
    path.join(root, "index.ts"),
    'import { registerRootComponent } from "expo";\nimport App from "./App";\nregisterRootComponent(App);\n',
  );
  writeFileSync(path.join(root, "App.tsx"), starter);
  writeFileSync(
    path.join(root, ".gitignore"),
    "node_modules/\n.legend/\nmacos/\n",
  );
  await run(root, ["bun", "install"]);
  console.log(`Created ${root}. Start with bun dev --go /path/to/LegendGo.app`);
}
const starter = `import React, { useEffect, useState } from "react";
import { Button, StyleSheet, Text, View } from "react-native";
import { openFileDialog } from "@legend-apps/desktop/dialogs";
import { configureMenus, clearMenus, addNativeMenuActionListener } from "@legend-apps/desktop/menus";

const menus = [{ id: "hello", title: "Hello", items: [{ id: "greet", title: "Say Hello" }] }];
export default function App({ runtime }: { runtime?: { mode: string } }) {
  const [message, setMessage] = useState("Ready");
  useEffect(() => {
    configureMenus("hello-world", menus);
    const subscription = addNativeMenuActionListener(action => {
      if (action.ownerId === "hello-world" && action.itemId === "greet") setMessage("Hello from the native menu");
    });
    return () => { subscription.remove(); clearMenus("hello-world"); };
  }, []);
  async function chooseFile() {
    try {
      const files = await openFileDialog({ title: "Choose a file", allowsMultipleSelection: false });
      setMessage(files?.join(", ") || "Dialog cancelled");
    } catch (error) { setMessage(String(error)); }
  }
  return <View style={styles.root}>
    <Text style={styles.title}>Hello, Legend</Text>
    <Text style={styles.text}>Runtime: {runtime?.mode ?? "unknown"}</Text>
    <Button title="Choose a file" onPress={chooseFile} />
    <Text style={styles.text} accessible accessibilityLabel={message}>{message}</Text>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, backgroundColor: "#f5f5f7" }, text: { color: "#18181b" }, title: { fontSize: 32, fontWeight: "600", color: "#18181b" } });
`;
