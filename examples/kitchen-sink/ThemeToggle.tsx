import { Uniwind, useUniwind } from "uniwind";
import { Button } from "./Controls";

export function ThemeToggle() {
  const { theme, hasAdaptiveThemes } = useUniwind();
  const preference = hasAdaptiveThemes ? "system" : theme;
  const next = preference === "system" ? "light" : preference === "light" ? "dark" : "system";
  return <Button testID="theme-toggle" onPress={() => Uniwind.setTheme(next)}>
    {`Theme: ${preference === "system" ? "System" : preference === "light" ? "Light" : "Dark"} → ${next === "system" ? "System" : next === "light" ? "Light" : "Dark"}`}
  </Button>;
}
