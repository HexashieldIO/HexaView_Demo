import { useState } from 'react';
import { CheckCircle2, Rocket, RotateCcw, Save } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Modal } from '../../components/Overlay';
import { brandChanges, brandPublishedAt, brandVersion, discardDraft, publishBrand, useBrand, usePublishedBrand } from './brand';

/**
 * Sticky save bar for the White Label pages: lists unpublished changes and
 * publishes them (logo, wording, sign-in) to the console and client tenants.
 */
export function PublishBar({ clients }: { clients: number }) {
  const brand = useBrand();
  usePublishedBrand(); // re-render when a publish lands
  const { toast } = useApp();
  const [confirm, setConfirm] = useState(false);
  const changes = brandChanges(brand);
  const at = brandPublishedAt();
  const next = brandVersion() + 1;

  const publish = () => {
    const v = publishBrand();
    setConfirm(false);
    toast(`Theme v${v} saved and published to ${clients} client tenants`);
  };

  return (
    <>
      <div className={`wl-bar ${changes.length ? 'dirty' : 'clean'}`} role="status">
        {changes.length ? (
          <>
            <span className="wl-bar-dot" />
            <span className="wl-bar-txt">
              <b>{changes.length} unpublished change{changes.length === 1 ? '' : 's'}</b>
              <span>{changes.slice(0, 4).map((c) => c.label).join(' · ')}{changes.length > 4 ? ` · +${changes.length - 4} more` : ''}</span>
            </span>
            <button className="btn" onClick={() => { discardDraft(); toast('Unpublished changes discarded'); }}><RotateCcw size={13} /> Discard</button>
            <button className="btn primary wl-bar-save" onClick={() => setConfirm(true)}><Save size={13} /> Save &amp; publish</button>
          </>
        ) : (
          <>
            <CheckCircle2 size={15} className="wl-bar-ok" />
            <span className="wl-bar-txt">
              <b>All changes published · v{brandVersion()}</b>
              <span>{at ? `Published ${Math.max(0, Math.round((Date.now() - at) / 60000))} min ago · live in the console and on client sign-in` : 'Live in the console and on client sign-in'}</span>
            </span>
          </>
        )}
      </div>
      {confirm && (
        <Modal
          title={`Save and publish theme v${next}`}
          sub={`Applies to ${clients} client tenants · risk class: low · recorded in the audit ledger`}
          onClose={() => setConfirm(false)}
          footer={<><button className="btn" onClick={() => setConfirm(false)}>Cancel</button><button className="btn primary wl-bar-save" onClick={publish}><Rocket size={13} /> Publish v{next}</button></>}
        >
          <ul className="wl-bar-list">
            {changes.map((c) => <li key={c.key}>{c.label}</li>)}
          </ul>
          <p className="muted" style={{ fontSize: 12, margin: '10px 0 0' }}>Users see the new theme on their next page load. You can revert to HexaView from the Branding page at any time.</p>
        </Modal>
      )}
    </>
  );
}
