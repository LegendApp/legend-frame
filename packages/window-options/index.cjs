const enums = {
  titleBarStyle: ["default", "overlay", "hidden", "borderless"],
  appearance: ["system", "light", "dark"],
  material: ["none", "sidebar", "windowBackground", "hudWindow", "popover"],
};
const dimensions = ["width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight"];
const booleans = ["resizable", "closable", "minimizable", "alwaysOnTop", "transparent", "hasShadow", "trafficLights", "restoreFrame"];
function validateWindow(options) {
  if (!options || typeof options !== "object" || Array.isArray(options)) throw new Error("window must be an object");
  const allowed = [...dimensions, ...booleans, ...Object.keys(enums), "title", "backgroundColor"];
  for (const key of Object.keys(options)) if (!allowed.includes(key)) throw new Error(`Unknown window option: ${key}`);
  for (const key of dimensions) if (options[key] !== undefined && (!Number.isFinite(options[key]) || options[key] < 100 || options[key] > 20000)) throw new Error(`${key} must be between 100 and 20000 points`);
  for (const axis of ["Width", "Height"]) {
    const min = options[`min${axis}`] ?? 100, max = options[`max${axis}`] ?? 20000;
    if (min > max) throw new Error(`min${axis} exceeds max${axis}`);
    const size = options[axis.toLowerCase()];
    if (size !== undefined && (size < min || size > max)) throw new Error(`${axis.toLowerCase()} is outside its constraints`);
  }
  for (const key of booleans) if (options[key] !== undefined && typeof options[key] !== "boolean") throw new Error(`${key} must be a boolean`);
  for (const [key, values] of Object.entries(enums)) if (options[key] !== undefined && !values.includes(options[key])) throw new Error(`Invalid ${key}`);
  if (options.title !== undefined && typeof options.title !== "string") throw new Error("title must be a string");
  if (options.backgroundColor !== undefined && !/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(options.backgroundColor)) throw new Error("backgroundColor must be #RRGGBB or #RRGGBBAA");
  return options;
}
module.exports = { validateWindow, dimensions, booleans, enums };
