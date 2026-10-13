import React from "react";
import { Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, Hex, MONO, Stage, prog } from "../theme";
import { Callout, ConsoleShot, Eyebrow, Headline, PoweredBadge, Spotlight, Sub, TAFA, TafaCard } from "./common";

const Icon: React.FC<{ d: React.ReactNode; size: number; color?: string }> = ({ d, size, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
export const ICONS = {
  clinic: <><path d="M6 3v6a4 4 0 008 0V3" /><path d="M10 13v3a4 4 0 008 0v-2" /><circle cx="18" cy="12" r="2" /></>,
  heart: <><path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11z" /><path d="M8 12h2l1-2 2 4 1-2h2" /></>,
  lab: <><path d="M9 3h6M10 3v6L5 19a1.5 1.5 0 001.3 2h11.4A1.5 1.5 0 0019 19l-5-10V3" /><path d="M7.5 15h9" /></>,
  hospital: <><rect x="4" y="6" width="16" height="15" rx="1" /><path d="M12 9v6M9 12h6" /><path d="M9 3h6v3H9z" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  pc: <><rect x="3" y="4" width="18" height="12" rx="1" /><path d="M8 20h8M12 16v4" /></>,
  laptop: <><rect x="5" y="5" width="14" height="10" rx="1" /><path d="M3 19h18" /></>,
  imaging: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2" /></>,
  analyser: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 7h8M8 11h8" /><circle cx="9" cy="16" r="1.4" /><circle cx="15" cy="16" r="1.4" /></>,
  paper: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
};

const Badge: React.FC = () => {
  const frame = useCurrentFrame();
  return <PoweredBadge show={prog(frame, 10, 24)} top={986} right={36} />;
};

/** 1 · Co-brand opening: TAFA, powered by HexaShield, and the Act. */
export const HcIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const tafa = prog(frame, 0, 14); // visible from the first frames, so the poster frame is branded
  const times = prog(frame, 14, 28);
  const hv = prog(frame, 22, 46);
  const pw = prog(frame, 40, 58);
  const swap = prog(frame, 64, 84);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: interpolate(swap, [0, 1], [380, 170]), display: "flex", alignItems: "center", justifyContent: "center", gap: 46, transform: `scale(${1 - swap * 0.25})` }}>
        <div style={{ opacity: 0.4 + tafa * 0.6, transform: `scale(${0.9 + tafa * 0.1})` }}>
          <TafaCard height={170} />
        </div>
        <div style={{ fontSize: 80, fontWeight: 300, color: C.dim, opacity: times }}>×</div>
        <div style={{ opacity: hv, transform: `translateX(${(1 - hv) * 40}px)`, display: "flex", flexDirection: "column", gap: 14 }}>
          <Img src={staticFile("brand/HexaView_logo_reverse.png")} style={{ width: 620, height: 620 * (348 / 1194) }} />
          <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.24em", color: C.dim, paddingLeft: 14, opacity: pw }}>
            POWERED BY <span style={{ color: C.tealBright }}>HEXASHIELD</span>
          </div>
        </div>
      </div>
      <Eyebrow frame={frame} at={80} top={500}>A BRIEFING FOR SINGAPORE HEALTHCARE PROVIDERS</Eyebrow>
      <Headline frame={frame} at={88} top={560} size={110}>
        The Health Information Act.
      </Headline>
      <Sub frame={frame} at={104} top={720}>A guided path to readiness, from TAFA, powered by HexaShield.</Sub>
    </Stage>
  );
};

/** 2 · Patient records now follow the patient. */
export const HcRecords: React.FC = () => {
  const frame = useCurrentFrame();
  const NODES = [
    { label: "GP clinic", icon: ICONS.clinic },
    { label: "Specialist", icon: ICONS.heart },
    { label: "Laboratory", icon: ICONS.lab },
    { label: "Hospital", icon: ICONS.hospital },
  ];
  const X = [420, 800, 1120, 1500];
  const Y = 470;
  const HUB = { x: 960, y: 800 };
  const walk = interpolate(frame, [20, 100], [0, 3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const seg = Math.min(2, Math.floor(walk));
  const px = X[seg] + (X[seg + 1] - X[seg]) * (walk - seg);
  const link = prog(frame, 100, 140);
  const lock = prog(frame, 150, 170);
  return (
    <Stage>
      <Headline frame={frame}>Patient records now follow the patient.</Headline>
      <Sub frame={frame} top={166}>Every provider contributes to the National Electronic Health Record.</Sub>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {X.map((x, i) => (
          <path key={i} d={`M ${x} ${Y + 110} Q ${x} ${HUB.y - 40} ${HUB.x} ${HUB.y}`} fill="none" stroke={C.tealBright} strokeWidth={3} opacity={0.75} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - link} />
        ))}
        {X.slice(0, -1).map((x, i) => (
          <line key={`w${i}`} x1={x + 110} y1={Y} x2={X[i + 1] - 110} y2={Y} stroke="rgba(140,170,255,0.4)" strokeWidth={3} strokeDasharray="8 10" />
        ))}
      </svg>

      {NODES.map((n, i) => {
        const p = prog(frame, 4 + i * 6, 20 + i * 6);
        const visited = walk >= i - 0.05;
        return (
          <React.Fragment key={n.label}>
            <Hex x={X[i]} y={Y} w={190} color={visited ? "#12305f" : "#0d1d42"} style={{ opacity: p, color: visited ? "#cfe3ff" : "#7f93bf", gap: 6 }}>
              <Icon d={n.icon} size={70} />
            </Hex>
            <div style={{ position: "absolute", left: X[i] - 140, top: Y + 120, width: 280, textAlign: "center", fontSize: 30, fontWeight: 700, opacity: p }}>{n.label}</div>
            <div style={{ position: "absolute", left: X[i] - 120, top: Y - 175, width: 240, textAlign: "center", opacity: p * (1 - link * 0.6) }}>
              <div style={{ display: "inline-block", fontFamily: MONO, fontSize: 18, color: "#f5d77a", background: "rgba(234,179,8,0.12)", border: "1px solid rgba(234,179,8,0.5)", borderRadius: 8, padding: "6px 12px" }}>a fragment of the record</div>
            </div>
          </React.Fragment>
        );
      })}

      {frame > 18 && frame < 112 && (
        <div style={{ position: "absolute", left: px - 26, top: Y - 108, width: 52, height: 52, borderRadius: "50%", background: TAFA.sky, boxShadow: `0 0 30px ${TAFA.sky}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="#06223a" strokeWidth={2.2} strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
        </div>
      )}

      <Hex x={HUB.x} y={HUB.y} w={170} color={C.teal} style={{ opacity: link, transform: `scale(${0.7 + link * 0.3})`, color: C.night }}>
        <Icon d={lock > 0.5 ? ICONS.shield : ICONS.paper} size={64} color="#05261f" />
      </Hex>
      <div style={{ position: "absolute", left: HUB.x + 120, top: HUB.y - 46, width: 560, opacity: link }}>
        <div style={{ fontSize: 30, fontWeight: 700 }}>National Electronic Health Record</div>
        <div style={{ fontFamily: MONO, fontSize: 20, color: C.tealBright, marginTop: 6, opacity: lock }}>SHARED DATA MUST BE PROTECTED</div>
        <div style={{ fontFamily: MONO, fontSize: 20, color: C.tealBright, opacity: lock }}>EVERYWHERE IT LANDS</div>
      </div>
      <div style={{ position: "absolute", left: 120, top: HUB.y - 30, width: 560, textAlign: "right", fontSize: 26, color: "#c8d4f0", opacity: lock }}>
        One security standard,
        <br />
        whatever your size.
      </div>
      <Badge />
    </Stage>
  );
};

/** 3 · The batches, and the grant deadline that comes first. */
export const HcDates: React.FC = () => {
  const frame = useCurrentFrame();
  const L = 170;
  const R = 1750;
  const x = (m: number) => L + (m / 42) * (R - L); // months from Sep 2026 to Mar 2030
  const Y = 430;
  const draw = prog(frame, 6, 40);
  const fill = prog(frame, 40, 90);
  const grant = prog(frame, 120, 140);
  const BATCHES = [
    { m: 12, label: "BATCH 1", date: "1 Sept 2027", who: "GP clinics · acute and community hospitals · clinical labs · radiology · nuclear medicine", main: true },
    { m: 24, label: "BATCH 2", date: "Sept 2028", who: "Specialist outpatient · nursing homes · renal dialysis · dental · ambulatory surgery", main: false },
    { m: 42, label: "BATCH 3", date: "Mar 2030", who: "Assisted reproduction · retail pharmacies", main: false },
  ];
  return (
    <Stage>
      <Headline frame={frame}>Every licence has a date.</Headline>
      <Sub frame={frame} top={166}>The obligation attaches to the licence, so a group with several licences has several deadlines.</Sub>

      <div style={{ position: "absolute", left: L, top: Y, width: (R - L) * draw, height: 6, borderRadius: 3, background: "rgba(140,170,255,0.35)" }} />
      <div style={{ position: "absolute", left: x(1), top: Y - 2, width: (x(12) - x(1)) * fill, height: 10, borderRadius: 5, background: `linear-gradient(90deg, ${C.tealBright}, ${TAFA.gold})` }} />
      <div style={{ position: "absolute", left: x(1) - 40, top: Y + 26, width: 80, textAlign: "center", fontFamily: MONO, fontSize: 18, color: C.tealBright, opacity: draw }}>NOW</div>
      <div style={{ position: "absolute", left: (x(1) + x(12)) / 2 - 120, top: Y - 44, width: 240, textAlign: "center", fontFamily: MONO, fontSize: 20, color: "#d8f3ec", opacity: fill }}>≈ 12 MONTHS</div>

      {BATCHES.map((b, i) => {
        const p = prog(frame, 30 + i * 14, 48 + i * 14);
        const w = b.main ? 560 : 420;
        const left = [300, 900, 1340][i];
        return (
          <React.Fragment key={b.label}>
            <div style={{ position: "absolute", left: x(b.m) - 14, top: Y - 11, width: 28, height: 28, borderRadius: "50%", background: b.main ? C.tealBright : "#7f93bf", boxShadow: b.main ? `0 0 30px ${C.tealBright}` : "none", opacity: p }} />
            <div
              style={{
                position: "absolute",
                left,
                top: Y + 80,
                width: w,
                padding: "22px 26px",
                boxSizing: "border-box",
                borderRadius: 20,
                background: b.main ? "rgba(58,208,174,0.12)" : "rgba(10,20,50,0.85)",
                border: `2px solid ${b.main ? C.tealBright : "rgba(140,170,255,0.3)"}`,
                boxShadow: b.main ? "0 0 50px rgba(58,208,174,0.25)" : "none",
                opacity: p * (b.main ? 1 : 0.85),
                transform: `translateY(${(1 - p) * 30}px)`,
              }}
            >
              <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.14em", color: b.main ? C.tealBright : C.dim }}>{b.label}</div>
              <div style={{ fontSize: b.main ? 52 : 40, fontWeight: 700, marginTop: 4 }}>{b.date}</div>
              <div style={{ fontSize: b.main ? 24 : 21, color: "#c8d4f0", marginTop: 10, lineHeight: 1.4 }}>{b.who}</div>
            </div>
          </React.Fragment>
        );
      })}

      {/* The grant window shuts a week before the obligation opens. */}
      <div style={{ position: "absolute", left: x(11.75) - 3, top: Y - 150, width: 6, height: 150, background: TAFA.gold, opacity: grant, transformOrigin: "bottom", transform: `scaleY(${grant})` }} />
      <div style={{ position: "absolute", left: x(11.75) - 330, top: Y - 210, width: 320, textAlign: "right", opacity: grant }}>
        <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.12em", color: TAFA.gold }}>31 AUG 2027</div>
        <div style={{ fontSize: 28, fontWeight: 700 }}>Grant applications close</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 880, textAlign: "center", fontSize: 38, fontWeight: 600, color: "#ffe2a8", opacity: prog(frame, 150, 168) }}>
        The funding window shuts before the obligation opens.
      </div>
      <Badge />
    </Stage>
  );
};

/** 4 · What every provider will be asked to do. */
export const HcObligation: React.FC = () => {
  const frame = useCurrentFrame();
  const COLS = [
    { title: "Cybersecurity", color: "#68B1FF", items: ["Prompt software updates", "Anti-malware", "Access control", "Secure configuration", "Separate backups", "New assets authorised"] },
    { title: "Data security", color: "#DF70A8", items: ["Know what data you hold", "Purpose-limited copying", "Secure transfer", "Safeguards in vendor contracts", "Physical security", "Retention and marking"] },
    { title: "Common practices", color: "#61C49A", items: ["Staff training", "Vendor management", "Internal audit", "Secure disposal", "Business continuity", "Incident response plan"] },
  ];
  const EST = [
    { label: "Reception PC", icon: ICONS.pc },
    { label: "Home laptop", icon: ICONS.laptop },
    { label: "Imaging systems", icon: ICONS.imaging },
    { label: "Analysers", icon: ICONS.analyser },
    { label: "Paper records", icon: ICONS.paper },
  ];
  return (
    <Stage>
      <Headline frame={frame}>What you’ll be asked to do.</Headline>
      <Sub frame={frame} top={166}>MOH’s Cybersecurity and Data Security Essentials, built with CSA, IMDA and the PDPC.</Sub>
      <div style={{ position: "absolute", left: 140, right: 140, top: 270, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 30 }}>
        {COLS.map((c, ci) => {
          const p = prog(frame, 14 + ci * 8, 32 + ci * 8);
          return (
            <div key={c.title} style={{ borderRadius: 22, background: "rgba(10,20,50,0.88)", border: `2px solid ${c.color}66`, padding: "24px 28px", opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
              <div style={{ fontSize: 34, fontWeight: 700, color: c.color, marginBottom: 12 }}>{c.title}</div>
              {c.items.map((it, i) => {
                const q = prog(frame, 30 + ci * 8 + i * 5, 40 + ci * 8 + i * 5);
                return (
                  <div key={it} style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 25, padding: "7px 0", opacity: q, transform: `translateX(${(1 - q) * 16}px)` }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                    {it}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 790, textAlign: "center", fontSize: 34, fontWeight: 700, opacity: prog(frame, 120, 136) }}>
        It covers everything, not just your clinical system.
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 856, display: "flex", justifyContent: "center", gap: 22 }}>
        {EST.map((e, i) => {
          const q = prog(frame, 132 + i * 6, 146 + i * 6);
          return (
            <div key={e.label} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 20px", borderRadius: 999, background: "rgba(10,20,50,0.9)", border: "1px solid rgba(140,170,255,0.4)", fontSize: 24, color: "#dfe7fb", opacity: q, transform: `scale(${0.8 + q * 0.2})` }}>
              <Icon d={e.icon} size={30} color={TAFA.sky} />
              {e.label}
            </div>
          );
        })}
      </div>
      <Badge />
    </Stage>
  );
};

/** 5 · The two-hour notification clock, and HexaView meeting it. */
export const HcTwoHours: React.FC = () => {
  const frame = useCurrentFrame();
  const R = 210;
  const CX = 470;
  const CY = 590;
  const circ = 2 * Math.PI * R;
  // The clock runs down while the questions land, then the real notification shows sent with time to spare.
  const run = interpolate(frame, [10, 140], [0, 0.55], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const sent = frame >= 170;
  const left = sent ? 54 * 60 : Math.round((1 - run) * 7200);
  const hh = Math.floor(left / 3600);
  const mm = Math.floor((left % 3600) / 60);
  const ss = left % 60;
  const ringColor = sent ? C.tealBright : run > 0.4 ? "#f59e0b" : TAFA.gold;
  const QS = ["Who picks up at 2am on a Sunday?", "Who decides it is notifiable?", "Who writes the notification, and how fast?"];
  const qOut = prog(frame, 120, 140);
  return (
    <Stage>
      <Headline frame={frame} size={96}>Two hours.</Headline>
      <Sub frame={frame} top={160}>MOH must be told within two hours. A full report follows within 14 days.</Sub>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <circle cx={CX} cy={CY} r={R} stroke="rgba(140,170,255,0.2)" strokeWidth={22} fill="none" />
        <circle cx={CX} cy={CY} r={R} stroke={ringColor} strokeWidth={22} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (sent ? 0.55 : run)} transform={`rotate(-90 ${CX} ${CY})`} style={{ filter: `drop-shadow(0 0 18px ${ringColor})` }} />
      </svg>
      <div style={{ position: "absolute", left: CX - 200, top: CY - 70, width: 400, textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 76, fontWeight: 600, color: sent ? C.tealBright : "#fff" }}>
          {hh}:{String(mm).padStart(2, "0")}:{String(ss).padStart(2, "0")}
        </div>
        <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.16em", color: C.dim, marginTop: 6 }}>{sent ? "SENT WITH TIME TO SPARE" : "TO NOTIFY MOH"}</div>
      </div>

      <div style={{ position: "absolute", left: 820, top: 330, width: 960, display: "flex", flexDirection: "column", gap: 24, opacity: 1 - qOut }}>
        {QS.map((q, i) => {
          const p = prog(frame, 20 + i * 24, 36 + i * 24);
          return (
            <div key={q} style={{ fontSize: 46, fontWeight: 600, opacity: p, transform: `translateX(${(1 - p) * 40}px)` }}>
              {q}
            </div>
          );
        })}
        <div style={{ fontSize: 28, color: "#c8d4f0", opacity: prog(frame, 92, 108) }}>The three questions an auditor will ask. A policy document cannot answer them.</div>
      </div>

      <Sequence from={130} layout="none">
        <ConsoleShot
          src="screens/sg/sg-ir-notify.png"
          imgW={2000}
          imgH={1125}
          width={1000}
          left={800}
          top={280}
          url="HexaView · Incident Response · Notifications"
          keys={[
            { f: 0, z: 1, x: 1000, y: 562 },
            { f: 30, z: 1, x: 1000, y: 562 },
            { f: 70, z: 1.9, x: 820, y: 1000 },
          ]}
          overlay={(px) => <Spotlight px={px} x={362} y={988} w={930} h={72} show={prog(frame, 200, 216)} />}
        />
      </Sequence>
      <Callout x={800} y={880} w={1000} show={prog(frame, 214, 230)} title="MOH notification, sent 54 minutes early" body="Drafted, approved and sent from HexaView, with every step on the audited timeline." />
      <Badge />
    </Stage>
  );
};

/** 6 · Follow the money, precisely. */
export const HcFunding: React.FC = () => {
  const frame = useCurrentFrame();
  const big = prog(frame, 4, 22);
  const correct = prog(frame, 40, 56);
  const move = prog(frame, 84, 110);
  const CARDS = [
    { name: "NEHR Connect Grant", by: "MOH", value: "Up to S$200,000", what: "Clinical systems", note: "Fixed sums for smaller licence types" },
    { name: "CISOaaS co-funding", by: "CSA", value: "Up to 70%", what: "Security consultancy", note: "Towards a cyber and data security plan" },
    { name: "Productivity Solutions Grant", by: "Enterprise Singapore", value: "Up to 50%", what: "Security tooling", note: "Capped at S$30,000 a year" },
  ];
  return (
    <Stage>
      <Headline frame={frame}>Government funding helps.</Headline>
      <div style={{ position: "absolute", left: 0, right: 0, top: 300, display: "flex", flexDirection: "column", alignItems: "center", opacity: 1 - move, transform: `scale(${1 - move * 0.15})` }}>
        <div style={{ fontSize: 200, fontWeight: 700, letterSpacing: "-0.03em", opacity: big, color: correct > 0.5 ? "#7f93bf" : "#fff" }}>S$45M</div>
        <div style={{ fontSize: 36, color: "#c8d4f0", opacity: big }}>NEHR Connect Grant</div>
        <div style={{ marginTop: 22, fontSize: 40, fontWeight: 700, color: "#ffe2a8", opacity: correct * (1 - move), padding: "12px 26px", border: `2px solid ${TAFA.gold}`, borderRadius: 14 }}>Funds clinical systems, not security services.</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 268, textAlign: "center", fontSize: 36, color: "#c8d4f0", opacity: prog(frame, 100, 116) }}>Three separate schemes, three portals. You can use all of them.</div>
      <div style={{ position: "absolute", left: 140, right: 140, top: 350, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 30 }}>
        {CARDS.map((c, i) => {
          const p = prog(frame, 108 + i * 12, 128 + i * 12);
          return (
            <div key={c.name} style={{ borderRadius: 22, padding: "26px 28px", background: "rgba(10,20,50,0.9)", border: `2px solid ${i === 0 ? "rgba(140,170,255,0.35)" : C.tealBright}`, boxShadow: i === 0 ? "none" : "0 0 40px rgba(58,208,174,0.18)", opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
              <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.12em", color: C.dim }}>{c.by.toUpperCase()}</div>
              <div style={{ fontSize: 30, fontWeight: 700, marginTop: 6 }}>{c.name}</div>
              <div style={{ fontSize: 58, fontWeight: 700, color: i === 0 ? "#cfe3ff" : C.tealBright, marginTop: 14 }}>{c.value}</div>
              <div style={{ fontSize: 28, fontWeight: 600, marginTop: 8 }}>{c.what}</div>
              <div style={{ fontSize: 22, color: "#c8d4f0", marginTop: 6 }}>{c.note}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 790, display: "flex", justifyContent: "center", opacity: prog(frame, 170, 188), transform: `scale(${0.94 + prog(frame, 170, 188) * 0.06})` }}>
        <div style={{ padding: "20px 40px", borderRadius: 20, background: "rgba(242,184,75,0.12)", border: `2px solid ${TAFA.gold}`, fontSize: 40, fontWeight: 700, color: "#ffe2a8" }}>
          A single-site clinic: around S$20,000 in total support
        </div>
      </div>
      <div style={{ position: "absolute", left: 120, right: 420, top: 900, fontFamily: MONO, fontSize: 17, color: C.dim, lineHeight: 1.5, opacity: prog(frame, 186, 200) }}>
        MOH’s own worked example. Quanta and eligibility as published by MOH, CSA and Enterprise Singapore, September 2026. CISOaaS co-funding applies to CSA-qualified providers. Conditions apply.
      </div>
      <Badge />
    </Stage>
  );
};
