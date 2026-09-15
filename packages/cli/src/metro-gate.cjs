const fs = require("node:fs");
const { statePath, supportedPlatforms } = require("@legend-apps/desktop-config/config.cjs");
// Builds/export operate independently. Only a managed live session enables this gate.
exports.gate = (root, middleware) => (req, res, next) => {
  if (/\.(bundle|delta)(\?|$)/.test(req.url || "")) {
    const platform = new URL(req.url, "http://localhost").searchParams.get("platform");
    // Mobile and web never depend on the desktop binary's native module set.
    if (platform && !["macos", "windows"].includes(platform)) return middleware(req, res, next);
    if (platform && !supportedPlatforms(root).includes(platform)) return middleware(req, res, next);
    const file = statePath(root, "session.json", platform ?? undefined);
    if (fs.existsSync(file)) {
      let session;
      try {
        session = JSON.parse(fs.readFileSync(file, "utf8"));
      } catch {
        res.statusCode = 503;
        res.end(
          "Legend: runtime compatibility is being checked. Retry in a moment.",
        );
        return;
      }
      if (session && !session.compatible) {
        res.statusCode = 409;
        res.end(
          "Legend: custom development build required. Press g to switch desktop runtime or b to build in the development terminal. " +
            (session.reason || ""),
        );
        return;
      }
    }
  }
  return middleware(req, res, next);
};
