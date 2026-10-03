import { useMemo, useState, type CSSProperties } from 'react';
import { BookOpenText, FileWarning, Megaphone, MailWarning, Wrench, Radar, ArrowRight } from 'lucide-react';
import { Card, Badge, Btn, IcoBox, Callout } from '../../components/ui';
import { Drawer } from '../../components/Overlay';
import { insights, techName, type Insight, type InsightCat } from '../../data/modules/soc';
import { daysAgo, fmtDate } from '../../lib/format';
import { useSoc, StatTile, Pills, TechChips, useParamFilter } from './parts';

const CAT_COLOR: Record<InsightCat, string> = { 'Incident report': '#e0345e', Advisory: '#f5a83d', Phishing: '#a78bfa', 'Patch update': '#2dd4bf', 'Threat brief': '#4f8cff' };
const CAT_ICON = { 'Incident report': FileWarning, Advisory: Megaphone, Phishing: MailWarning, 'Patch update': Wrench, 'Threat brief': Radar } as const;
type F = 'all' | InsightCat;

export default function SocInsight() {
  const { c, tone, scopeLabel, nav, toast } = useSoc();
  const items = useMemo(() => insights(c), [c]);
  const [f, setF] = useParamFilter<F>('category', ['all', 'Incident report', 'Advisory', 'Phishing', 'Patch update', 'Threat brief'] as const, 'all');
  const [sel, setSel] = useState<Insight | null>(null);
  const cats = Object.keys(CAT_COLOR) as InsightCat[];
  const rows = items.filter((x) => f === 'all' || x.cat === f);
  const latest = items[0];
  const n = (k: InsightCat) => items.filter((x) => x.cat === k).length;
  const src = 'HexaSOC analysts · HexaInt';

  return (
    <>
      <p className="page-intro">
        <b>{scopeLabel}</b> · security updates, advisories and incident write-ups from your HexaSOC team, written for {c.short} and linked to the evidence behind them.
      </p>

      <div className="soc-stats">
        {cats.filter((k) => n(k) > 0).map((k) => {
          const Ico = CAT_ICON[k];
          return <StatTile key={k} icon={<Ico />} value={n(k)} label={`${k}${n(k) === 1 ? '' : 's'}`} tone={CAT_COLOR[k]} onClick={() => setF(f === k ? 'all' : k)} source={src} />;
        })}
      </div>

      {latest && f === 'all' && (
        <Card toneColor={CAT_COLOR[latest.cat]} tinted>
          <div className="row wrap" style={{ gap: 18, alignItems: 'flex-start' }}>
            <IcoBox color={CAT_COLOR[latest.cat]}><BookOpenText /></IcoBox>
            <div className="stack" style={{ gap: 6, flex: 1, minWidth: 260 }}>
              <span className="section-label" style={{ margin: 0, color: CAT_COLOR[latest.cat] }}>Latest · {latest.cat}</span>
              <h3 style={{ fontSize: 18 }}>{latest.title}</h3>
              <p className="soc-prose">{latest.summary}</p>
              <span className="row" style={{ gap: 10 }}>
                <Btn primary sm onClick={() => setSel(latest)}>Read article <ArrowRight size={13} /></Btn>
                <span className="muted" style={{ fontSize: 12 }}>{fmtDate(daysAgo(latest.daysAgo))} · {latest.read} min read · {latest.author}</span>
              </span>
            </div>
          </div>
        </Card>
      )}

      <Card title="All articles" count={rows.length} actions={<Pills value={f} onChange={setF} tone={tone} items={[{ id: 'all', label: 'All', n: items.length }, ...cats.filter((k) => n(k) > 0).map((k) => ({ id: k, label: k, n: n(k) }))]} />}>
        <div className="soc-articles">
          {rows.map((x) => (
            <button key={x.id} type="button" className="soc-article" style={{ '--tone': CAT_COLOR[x.cat] } as CSSProperties} onClick={() => setSel(x)}>
              <span className="k">{x.cat}</span>
              <h4>{x.title}</h4>
              <p>{x.summary}</p>
              <TechChips ids={x.techniques} max={3} />
              <span className="f"><span>{fmtDate(daysAgo(x.daysAgo))} · {x.read} min read</span><span style={{ color: 'var(--tone)' }}>Read article →</span></span>
            </button>
          ))}
        </div>
      </Card>

      {sel && (
        <Drawer
          wide
          title={sel.title}
          sub={<span className="row wrap" style={{ gap: 6 }}><Badge color={CAT_COLOR[sel.cat]}>{sel.cat}</Badge>{fmtDate(daysAgo(sel.daysAgo))} · {sel.read} min read · {sel.author}</span>}
          icon={<IcoBox color={CAT_COLOR[sel.cat]}><BookOpenText /></IcoBox>}
          onClose={() => setSel(null)}
          footer={
            <>
              <Btn onClick={() => toast(`"${sel.title}" shared with ${c.people.ciso.name} and ${c.people.socLead.name}`)}>Share</Btn>
              {sel.cat === 'Incident report' && <Btn onClick={() => nav('/soc/ir?status=closed')}>Related incidents <ArrowRight size={14} /></Btn>}
              {sel.cat === 'Patch update' && <Btn onClick={() => nav('/soc/endpoint?severity=critical')}>Open vulnerabilities <ArrowRight size={14} /></Btn>}
              {(sel.cat === 'Advisory' || sel.cat === 'Threat brief') && <Btn onClick={() => nav('/soc/attack')}>See coverage in HexaMatrix <ArrowRight size={14} /></Btn>}
              {sel.cat === 'Phishing' && <Btn onClick={() => nav('/soc/identity?ca=Failed')}>Affected identities <ArrowRight size={14} /></Btn>}
            </>
          }
        >
          <div className="stack" style={{ gap: 16 }}>
            <p className="soc-prose" style={{ fontSize: 14 }}><b>{sel.summary}</b></p>
            <div className="soc-prose">{sel.body.map((p, i) => <p key={i}>{p}</p>)}</div>
            <div>
              <div className="section-label">What we recommend</div>
              <ul className="soc-changes">{sel.actions.map((a) => <li key={a}>{a}</li>)}</ul>
            </div>
            <div>
              <div className="section-label">ATT&CK techniques</div>
              <div className="stack" style={{ gap: 4, fontSize: 12.5 }}>
                {sel.techniques.map((t) => <span key={t}><span className="soc-tech">{t}</span> {techName(t)}</span>)}
              </div>
            </div>
            <Callout>Written by {sel.author} for {c.name}. Indicators mentioned are already deployed to {c.connectors.find((k) => k.category === 'SIEM')?.product ?? 'your SIEM'} and the HexaInt block lists.</Callout>
          </div>
        </Drawer>
      )}
    </>
  );
}
