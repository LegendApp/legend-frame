import { OpenFiles } from "./shared/OpenFiles";
import { music } from "./store";
const open = async (uri: string) => { await music.load(); await music.add([{ id: uri, uri, name: uri.split(/[\\/]/).pop()! }]); };
export function Activation({ windowId, onError }: { windowId: string; onError(message: string): void }) { return <OpenFiles windowId={windowId} onFile={open} onError={onError} />; }
