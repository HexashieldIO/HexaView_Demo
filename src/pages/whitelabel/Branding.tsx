import { useMemo, useState } from 'react';
import { CheckCircle2, Upload, RotateCcw, Rocket, AlertTriangle, X } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { Card, KpiStrip, Badge, Btn, Callout, KV, SectionLabel, Timeline } from '../../components/ui';
import { Modal } from '../../components/Overlay';
import { clientBook } from '../../data/modules/partner';
import { Field, PT_TONE, Seg, Toggle } from '../partner/parts';
import { PRESETS, contrast, resetBrand, setBrand, useBrand, DEFAULT_BRAND, type Brand } from './brand';
import { BrandPreview } from './Preview';

const SURFACES = [
  { name: 'Client console & side rail', status: 'live' },
  { name: 'Sign-in page and SSO', status: 'live' },
  { name: 'Notification and digest emails', status: 'live' },
  { name: 'PDF reports and board packs', status: 'live' },
  { name: 'Quotes and invoices', status: 'live' },
  { name: 'Mobile push and on-call app', status: 'live' },
  { name: 'Browser tab title and icon', status: 'live' },
  { name: 'Copilot persona name', status: 'draft' },
];

export default function WhiteLabelBranding() {
  const brand = useBrand();
  const { toast } = useApp();
  const book = useMemo(() => clientBook(), []);
  const [clientId, setClientId] = useState(book[0].id);
  const [publish, setPublish] = useState(false);
  const client = book.find((c) => c.id === clientId)!;
  const set = (p: Partial<Brand>) => setBrand(p);
  const cPrimary = contrast('#ffffff', brand.primary);
  const cSide = contrast('#ffffff', brand.sidebar);
  const changed = (Object.keys(DEFAULT_BRAND) as (keyof Brand)[]).filter((k) => brand[k] !== DEFAULT_BRAND[k]);

  const onFile = (f: File | undefined) => {
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => set({ logoImage: String(rd.result) });
    rd.readAsDataURL(f);
  };

  return (
    <>
      <p className="page-intro">
        Run HexaView under your own brand. Your logo, product name and colours apply across the console, sign-in, emails and reports as you change them: the preview on the right is what <b>{client.name}</b> sees. Each product keeps its own colour on its own pages. Live preview; nothing is saved until you publish.
      </p>
      <KpiStrip
        toneColor={PT_TONE}
        items={[
          { label: 'Clients on your brand', value: `${book.length}/${book.length}`, to: '/partner/clients', source: 'White-label service · tenant theme bindings' },
          { label: 'Custom domains', value: '14/15', hint: '1 pending DNS', to: '/white-label/domains', source: 'White-label service · DNS verification' },
          { label: 'Branded templates', value: 9, to: '/white-label/templates', source: 'Template store' },
          { label: 'Theme version', value: 'v7', hint: 'published 12 d ago', onClick: () => document.getElementById('pt-history')?.scrollIntoView({ behavior: 'smooth' }), source: 'White-label service · publish history' },
          { label: 'Unpublished changes', value: changed.length, onClick: () => changed.length && setPublish(true), source: 'This editor' },
        ]}
      />

      <div className="grid g-2-1" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.45fr)', alignItems: 'start' }}>
        <Card title="Your logo, your name, your colours" sub="Applied across the console as you change them" toneColor={PT_TONE}>
          <div className="stack" style={{ gap: 14 }}>
            <Field label="Logo shape">
              <div className="grid g2" style={{ gap: 8 }}>
                {(['square', 'wide'] as const).map((s) => (
                  <button key={s} className={`pt-tierCard ${brand.logoShape === s ? 'on' : ''}`} onClick={() => set({ logoShape: s })} style={{ padding: '9px 11px' }}>
                    <b style={{ fontSize: 12.5 }}>{s === 'square' ? 'Square · 1:1' : 'Wide · 3:1 to 4:1'}</b>
                    <span className="muted" style={{ fontSize: 11 }}>{s === 'square' ? 'Your mark, with your name beside it' : 'Your full lockup, name included'}</span>
                  </button>
                ))}
              </div>
            </Field>
            <div className="pt-form">
              <Field label="Logo" hint="PNG, SVG or JPG · 256×256 or larger">
                <div className="row" style={{ gap: 6 }}>
                  <label className="btn sm" style={{ cursor: 'pointer' }}><Upload /> Choose file<input type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} /></label>
                  {brand.logoImage && <Btn sm ghost onClick={() => set({ logoImage: null })}><X /> Remove</Btn>}
                </div>
              </Field>
              <Field label="Monogram (no logo)"><input className="input" maxLength={3} value={brand.logoText} onChange={(e) => set({ logoText: e.target.value.toUpperCase() })} /></Field>
              <Field label="Software name" hint="Set beside your mark in the rail" full><input className="input" value={brand.productName} onChange={(e) => set({ productName: e.target.value })} /></Field>
            </div>
            <Field label="Theme colours" hint="These colour the console itself: header, rail and controls">
              <div className="row wrap" style={{ gap: 6, marginBottom: 8 }}>
                {PRESETS.map((p) => (
                  <button key={p.name} className={`pt-swatch ${brand.primary === p.primary ? 'on' : ''}`} title={p.name} style={{ background: `linear-gradient(135deg, ${p.sidebar} 50%, ${p.primary} 50%)` }} onClick={() => set({ primary: p.primary, sidebar: p.sidebar, accent: p.accent })} />
                ))}
              </div>
              <div className="grid g3" style={{ gap: 8 }}>
                {([['primary', 'Primary'], ['sidebar', 'Side menu'], ['accent', 'Accent']] as const).map(([k, l]) => (
                  <label key={k} className="pt-color">
                    <input type="color" value={brand[k]} onChange={(e) => set({ [k]: e.target.value } as Partial<Brand>)} />
                    <span><b style={{ fontSize: 11.5, display: 'block' }}>{l}</b><span className="mono muted" style={{ fontSize: 10.5 }}>{brand[k].toUpperCase()}</span></span>
                  </label>
                ))}
              </div>
            </Field>
            <div className="stack" style={{ gap: 4 }}>
              <SectionLabel>Accessibility check (WCAG 2.2)</SectionLabel>
              {[['White text on primary', cPrimary], ['White text on side menu', cSide]].map(([l, v]) => (
                <div key={String(l)} className="row" style={{ fontSize: 12 }}>
                  {Number(v) >= 4.5 ? <CheckCircle2 size={14} color="var(--good)" /> : <AlertTriangle size={14} color="var(--sev-medium)" />}
                  <span style={{ flex: 1 }}>{l}</span>
                  <b className="num">{Number(v).toFixed(2)}:1</b>
                  <Badge color={Number(v) >= 4.5 ? 'var(--good)' : Number(v) >= 3 ? 'var(--sev-medium)' : 'var(--bad)'}>{Number(v) >= 4.5 ? 'AA' : Number(v) >= 3 ? 'AA large' : 'Fail'}</Badge>
                </div>
              ))}
            </div>
            <div className="pt-form">
              <Field label="Typeface"><Seg options={[{ id: 'Inter', label: 'Inter' }, { id: 'Space Grotesk', label: 'Grotesk' }, { id: 'System', label: 'System' }]} value={brand.font} onChange={(v) => set({ font: v })} /></Field>
              <Field label="Default theme"><Seg options={[{ id: 'dark', label: 'Dark' }, { id: 'light', label: 'Light' }]} value={brand.mode} onChange={(v) => set({ mode: v })} /></Field>
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <div className="row"><Toggle on={brand.serviceNames} onChange={(v) => set({ serviceNames: v })} /><span style={{ fontSize: 12.5 }}>Use your own service names (e.g. “{brand.productName.split(' ')[0]} MDR” for HexaSOC)</span></div>
              <div className="row"><Toggle on={brand.poweredBy} onChange={(v) => set({ poweredBy: v })} /><span style={{ fontSize: 12.5 }}>Show “Powered by HexaShield” in the footer</span></div>
            </div>
            <div className="row">
              <Btn ghost onClick={() => { resetBrand(); toast('Brand reset to the published v7 theme'); }}><RotateCcw /> Reset</Btn>
              <span className="spacer" />
              <Btn primary color={PT_TONE} onClick={() => setPublish(true)}><Rocket /> Publish to clients</Btn>
            </div>
          </div>
        </Card>

        <div className="stack" style={{ gap: 16, position: 'sticky', top: 76 }}>
          <Card title="What your client sees" sub="The side rail, an active tab and live tiles, drawn from your settings" actions={<select className="select" value={clientId} onChange={(e) => setClientId(e.target.value)}>{book.map((c) => <option key={c.id} value={c.id}>Preview as {c.short}</option>)}</select>}>
            <BrandPreview brand={brand} client={client} />
            <p className="muted" style={{ fontSize: 11, marginTop: 8 }}>Modules switched off for {client.short} show a padlock in the rail. Product pages keep their own module colours.</p>
          </Card>
          <Card title="Where your brand appears">
            <div className="grid g2" style={{ gap: '4px 16px' }}>
              {SURFACES.map((s) => (
                <div key={s.name} className="row" style={{ fontSize: 12, padding: '4px 0' }}>
                  {s.status === 'live' ? <CheckCircle2 size={14} color="var(--good)" /> : <AlertTriangle size={14} color="var(--sev-medium)" />}
                  <span style={{ flex: 1 }}>{s.name}</span>
                  {s.status !== 'live' && <Badge color="var(--sev-medium)">Draft</Badge>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div id="pt-history">
        <Card title="Publish history" sub="Every theme change is versioned and recorded in the audit ledger">
          <Timeline
            items={[
              { time: '12 d ago', title: 'v7 · Accent changed to amber; service names enabled', body: 'Published by Jack Turner to 15 client tenants', color: PT_TONE },
              { time: '41 d ago', title: 'v6 · Wide logo lockup for reports', body: 'Published by Elena Novak', color: 'var(--good)' },
              { time: '3 mo ago', title: 'v5 · Custom domain portal.northwindcyber.com', body: 'Published by Jack Turner', color: 'var(--good)' },
              { time: '7 mo ago', title: 'v4 · Light theme default for GRC users', body: 'Rolled back after 2 days (client feedback)', color: 'var(--sev-medium)' },
            ]}
          />
        </Card>
      </div>

      {publish && (
        <Modal
          title="Publish theme v8"
          sub={`Applies to ${book.length} client tenants · risk class: low · approved by you as partner admin`}
          onClose={() => setPublish(false)}
          footer={<><Btn onClick={() => setPublish(false)}>Cancel</Btn><Btn primary color={PT_TONE} onClick={() => { toast(`Theme v8 published to ${book.length} client tenants: users see it on next page load`); setPublish(false); }}>Publish v8</Btn></>}
        >
          {changed.length ? (
            <KV rows={changed.map((k) => [k, k === 'logoImage' ? 'New logo uploaded' : `${String(DEFAULT_BRAND[k])} → ${String(brand[k])}`])} />
          ) : (
            <p className="secondary" style={{ fontSize: 12.5 }}>No changes from v7: publishing re-applies the current theme.</p>
          )}
          <div style={{ marginTop: 12 }}>
            <Callout>Emails and PDF reports use the new theme from the next send. Client admins are notified in-app; nothing about their data or access changes.</Callout>
          </div>
        </Modal>
      )}
    </>
  );
}
