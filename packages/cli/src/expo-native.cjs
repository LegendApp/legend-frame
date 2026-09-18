exports.withFrameNative = (original, root) => {
  if (!['macos', 'windows'].includes(process.env.FRAME_PLATFORM)) return original;
  const generated = require('./universal.cjs').nativeConfig(root);
  const dependencies = { ...original.dependencies };
  for (const [name, config] of Object.entries(generated.dependencies ?? {})) {
    dependencies[name] = { ...dependencies[name], ...config,
      platforms: { ...dependencies[name]?.platforms, ...config.platforms } };
  }
  return { ...original, platforms: { ...generated.platforms, ...original.platforms }, dependencies };
};
