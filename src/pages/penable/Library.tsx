import { useMemo, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Download, Share2, Stamp, Sparkles } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, Btn, Chip, KV, SectionLabel } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { CONTENT_TYPES, contentLibrary, deals, type ContentItem, type ContentType } from '../../data/modules/partner';
import { PT_TONE } from '../partner/parts';

const PRODUCT_TONE: Record<string, string> = {
  HexaSOC: 'var(--m-soc)', HexaOT: 'var(--m-ot)', HexaInt: 'var(--m-int)', HexaStrike: 'var(--m-strike)', HexaComply: 'var(--m-comply)',
  HexaCustody: 'var(--m-custody)', HexaView: 'var(--m-view)', HexaAI: 'var(--m-ai)', HexaCore: 'var(--m-core)', Partner: 'var(--m-partner)',
};
const SECTORS = ['Maritime', 'Financial Services', 'Media & Entertainment', 'Healthcare', 'Automotive'];
const cover = (it: ContentItem) => `linear-gradient(135deg, #0b1324 0%, color-mix(in srgb, ${PRODUCT_TONE[it.product] ?? PT_TONE} 75%, #0b1324) 100%)`;

export default function EnablementLibrary() {
  const [params, setParams] = useSearchParams();
  const { toast } = useApp();
  const lib = useMemo(() => contentLibrary(), []);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<ContentItem | null>(null);
  const type = params.get('type') as ContentType | null;
  const sector = params.get('sector');
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const rows = lib.filter((it) => {
    if (type && it.type !== type) return false;
    if (sector && it.sector !== sector) return false;
    if (q && !`${it.title} ${it.summary} ${it.product} ${it.type} ${it.sector ?? ''} ${it.bullets.join(' ')}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  const openDeals = deals().filter((d) => !d.stage.startsWith('Closed'));
  const recommended = useMemo(() => {
    const sectors = new Set(openDeals.map((d) => d.sector));
    return lib.filter((it) => (it.sector && sectors.has(it.sector)) || it.type === 'Battlecard').slice(0, 6);
  }, [lib, openDeals]);
  const downloads = lib.reduce((s, it) => s + it.downloads, 0);

  return (
    <>
      <p className="page-intro">
        Everything you need to sell and deliver HexaShield capabilities, kept current by HexaShield: navy for screens and decks, light for printing. Most items co-brand with your logo in one click. Search by product, sector or objection.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Assets', value: lib.length, onClick: () => setParams({}, { replace: true }), source: 'HexaShield partner content service' },
          { label: 'New this month', value: lib.filter((x) => x.isNew).length, onClick: () => { setParams({}, { replace: true }); setQ(''); setSel(lib.find((x) => x.isNew) ?? null); }, source: 'Partner content service · publish dates' },
          { label: 'Sector one-pagers', value: lib.filter((x) => x.type === 'Sector one-pager').length, onClick: () => setParam('type', 'Sector one-pager'), source: 'Partner content service' },
          { label: 'Battlecards', value: lib.filter((x) => x.type === 'Battlecard').length, onClick: () => setParam('type', 'Battlecard'), source: 'Partner content service' },
          { label: 'Downloads by your team', value: downloads, hint: 'all time', source: 'Partner content service · download log' },
          { label: 'Co-brandable', value: `${Math.round((lib.filter((x) => x.cobrand).length / lib.length) * 100)}%`, source: 'Partner content service' },
        ]}
      />

      <div className="grid g-3-2" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(260px, 1fr)', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 12 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <label className="search" style={{ width: 300 }}>
              <Search size={14} />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search battlecards, decks, objections…" />
            </label>
            <span className="muted" style={{ fontSize: 12 }}>{rows.length} of {lib.length}</span>
          </div>
          <div className="chips">
            <Chip on={!type} onClick={() => setParam('type', null)} color={PT_TONE}>All types</Chip>
            {CONTENT_TYPES.map((t) => <Chip key={t} on={type === t} onClick={() => setParam('type', type === t ? null : t)} color={PT_TONE}>{t} · {lib.filter((x) => x.type === t).length}</Chip>)}
          </div>
          <div className="chips">
            <Chip on={!sector} onClick={() => setParam('sector', null)}>All sectors</Chip>
            {SECTORS.map((s) => <Chip key={s} on={sector === s} onClick={() => setParam('sector', sector === s ? null : s)}>{s}</Chip>)}
          </div>
          <div className="pt-tiles">
            {rows.map((it) => (
              <button key={it.id} className="pt-tile" onClick={() => setSel(it)}>
                <div className="pt-tile-cover" style={{ background: cover(it) }}>
                  <div className="row" style={{ justifyContent: 'space-between' }}>
                    <small>{it.type}</small>
                    {it.isNew && <span className="badge solid" style={{ '--tone': PT_TONE } as CSSProperties}>New</span>}
                  </div>
                  <b>{it.title}</b>
                </div>
                <div className="pt-tile-body">
                  <div className="row" style={{ gap: 6 }}>
                    <span className="pt-mod" style={{ '--tone': PRODUCT_TONE[it.product] ?? PT_TONE } as CSSProperties}>{it.product}</span>
                    {it.sector && <span className="muted" style={{ fontSize: 10.5 }}>{it.sector}</span>}
                  </div>
                  <p>{it.summary}</p>
                  <div className="pt-tile-foot">
                    <span>{it.format}</span>
                    <span className="spacer" />
                    <span>{it.updatedDays} d · {it.downloads}↓</span>
                  </div>
                </div>
              </button>
            ))}
            {rows.length === 0 && <div className="empty">Nothing matches. Try another search or clear the filters.</div>}
          </div>
        </div>

        <div className="stack" style={{ gap: 16, position: 'sticky', top: 76 }}>
          <Card title={<><Sparkles size={14} style={{ verticalAlign: -2 }} /> For your open deals</>} sub={`Matched to ${openDeals.length} registered opportunities`} toneColor={PT_TONE} tinted>
            <div className="list">
              {recommended.map((it) => (
                <button key={it.id} className="list-row" onClick={() => setSel(it)}>
                  <span style={{ width: 8, height: 30, borderRadius: 3, background: PRODUCT_TONE[it.product] ?? PT_TONE }} />
                  <span className="list-main">
                    <b>{it.title}</b>
                    <span>{it.type}{it.sector ? ` · ${openDeals.filter((d) => d.sector === it.sector).length} deals in ${it.sector}` : ''}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>
          <Card title="Most downloaded">
            <div className="list">
              {lib.slice().sort((a, b) => b.downloads - a.downloads).slice(0, 5).map((it, i) => (
                <button key={it.id} className="list-row" onClick={() => setSel(it)}>
                  <b className="num muted" style={{ width: 16 }}>{i + 1}</b>
                  <span className="list-main"><b>{it.title}</b><span>{it.type}</span></span>
                  <span className="num" style={{ fontSize: 12 }}>{it.downloads}</span>
                </button>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {sel && (
        <Drawer
          title={sel.title}
          sub={`${sel.type} · ${sel.product}${sel.sector ? ` · ${sel.sector}` : ''}`}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn primary color={PT_TONE} onClick={() => toast(`Downloading “${sel.title}” (navy, ${sel.format.split(' · ')[0]})`)}><Download /> Download</Btn>
              {sel.cobrand && <Btn onClick={() => toast(`Co-branded copy of “${sel.title}” generated with the Northwind logo and contact details`)}><Stamp /> Co-brand</Btn>}
              <Btn ghost onClick={() => toast(`Tracked share link for “${sel.title}” copied: you'll see when the client opens it`)}><Share2 /> Share link</Btn>
            </>
          }
        >
          <div style={{ borderRadius: 12, padding: 20, color: '#fff', background: cover(sel), minHeight: 150, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <small style={{ fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', opacity: 0.8, fontWeight: 700 }}>{sel.product} · {sel.type}</small>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 21, fontWeight: 700, lineHeight: 1.2 }}>{sel.title}</div>
              <div style={{ fontSize: 12.5, opacity: 0.85, marginTop: 6 }}>{sel.summary}</div>
            </div>
          </div>
          <SectionLabel>Inside</SectionLabel>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.7 }}>{sel.bullets.map((b) => <li key={b}>{b}</li>)}</ul>
          <SectionLabel>Details</SectionLabel>
          <KV
            rows={[
              ['Format', sel.format],
              ['Versions', sel.format.includes('navy') ? 'Navy (screen) · Light (print)' : 'Single'],
              ['Updated', `${sel.updatedDays} days ago by HexaShield partner marketing`],
              ['Downloads', `${sel.downloads} by your team`],
              ['Co-branding', sel.cobrand ? <Badge color="var(--good)">Allowed</Badge> : <Badge>Internal use only</Badge>],
              ['ID', <span className="mono">{sel.id}</span>],
            ]}
          />
        </Drawer>
      )}
    </>
  );
}
