export type WindowStyle = {
  title?: string;
  width?: number; height?: number;
  minWidth?: number; minHeight?: number; maxWidth?: number; maxHeight?: number;
  resizable?: boolean; closable?: boolean; minimizable?: boolean;
  alwaysOnTop?: boolean; transparent?: boolean; hasShadow?: boolean; trafficLights?: boolean; restoreFrame?: boolean;
  titleBarStyle?: "default" | "overlay" | "hidden" | "borderless";
  appearance?: "system" | "light" | "dark";
  material?: "none" | "sidebar" | "windowBackground" | "hudWindow" | "popover";
  backgroundColor?: string;
};
export function validateWindow(options: unknown): WindowStyle;
