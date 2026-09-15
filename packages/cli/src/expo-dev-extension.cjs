let state = { target: 'go', canBuild: false };
let sequence = 0;
const pending = new Map();

function commands(platform = process.env.LEGEND_PLATFORM, host = process.platform, current = state) {
  const name = platform === 'macos' ? 'macOS' : platform === 'windows' ? 'Windows' : undefined;
  if (!name) return [];
  const disabled = platform === 'macos' ? host !== 'darwin' : host !== 'win32';
  return [
    { key: 'd', msg: `open ${name} (${current.target === 'go' ? 'prebuilt runtime' : 'development build'})`, disabled },
    { key: 'g', msg: `switch desktop to ${current.target === 'go' ? 'development build' : 'prebuilt runtime'}`, disabled },
    { key: 'b', msg: `build and open ${name} development build`, disabled: disabled || !current.canBuild },
  ];
}

async function handleKey(key) {
  if (!commands().some(command => command.key === key)) return false;
  if (commands().find(command => command.key === key).disabled) return true;
  const id = ++sequence;
  await new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    process.send({ type: 'legend:action', id, action: { d: 'open', g: 'switch', b: 'build' }[key] }, error => {
      if (error) { pending.delete(id); reject(error); }
    });
  });
  return true;
}

function integrateCommands(ui) {
  const desktop = commands();
  return ui.flatMap(item => {
    const keys = item?.key === 's' ? ['g'] : item?.key === 'w' ? ['d', 'b'] : [];
    return [item, ...desktop.filter(command => keys.includes(command.key))];
  });
}

if (process.send) {
  process.on('message', message => {
    if (message?.type === 'legend:state') state = message.state;
    if (message?.type === 'legend:result') {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request?.reject(new Error(message.error));
      else request?.resolve();
    }
  });
  // The supervisor owns the native app; do not leave Expo alive if it disappears.
  process.on('disconnect', () => process.exit());
}

module.exports = { commands, integrateCommands, handleKey, ready: (port, options) => process.send({ type: 'legend:ready', port, options }) };
