import type { CustomerId, Persona } from '../data/types';

/** Where a step points. `sel` (CSS) or `text` (visible text, smallest match), then `up` climbs to a wrapping block. */
export interface TourTarget {
  /** A card whose title contains this text. */
  card?: string;
  sel?: string;
  text?: string;
  up?: string;
}

export interface TourStep {
  path: string;
  title: string;
  body: string;
  target?: TourTarget;
  /** What the presenter might say or click next; shown as a hint line. */
  tip?: string;
}

export interface Story {
  id: string;
  title: string;
  blurb: string;
  audience: string;
  minutes: number;
  customer: CustomerId;
  persona: Persona;
  color: string;
  steps: TourStep[];
}

export const STORIES: Story[] = [
  {
    id: 'cve',
    title: '9.9 day',
    blurb: 'A critical vulnerability lands. Are we exposed, is it patched, and can we prove it to our customers today?',
    audience: 'CISO · customers asking "are you affected?"',
    minutes: 5,
    customer: 'finserv',
    persona: 'master',
    color: '#f0466e',
    steps: [
      {
        path: '/',
        title: 'It starts on the Command Centre',
        body: 'A CVSS 9.9 vulnerability is being exploited in the wild. HexaView has already matched it against the estate and put it at the top of the attention queue, before anyone has asked.',
        target: { text: 'Critical vulnerability CVE', up: '.list-row, button, .att-row, li' },
        tip: 'Point out that nobody had to search for it.',
      },
      {
        path: '/int/vulnresponse?section=advisories',
        title: 'The advisory, in plain English',
        body: 'HexaInt shows what the flaw is, whether it is on the known-exploited list, the interim mitigation and, most importantly, the verdict for this customer: affected.',
        target: { sel: '.vr-hero' },
      },
      {
        path: '/int/vulnresponse?section=exposure',
        title: '"Do we use it?" answered in seconds',
        body: 'Matched across HexaCore assets, the security tooling, OT and third-party suppliers. Every count opens the exact list behind it.',
        target: { sel: '.vr-srcgrid' },
        tip: 'Click a source card to show the evidence list.',
      },
      {
        path: '/fabric/sbom?section=hidden',
        title: 'The exposure nobody knew about',
        body: 'The software bill of materials finds the vulnerable component buried inside vendor products the asset scan could never see. This is the moment that usually lands with a CISO.',
        target: { text: 'did not know about', up: '.card, section' },
      },
      {
        path: '/int/vulnresponse?section=patch',
        title: '"Is it patched?" tracked live',
        body: 'Every affected asset with owner, SLA and internet exposure, a burn-down since disclosure, and validation scans to prove each fix.',
        target: { sel: '.vr-progress', up: '.card' },
        tip: 'Open an asset and mark it patched: every count updates.',
      },
      {
        path: '/int/vulnresponse?section=suppliers',
        title: 'Ask the suppliers in one click',
        body: 'A three-question "are you affected?" goes to every relevant supplier through Third-Party Risk, and the answers flow back into the same tracker.',
        target: { text: 'Ask affected suppliers', up: '.card' },
      },
      {
        path: '/int/vulnresponse?section=statement',
        title: 'The statement your customers asked for',
        body: 'Pick the audience (customer, board, regulator or insurer) and generate a signed exposure statement with timeline and evidence trail, minutes after disclosure.',
        target: { text: 'Generate exposure statement', up: '.card' },
        tip: 'Generate it live, then Download PDF.',
      },
    ],
  },
  {
    id: 'board',
    title: 'Board morning',
    blurb: 'One evidenced answer to "are we covered?", what it is worth, and what is coming next.',
    audience: 'Board · CFO · CEO',
    minutes: 5,
    customer: 'finserv',
    persona: 'master',
    color: '#2fbfa0',
    steps: [
      {
        path: '/',
        title: 'One explainable score',
        body: 'The Resilience Index rolls every capability into one number the board can follow over time. Each gauge feeds it live, and every number opens its source.',
        target: { sel: '.rh-top', up: '.card' },
      },
      {
        path: '/loop',
        title: 'Proven, not documented',
        body: 'Closed-loop assurance traces each control from requirement to a validated detection. The gap between documented and assured is the honest picture of risk.',
        target: { sel: '.lm', up: '.card' },
        tip: 'Let the loop run once: closed, then open.',
      },
      {
        path: '/board/view',
        title: 'The board view',
        body: 'Top risks, financial exposure and the trend, written for a board pack with every statement cited back to evidence.',
        target: { sel: '.board-hero, .card', up: '.card' },
      },
      {
        path: '/reports/value',
        title: 'What it is worth',
        body: 'Value delivered against cost: incidents contained, analyst hours saved, loss avoided and premium savings, each with its formula and source.',
        target: { text: 'for every', up: '.card' },
      },
      {
        path: '/comply/horizon?section=board',
        title: 'What is coming next',
        body: 'The next twelve months of regulation, what it will cost and the decisions needed now, ready to print for the board.',
        target: { sel: '.hz-brief-hero, .hz-brief' },
      },
      {
        path: '/insurance/pack',
        title: 'Evidence the insurer prices on',
        body: 'The same live evidence becomes the insurer pack for renewal: continuous proof of the controls they price on, straight from the environment.',
        target: { card: 'Signed pack' },
      },
    ],
  },
  {
    id: 'ot',
    title: 'Ransomware at the port',
    blurb: 'An OT alert at a terminal escalates into a crisis: contain it, hit every regulatory clock, and learn from it.',
    audience: 'COO · OT and security operations',
    minutes: 6,
    customer: 'maritime',
    persona: 'master',
    color: '#f5a83d',
    steps: [
      {
        path: '/ot/alerts',
        title: 'Something is wrong on the quay',
        body: 'HexaOT flags an unscheduled PLC programme download to a crane controller from a jump host, outside the change window. OT stays read-only: HexaView never writes back to OT.',
        target: { sel: '.card', up: '.card' },
      },
      {
        path: '/soc/ir?status=open',
        title: 'HexaSOC takes it',
        body: 'The SOC correlates it with hands-on-keyboard activity on an engineering workstation and isolates the IT side, leaving the OT side for approval. The regulatory clocks start automatically.',
        target: { card: 'Regulatory clocks running' },
      },
      {
        path: '/ops/warroom',
        title: 'Crisis war room',
        body: 'One room for the response: roles, the bridge, decisions and every regulatory and contractual clock counting down, from NIS2 to the insurer.',
        target: { card: 'Regulatory & contractual clocks' },
      },
      {
        path: '/ops/exercises?section=after-action',
        title: 'Practised, then improved',
        body: 'The same scenario was exercised last quarter. Scores by capability, lessons learned and the actions raised show the team was ready.',
        target: { card: 'Lessons learned' },
      },
      {
        path: '/comply/caas?section=tasks',
        title: 'Evidence lands in HexaComply',
        body: 'Every action and its evidence is captured as the team works, so the regulator report and the audit are an export, not a scramble.',
        target: { sel: '.cmp-intro' },
      },
    ],
  },
  {
    id: 'trust',
    title: 'The questionnaire',
    blurb: 'A customer sends 300 security questions. Answer them from live evidence in a day, not three weeks.',
    audience: 'Sales · GRC · customer assurance',
    minutes: 4,
    customer: 'media',
    persona: 'master',
    color: '#a07cfb',
    steps: [
      {
        path: '/trust/overview',
        title: 'Three weeks down to a day',
        body: 'Trust Centre drafts questionnaire answers from live evidence already in HexaView. Turnaround, auto-answered share and deals unblocked are tracked here.',
        target: { sel: '.kpi-strip, .kpis', up: '.kpi-strip, .kpis, .card' },
      },
      {
        path: '/trust/questionnaires',
        title: 'Drafted, cited, approved',
        body: 'Every answer is drafted with its evidence cited: controls, pen tests, SOC metrics, insurance. A human approves before anything goes back to the customer.',
        target: { sel: '.card', up: '.card' },
        tip: 'Open a questionnaire and bulk-approve the high-confidence answers.',
      },
      {
        path: '/trust/answers',
        title: 'Answers that stay true',
        body: 'When the underlying evidence changes, for example a new pen test, the answers that rely on it are flagged stale until someone re-approves them.',
        target: { sel: '.card', up: '.card' },
      },
      {
        path: '/trust/portal',
        title: 'A trust portal customers can rely on',
        body: 'Share the live Resilience badge, certifications and documents, each with its own release level from public to signed NDA.',
        target: { text: 'Public trust page preview', up: '.card' },
      },
    ],
  },
];

export const STORY_BY_ID = Object.fromEntries(STORIES.map((s) => [s.id, s])) as Record<string, Story>;
