import { useMemo, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { Blend } from 'lucide-react';
import { useApp } from '../../state/AppContext';
import { MODULE_BY_ID } from '../../modules/registry';
import { siemName, edrName, purpleSprints, PURPLE_COLOR, type PurpleSprint, type PurpleResult, type PurpleTechnique } from '../../data/modules/strike';
import { RecordsDrawer } from './parts';
import { Card, KpiStrip, Badge, Btn, Legend, SectionLabel, MiniStat } from '../../components/ui';
import { Chart } from '../../components/Chart';
import { Drawer } from '../../components/Overlay';
import { fmtDur } from '../../lib/format';
import './strike.css';

const tone = MODULE_BY_ID.strike.tone;
const RESULTS: PurpleResult[] = ['blocked', 'detected', 'logged', 'missed'];
const RESULT_LABEL: Record<PurpleResult, string> = { blocked: 'Blocked', detected: 'Detected', logged: 'Logged only', missed: 'Missed' };
// Hex equivalents for canvas charts (CSS vars do not work inside ECharts).
const RESULT_HEX: Record<PurpleResult, string> = { blocked: '#2dd4bf', detected: '#68b1ff', logged: '#e8cf4f', missed: '#f87171' };
const STRIKE_HEX = '#f8646f';

export default function StrikePurple() {
  const { customer: c } = useApp();
  const nav = useNavigate();
  const sprints = useMemo(() => purpleSprints(c), [c]);
  const [sel, setSel] = useState<PurpleSprint | null>(null);
  const [tlist, setTlist] = useState<{ title: string; rows: (PurpleTechnique & { sprint: string })[] } | null>(null);
  const [slist, setSlist] = useState(false);
  const allTech = sprints.flatMap((sp) => sp.techniques.map((t) => ({ ...t, sprint: sp.label })));
  const PSRC = 'HexaStrike purple sprints · ' + siemName(c) + ' · ' + edrName(c);

  const latest = sprints[sprints.length - 1];
  const totals = sprints.reduce(
    (a, s) => ({ tested: a.tested + s.tested, created: a.created + s.rulesCreated, tuned: a.tuned + s.rulesTuned }),
    { tested: 0, created: 0, tuned: 0 },
  );
  const allTtds = sprints.flatMap((s) => s.techniques.map((t) => t.ttdMin).filter((x): x is number => x !== undefined));
  const medTtd = allTtds.length ? [...allTtds].sort((a, b) => a - b)[Math.floor(allTtds.length / 2)] : 0;

  // TTD distribution buckets
  const ttdBuckets = ['<1m', '1–5m', '5–15m', '15–30m', '30m+'];
  const ttdDist = [0, 0, 0, 0, 0];
  allTtds.forEach((t) => {
    ttdDist[t < 1 ? 0 : t < 5 ? 1 : t < 15 ? 2 : t < 30 ? 3 : 4]++;
  });

  return (
    <>
      <p className="page-intro">
        <b>{c.name}</b> · fortnightly purple-team sprints: test a technique, see whether it is blocked, detected, logged only or missed, tune or create a rule, and feed the result into the closed loop. Detections written to {siemName(c)}.
      </p>

      <KpiStrip
        toneColor={tone}
        items={[
          { label: 'Sprints', hint: 'fortnightly', value: sprints.length, toneColor: tone, onClick: () => setSlist(true), source: 'HexaStrike purple-team register' },
          { label: 'Techniques tested', value: totals.tested, toneColor: tone, onClick: () => setTlist({ title: 'Techniques tested', rows: allTech }), source: PSRC },
          { label: 'Rules created', value: totals.created, toneColor: 'var(--good)', onClick: () => setTlist({ title: 'Techniques that produced a new rule', rows: allTech.filter((t) => t.ruleAction === 'New rule') }), source: siemName(c) + ' rule changes' },
          { label: 'Rules tuned', value: totals.tuned, toneColor: 'var(--sev-medium)', onClick: () => setTlist({ title: 'Techniques whose rule was tuned', rows: allTech.filter((t) => t.ruleAction === 'Tuned') }), source: siemName(c) + ' rule changes' },
          { label: 'Median time to detect', value: fmtDur(medTtd), toneColor: 'var(--sev-medium)', onClick: () => setTlist({ title: 'Detected or blocked techniques', rows: allTech.filter((t) => t.ttdMin !== undefined) }), source: siemName(c) + ' alert timestamps' },
          { label: 'Coverage now', value: `${latest.coverageAfter}%`, bar: latest.coverageAfter, toneColor: tone, to: '/soc/attack', source: 'HexaMatrix ATT&CK coverage' },
        ]}
      />

      <div className="grid g-3-2">
        <Card title="Outcome per technique by sprint" sub="Blocked / detected / logged only / missed">
          <Chart
            height={260}
            option={{
              legend: { data: RESULTS.map((r) => RESULT_LABEL[r]), bottom: 0 },
              grid: { left: 8, right: 12, top: 16, bottom: 34, containLabel: true },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: { type: 'category', data: sprints.map((s) => s.label) },
              yAxis: { type: 'value', name: 'techniques' },
              series: RESULTS.map((r) => ({
                name: RESULT_LABEL[r], type: 'bar', stack: 'o', barMaxWidth: 26,
                data: sprints.map((s) => s[r]),
                itemStyle: { color: RESULT_HEX[r] },
              })),
            }}
          />
        </Card>

        <Card title="Before / after coverage" sub="ATT&CK coverage lift across sprints">
          <Chart
            height={260}
            option={{
              legend: { data: ['Before', 'After'], top: 0 },
              grid: { left: 8, right: 12, top: 26, bottom: 6, containLabel: true },
              tooltip: { trigger: 'axis' },
              xAxis: { type: 'category', data: sprints.map((s) => s.label) },
              yAxis: { type: 'value', name: '% coverage', max: 100 },
              series: [
                { name: 'Before', type: 'line', smooth: true, data: sprints.map((s) => s.coverageBefore), lineStyle: { color: '#8593b4', type: 'dashed' }, itemStyle: { color: '#8593b4' }, symbol: 'none' },
                { name: 'After', type: 'line', smooth: true, data: sprints.map((s) => s.coverageAfter), areaStyle: { color: 'rgba(248,100,111,.2)' }, lineStyle: { color: STRIKE_HEX, width: 2 }, itemStyle: { color: STRIKE_HEX } },
              ],
            }}
          />
        </Card>
      </div>

      <div className="grid g-2-1">
        <Card title="Sprints" count={sprints.length} sub="Click a sprint for per-technique results" flush>
          <div className="list" style={{ padding: '0 18px 8px' }}>
            {[...sprints].reverse().map((s) => (
              <button key={s.id} className="list-row" onClick={() => setSel(s)}>
                <span className="list-main">
                  <b>Sprint ending {s.label}</b>
                  <span>{s.tested} techniques · {s.rulesCreated} new rules · {s.rulesTuned} tuned</span>
                </span>
                <span className="chips">
                  <Badge color="var(--good)">{s.blocked} blk</Badge>
                  <Badge color="#68b1ff">{s.detected} det</Badge>
                  <Badge color="var(--bad)">{s.missed} miss</Badge>
                </span>
              </button>
            ))}
          </div>
        </Card>

        <Card title="Time to detect" sub="Distribution across all sprints">
          <Chart
            height={200}
            option={{
              grid: { left: 8, right: 12, top: 10, bottom: 6, containLabel: true },
              tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
              xAxis: { type: 'category', data: ttdBuckets },
              yAxis: { type: 'value', name: 'techniques' },
              series: [{ type: 'bar', barMaxWidth: 30, data: ttdDist, itemStyle: { color: STRIKE_HEX, borderRadius: [3, 3, 0, 0] } }],
            }}
          />
          <div className="mini-stats" style={{ marginTop: 8 }}>
            <MiniStat value={fmtDur(medTtd)} label="Median TTD" color={tone} />
            <MiniStat value={`${latest.coverageAfter - sprints[0].coverageBefore}%`} label="Coverage lift" color="var(--good)" />
          </div>
        </Card>
      </div>

      <Card toneColor={tone} tinted>
        <div className="row between">
          <div>
            <b style={{ fontSize: 13 }}>Results feed the closed loops</b>
            <div className="card-sub">Every tuned or created detection links control → ATT&CK → detection → validation.</div>
          </div>
          <Btn primary color={tone} onClick={() => nav('/loop')}>Open closed-loop assurance →</Btn>
        </div>
      </Card>

      {tlist && (
        <RecordsDrawer
          title={tlist.title}
          rows={tlist.rows}
          source={[PSRC]}
          onClose={() => setTlist(null)}
          openTo="/soc/detection"
          openLabel="Open Detection Engineering"
          columns={[
            { key: 's', header: 'Sprint', sort: (t) => t.sprint, render: (t) => t.sprint },
            { key: 't', header: 'Technique', render: (t) => (<><div className="t-main">{t.name}</div><div className="t-sub mono">{t.technique}</div></>) },
            { key: 'r', header: 'Result', sort: (t) => t.result, render: (t) => <Badge color={PURPLE_COLOR[t.result]} dot>{RESULT_LABEL[t.result]}</Badge> },
            { key: 'a', header: 'Rule', render: (t) => t.ruleAction },
            { key: 'd', header: 'Time to detect', align: 'right', sort: (t) => t.ttdMin ?? 9999, render: (t) => t.ttdMin !== undefined ? fmtDur(t.ttdMin) : '—' },
          ]}
        />
      )}
      {slist && (
        <RecordsDrawer
          title="Purple-team sprints"
          rows={[...sprints].reverse()}
          source={['HexaStrike purple-team register']}
          onClose={() => setSlist(false)}
          onRow={(sp) => { setSlist(false); setSel(sp); }}
          columns={[
            { key: 'l', header: 'Sprint', render: (sp) => sp.label },
            { key: 't', header: 'Tested', align: 'right', render: (sp) => sp.tested },
            { key: 'm', header: 'Missed', align: 'right', render: (sp) => sp.missed },
            { key: 'n', header: 'New rules', align: 'right', render: (sp) => sp.rulesCreated },
            { key: 'c', header: 'Coverage', align: 'right', render: (sp) => `${sp.coverageBefore}% → ${sp.coverageAfter}%` },
          ]}
        />
      )}

      {sel && (
        <Drawer
          wide
          title={`Sprint ending ${sel.label}`}
          sub={`${sel.tested} techniques tested`}
          icon={<span className="ico-box" style={{ '--tone': tone } as CSSProperties}><Blend /></span>}
          onClose={() => setSel(null)}
          footer={<><Btn ghost onClick={() => setSel(null)}>Close</Btn><Btn primary color={tone} onClick={() => { setSel(null); nav('/loop'); }}>View loops</Btn></>}
        >
          <div className="mini-stats">
            <MiniStat value={sel.blocked} label="Blocked" color="var(--good)" />
            <MiniStat value={sel.detected} label="Detected" color="#68b1ff" />
            <MiniStat value={sel.logged} label="Logged only" color="var(--sev-low)" />
            <MiniStat value={sel.missed} label="Missed" color="var(--bad)" />
          </div>
          <SectionLabel>Techniques</SectionLabel>
          <div className="stack" style={{ gap: 6 }}>
            {sel.techniques.map((t) => (
              <div key={t.technique} className="row" style={{ fontSize: 12, gap: 8, alignItems: 'center' }}>
                <span className="strike-chip-f" style={{ background: 'var(--m-strike)', color: '#fff' }}>{t.technique}</span>
                <span style={{ flex: 1 }}>{t.name}</span>
                {t.ttdMin !== undefined && <span className="muted" style={{ fontSize: 11 }}>{fmtDur(t.ttdMin)}</span>}
                <Badge color={PURPLE_COLOR[t.result]} dot>{RESULT_LABEL[t.result]}</Badge>
                <span className="src-chip">{t.ruleAction}</span>
              </div>
            ))}
          </div>
          <SectionLabel>Coverage</SectionLabel>
          <Legend items={[{ label: `Before ${sel.coverageBefore}%`, color: '#8593b4' }, { label: `After ${sel.coverageAfter}%`, color: tone }]} />
        </Drawer>
      )}
    </>
  );
}
