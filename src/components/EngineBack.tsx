import { ArrowLeft } from 'lucide-react';
import { ENGINE_URL, cameFromEngine } from '../lib/engine';

/**
 * "Back to HexaEngine" link, shown only when this session was opened from
 * HexaEngine's HexaView banner (?from=engine). Opens in the same tab.
 */
export function EngineBack({ compact }: { compact?: boolean }) {
  if (!cameFromEngine()) return null;
  return (
    <a className="eng-back" href={ENGINE_URL} title="Back to HexaEngine" aria-label="Back to HexaEngine">
      <ArrowLeft />
      {compact ? <span><span className="eng-lbl">Back to </span>HexaEngine</span> : <span>Back to HexaEngine</span>}
    </a>
  );
}
