import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { BrandIcon, C, Hex, MONO, Stage, prog } from "../theme";
import { Callout, ConsoleShot, Eyebrow, Headline, Spotlight, Sub } from "../hc/common";

// TeamLogic IT × HexaShield: from MSP to MSSP through the HexaView Partner Console.
// TeamLogic IT's reversed logo is used unaltered, with its tagline (their brand standard).
export const TL = { green: "#00843d", lime: "#8dc63f", leaf: "#2bb673" };
const LOGO_RATIO = 1600 / 456;
const SHOT = { imgW: 2000, imgH: 1125 };

export const TlLogo: React.FC<{ height: number; style?: React.CSSProperties }> = ({ height, style }) => (
  <Img src={staticFile("partners/teamlogicit-white.png")} style={{ height, width: height * LOGO_RATIO, ...style }} />
);

const HexaLockup: React.FC<{ width: number }> = ({ width }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
    <Img src={staticFile("brand/HexaView_logo_reverse.png")} style={{ width, height: width * (348 / 1194) }} />
    <div style={{ fontFamily: MONO, fontSize: width * 0.034, letterSpacing: "0.24em", color: C.dim, paddingLeft: width * 0.02 }}>
      POWERED BY <span style={{ color: C.tealBright }}>HEXASHIELD</span>
    </div>
  </div>
);

/** TeamLogic IT, powered by HexaShield, in the corner of every story scene. */
const Badge: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", right: 40, bottom: 30, display: "flex", alignItems: "center", gap: 16, opacity: prog(frame, 10, 24) }}>
      <TlLogo height={44} />
      <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.25)" }} />
      <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.16em", color: C.dim, lineHeight: 1.4 }}>
        POWERED BY
        <br />
        <span style={{ color: C.tealBright }}>HEXASHIELD</span>
      </div>
    </div>
  );
};

/** Replaces the demo partner's own sentence on Partner Console screens. */
const Mask: React.FC<{ px: (n: number) => number; y: number; text: string }> = ({ px, y, text }) => (
  <div style={{ position: "absolute", left: px(345), top: px(y), width: px(1630), height: px(60), background: "#050a18", display: "flex", alignItems: "center", fontSize: px(25), color: "#dbe3f5", fontFamily: "'Space Grotesk', sans-serif" }}>
    {text}
  </div>
);

const Icon: React.FC<{ d: React.ReactNode; size: number; color?: string }> = ({ d, size, color = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);
const I = {
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c1-3.5 3.5-5.5 6.5-5.5s5.5 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5c2.5.2 4.5 2 5.5 5" /></>,
  shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M9 12l2 2 4-4" /></>,
  doc: <><rect x="5" y="3" width="14" height="18" rx="1" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
  building: <><rect x="4" y="3" width="10" height="18" rx="1" /><path d="M14 9h6v12h-6M7 7h4M7 11h4M7 15h4" /></>,
};

/** 1 · Co-brand opening. */
export const TlIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const tl = prog(frame, 0, 14);
  const hv = prog(frame, 18, 44);
  const up = prog(frame, 60, 82);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: interpolate(up, [0, 1], [380, 180]), display: "flex", alignItems: "center", justifyContent: "center", gap: 56, transform: `scale(${1 - up * 0.2})` }}>
        <div style={{ opacity: 0.4 + tl * 0.6, transform: `scale(${0.92 + tl * 0.08})` }}>
          <TlLogo height={150} />
        </div>
        <div style={{ fontSize: 80, fontWeight: 300, color: C.dim, opacity: prog(frame, 12, 26) }}>×</div>
        <div style={{ opacity: hv, transform: `translateX(${(1 - hv) * 40}px)` }}>
          <HexaLockup width={560} />
        </div>
      </div>
      <Eyebrow frame={frame} at={78} top={500} color={TL.lime}>A CYBER RESILIENCE PARTNERSHIP</Eyebrow>
      <Headline frame={frame} at={86} top={560} size={86}>
        From managed IT to <span style={{ color: TL.lime }}>managed security.</span>
      </Headline>
      <Sub frame={frame} at={104} top={720}>Run your clients’ security from one HexaView Partner Console, under your own brand.</Sub>
    </Stage>
  );
};

/** 2 · The market moved from products to outcomes. */
export const TlShift: React.FC = () => {
  const frame = useCurrentFrame();
  const Q = [
    { who: "Customers ask", q: "How is our data handled?", icon: I.people, color: "#52C5EF" },
    { who: "Insurers ask", q: "Which controls do you operate?", icon: I.shield, color: "#ECC873" },
    { who: "Auditors ask", q: "Show us the evidence.", icon: I.doc, color: "#DF70A8" },
  ];
  return (
    <Stage>
      <Headline frame={frame}>Clients don’t want more tools.</Headline>
      <Sub frame={frame} top={166}>
        They want <b style={{ color: TL.lime }}>resilience they can prove.</b>
      </Sub>
      <div style={{ position: "absolute", left: 160, right: 160, top: 330, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 34 }}>
        {Q.map((q, i) => {
          const p = prog(frame, 24 + i * 16, 44 + i * 16);
          return (
            <div key={q.who} style={{ borderRadius: 26, padding: "34px 34px 40px", background: "rgba(10,20,50,0.9)", border: `2px solid ${q.color}88`, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
              <div style={{ width: 84, height: 84, borderRadius: 22, background: `${q.color}22`, display: "flex", alignItems: "center", justifyContent: "center", color: q.color }}>
                <Icon d={q.icon} size={50} />
              </div>
              <div style={{ fontFamily: MONO, fontSize: 21, letterSpacing: "0.14em", color: q.color, marginTop: 26 }}>{q.who.toUpperCase()}</div>
              <div style={{ fontSize: 44, fontWeight: 700, marginTop: 10, lineHeight: 1.15 }}>“{q.q}”</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, textAlign: "center", fontSize: 38, color: "#ffe2a8", fontWeight: 600, opacity: prog(frame, 100, 118) }}>Those questions arrive with deadlines.</div>
      <Badge />
    </Stage>
  );
};

/** 3 · Build a SOC, or partner for one. */
export const TlProblem: React.FC = () => {
  const frame = useCurrentFrame();
  const BUILD = ["Hire and retain security analysts", "Staff a 24/7 shift rota", "Buy and run the tooling", "Engineer the detections"];
  const PARTNER = ["Follow-the-sun analysts, included", "Proprietary platforms, run for you", "One console for every client", "Your brand, and your margin"];
  const right = prog(frame, 70, 94);
  return (
    <Stage>
      <Headline frame={frame}>A 24/7 SOC is a different business.</Headline>
      <div style={{ position: "absolute", left: 150, right: 150, top: 240, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 46 }}>
        {[
          { title: "Build it yourself", items: BUILD, good: false, show: prog(frame, 10, 30) },
          { title: "Partner for it", items: PARTNER, good: true, show: right },
        ].map((col) => (
          <div key={col.title} style={{ borderRadius: 26, padding: "30px 36px", background: col.good ? "rgba(141,198,63,0.09)" : "rgba(10,20,50,0.88)", border: `2px solid ${col.good ? TL.lime : "rgba(239,68,68,0.45)"}`, boxShadow: col.good ? `0 0 ${50 * right}px rgba(141,198,63,0.25)` : "none", opacity: col.show, transform: `translateY(${(1 - col.show) * 30}px)` }}>
            <div style={{ fontSize: 38, fontWeight: 700, color: col.good ? TL.lime : "#ffb4b4" }}>{col.title}</div>
            {col.items.map((t, i) => {
              const q = prog(frame, (col.good ? 80 : 18) + i * 8, (col.good ? 92 : 30) + i * 8);
              return (
                <div key={t} style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 31, padding: "15px 0", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.08)" : "none", opacity: q }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 22, background: col.good ? TL.lime : "rgba(239,68,68,0.2)", color: col.good ? "#08220f" : "#ff8a8a" }}>{col.good ? "✓" : "✕"}</div>
                  {t}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 830, textAlign: "center", fontSize: 44, fontWeight: 700, opacity: prog(frame, 130, 148) }}>
        Grow the offer, <span style={{ color: TL.lime }}>without growing the SOC.</span>
      </div>
      <Badge />
    </Stage>
  );
};

/** 4 · Your brand in front, HexaShield behind the line. */
export const TlModel: React.FC = () => {
  const frame = useCurrentFrame();
  const NODE_Y = 330;
  const node = (i: number) => prog(frame, 14 + i * 20, 34 + i * 20);
  const line = prog(frame, 80, 110);
  const COLS = [
    { x: 300, title: "Your client", items: ["One point of contact", "One contract", "One console"], color: "#52C5EF" },
    { x: 960, title: "TeamLogic IT", items: ["The brand and the relationship", "The client price and the margin", "The renewal"], color: TL.lime },
    { x: 1620, title: "HexaShield", items: ["Platforms and 24/7 analysts", "Engineering and onboarding", "The roadmap"], color: C.tealBright },
  ];
  return (
    <Stage>
      <Headline frame={frame}>Your brand in front. Our platform behind it.</Headline>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={420} y1={NODE_Y + 60} x2={420 + 360 * node(1)} y2={NODE_Y + 60} stroke="rgba(140,170,255,0.5)" strokeWidth={4} />
        <line x1={1100} y1={NODE_Y + 60} x2={1100 + 380 * node(2)} y2={NODE_Y + 60} stroke="rgba(140,170,255,0.5)" strokeWidth={4} />
        {/* "The line": delivery and escalation run behind it, never across it. */}
        <line x1={1290} y1={240} x2={1290} y2={240 + 620 * line} stroke={TL.lime} strokeWidth={4} strokeDasharray="14 12" />
      </svg>
      {COLS.map((c, i) => {
        const p = node(i);
        return (
          <div key={c.title} style={{ position: "absolute", left: c.x - 250, top: NODE_Y - 20, width: 500, display: "flex", flexDirection: "column", alignItems: "center", opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
            <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {i === 0 && (
                <div style={{ width: 140, height: 140, borderRadius: 34, background: "rgba(82,197,239,0.15)", border: "2px solid #52C5EF", display: "flex", alignItems: "center", justifyContent: "center", color: "#9fdcf5" }}>
                  <Icon d={I.building} size={74} />
                </div>
              )}
              {i === 1 && <TlLogo height={92} />}
              {i === 2 && <Img src={staticFile("brand/HexaView_logo_reverse.png")} style={{ width: 380, height: 380 * (348 / 1194) }} />}
            </div>
            <div style={{ fontSize: 36, fontWeight: 700, color: c.color, marginTop: 14 }}>{c.title}</div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {c.items.map((t, j) => (
                <div key={t} style={{ fontSize: 27, color: "#dbe3f5", textAlign: "center", opacity: prog(frame, 40 + i * 20 + j * 8, 54 + i * 20 + j * 8) }}>{t}</div>
              ))}
            </div>
          </div>
        );
      })}
      <div style={{ position: "absolute", left: 1310, top: 812, fontFamily: MONO, fontSize: 20, letterSpacing: "0.1em", color: TL.lime, opacity: line }}>BEHIND THE LINE</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 890, textAlign: "center", fontSize: 34, color: "#d8f3ec", opacity: prog(frame, 130, 148) }}>
        One accountable partner. Adding a capability never adds a vendor for your client.
      </div>
      <Badge />
    </Stage>
  );
};

const ConsoleScene: React.FC<{
  title: React.ReactNode;
  src: string;
  url: string;
  keys: { f: number; z: number; x: number; y: number }[];
  overlay: (px: (n: number) => number, frame: number) => React.ReactNode;
  side: { at: number; title: string; body: string; accent?: string }[];
  chips?: { at: number; items: string[] };
  width?: number;
}> = ({ title, src, url, keys, overlay, side, chips, width = 1230 }) => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <Headline frame={frame} top={46} size={74}>
        {title}
      </Headline>
      <ConsoleShot src={src} {...SHOT} width={width} left={70} top={170} url={url} keys={keys} overlay={(px) => overlay(px, frame)} />
      <div style={{ position: "absolute", left: 70 + width + 40, top: 200, width: 1920 - (70 + width + 40) - 60, display: "flex", flexDirection: "column", gap: 20 }}>
        {side.map((s) => (
          <Callout key={s.title} inline x={0} y={0} w={1920 - (70 + width + 40) - 60} show={prog(frame, s.at, s.at + 16)} title={s.title} body={s.body} accent={s.accent ?? TL.lime} />
        ))}
      </div>
      {chips && (
        <div style={{ position: "absolute", left: 70, width, top: 905, display: "flex", justifyContent: "center", gap: 14 }}>
          {chips.items.map((t, i) => {
            const p = prog(frame, chips.at + i * 8, chips.at + 14 + i * 8);
            return (
              <div key={t} style={{ padding: "10px 22px", borderRadius: 999, background: "rgba(10,20,50,0.92)", border: `2px solid ${TL.lime}`, fontSize: 24, fontWeight: 600, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
                {t}
              </div>
            );
          })}
        </div>
      )}
      <Badge />
    </Stage>
  );
};

/** 5 · The Partner Console: the whole client book. */
export const TlConsole: React.FC = () => (
  <ConsoleScene
    title="Your whole client book, in one console."
    src="screens/tl/tl-overview.png"
    url="TeamLogic IT · Partner Console · Overview"
    keys={[
      { f: 0, z: 1, x: 1000, y: 562 },
      { f: 40, z: 1, x: 1000, y: 562 },
      { f: 100, z: 1.35, x: 1160, y: 560 },
    ]}
    overlay={(px, frame) => (
      <>
        <Mask px={px} y={262} text="Your side of the partnership: every client, its health across your book, and what needs you today." />
        <Spotlight px={px} x={352} y={336} w={1616} h={132} show={prog(frame, 40, 54)} color={TL.lime} />
        <Spotlight px={px} x={352} y={490} w={958} h={600} show={prog(frame, 100, 114)} color={TL.lime} />
        <Spotlight px={px} x={1332} y={490} w={636} h={420} show={prog(frame, 130, 144)} color={C.tealBright} />
      </>
    )}
    side={[
      { at: 50, title: "Every client, one view", body: "Clients, recurring revenue, margin and a book-wide Resilience Index." },
      { at: 106, title: "What needs you today", body: "At-risk renewals, critical incidents and degraded integrations, soonest first." },
      { at: 134, title: "Book health", body: "Every client coloured by status, at a glance.", accent: C.tealBright },
    ]}
  />
);

/** 6 · Services per client. */
export const TlClients: React.FC = () => (
  <ConsoleScene
    title="Switch services on, per client."
    src="screens/tl/tl-clients.png"
    url="TeamLogic IT · Partner Console · Clients"
    keys={[
      { f: 0, z: 1, x: 1000, y: 562 },
      { f: 36, z: 1, x: 1000, y: 562 },
      { f: 110, z: 1.55, x: 1500, y: 800 },
    ]}
    overlay={(px, frame) => (
      <>
        <Spotlight px={px} x={686} y={552} w={250} h={560} show={prog(frame, 30, 44)} color={TL.lime} />
        <Spotlight px={px} x={1752} y={712} w={198} h={340} show={prog(frame, 116, 130)} color={TL.lime} />
      </>
    )}
    side={[
      { at: 36, title: "Six capabilities, one shield", body: "SOC, intelligence, offensive, OT, compliance and custody, on or off per client." },
      { at: 118, title: "Your delivery model", body: "Fully managed, co-managed or advisory, chosen per client and per module." },
    ]}
    chips={{ at: 120, items: ["Fully managed", "Co-managed", "Advisory"] }}
  />
);

/** 7 · Provisioning. */
export const TlProvisioning: React.FC = () => (
  <ConsoleScene
    title="Provision a new client in minutes."
    src="screens/tl/tl-provisioning.png"
    url="TeamLogic IT · Partner Console · Provisioning"
    keys={[
      { f: 0, z: 1, x: 1000, y: 562 },
      { f: 36, z: 1, x: 1000, y: 562 },
      { f: 110, z: 1.4, x: 1300, y: 640 },
    ]}
    overlay={(px, frame) => (
      <>
        <Spotlight px={px} x={1768} y={468} w={202} h={40} show={prog(frame, 36, 50)} color={TL.lime} />
        <Spotlight px={px} x={1432} y={338} w={266} h={108} show={prog(frame, 66, 80)} color={C.tealBright} />
        <Spotlight px={px} x={360} y={640} w={1600} h={420} show={prog(frame, 116, 130)} color={TL.lime} />
      </>
    )}
    side={[
      { at: 40, title: "An isolated tenant per client", body: "Tier, placement, residency and modules, set in one request." },
      { at: 72, title: "Connect, don’t replace", body: "Telemetry from the tools they already run. No rip and replace.", accent: C.tealBright },
      { at: 120, title: "Every change, tracked", body: "Integrations, data planes and modules, with who approves each step." },
    ]}
  />
);

/** 8 · White label. */
export const TlWhiteLabel: React.FC = () => (
  <ConsoleScene
    title="Your brand, end to end."
    src="screens/tl/tl-branding.png"
    url="TeamLogic IT · White Label · Branding"
    keys={[
      { f: 0, z: 1, x: 1000, y: 562 },
      { f: 30, z: 1, x: 1000, y: 562 },
      { f: 100, z: 1.3, x: 1400, y: 760 },
    ]}
    overlay={(px, frame) => (
      <>
        <Spotlight px={px} x={374} y={890} w={600} h={56} show={prog(frame, 36, 50)} color={TL.lime} />
        <Spotlight px={px} x={1048} y={524} w={898} h={474} show={prog(frame, 104, 118)} color={TL.lime} />
      </>
    )}
    side={[
      { at: 40, title: "Brand it once", body: "Your logo, colors and font, set once and applied everywhere." },
      { at: 108, title: "What your client sees", body: "Your console, your domain, your reports and your sign-in. HexaShield stays behind the line." },
    ]}
  />
);

/** 9 · The client's own console, TeamLogic IT-branded. */
export const TlClientView: React.FC = () => {
  const frame = useCurrentFrame();
  const CAPS = ["HexaSOC_icon", "HexaInt_icon", "HexaStrike_icon", "HexaOT_icon", "HexaComply_icon", "HexaCustody_icon"];
  return (
    <Stage>
      <Headline frame={frame} top={46} size={74}>
        What your clients see.
      </Headline>
      <ConsoleShot
        src="screens/tl/tl-client-command.png"
        {...SHOT}
        width={1320}
        top={170}
        url="security.teamlogicit.example · Cyber Resilience Overview"
        keys={[
          { f: 0, z: 1, x: 1000, y: 562 },
          { f: 40, z: 1.45, x: 420, y: 260 },
          { f: 90, z: 1.45, x: 420, y: 260 },
          { f: 140, z: 1.2, x: 900, y: 420 },
        ]}
        overlay={(px) => (
          <>
            <Spotlight px={px} x={14} y={14} w={290} h={80} show={prog(frame, 34, 48) * (1 - prog(frame, 100, 112))} color={TL.lime} />
            <Spotlight px={px} x={790} y={320} w={190} h={210} show={prog(frame, 140, 154)} color={C.tealBright} />
          </>
        )}
      />
      <div style={{ position: "absolute", left: 0, right: 0, top: 960, display: "flex", justifyContent: "center", alignItems: "center", gap: 22 }}>
        {CAPS.map((c, i) => {
          const p = prog(frame, 120 + i * 6, 134 + i * 6);
          return <BrandIcon key={c} name={c} x={0} y={0} size={70} style={{ position: "relative", left: 0, top: 0, opacity: p, transform: `scale(${0.7 + p * 0.3})` }} />;
        })}
        <div style={{ fontSize: 26, fontWeight: 600, color: "#dbe3f5", marginLeft: 10, opacity: prog(frame, 160, 174) }}>Every capability. One resilience score. Evidence on demand.</div>
      </div>
      <Badge />
    </Stage>
  );
};

/** 10 · Follow-the-sun SOC: 3am meets an analyst. */
export const TlSoc: React.FC = () => {
  const frame = useCurrentFrame();
  const CX = 470;
  const CY = 590;
  const R = 250;
  const HUBS = [
    { name: "United States", from: 0, to: 6, color: "#52C5EF" },
    { name: "Philippines", from: 6, to: 12, color: TL.lime },
    { name: "Israel", from: 12, to: 18, color: "#ECC873" },
    { name: "Moldova", from: 18, to: 24, color: "#A580F8" },
  ];
  const arc = (h0: number, h1: number, r: number) => {
    const a0 = (h0 / 24) * 2 * Math.PI - Math.PI / 2;
    const a1 = (h1 / 24) * 2 * Math.PI - Math.PI / 2;
    return `M ${CX + r * Math.cos(a0)} ${CY + r * Math.sin(a0)} A ${r} ${r} 0 0 1 ${CX + r * Math.cos(a1)} ${CY + r * Math.sin(a1)}`;
  };
  const hour = interpolate(frame, [10, 90], [0.5, 3], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const ha = (hour / 24) * 2 * Math.PI - Math.PI / 2;
  const alert = frame >= 90;
  const handled = frame >= 140;
  const STEPS = [
    { t: "03:00", s: "Alert raised on a client laptop", at: 92, color: C.threat },
    { t: "03:02", s: "Analyst on shift picks it up", at: 112, color: "#ECC873" },
    { t: "03:09", s: "Host isolated, client notified", at: 140, color: TL.lime },
  ];
  return (
    <Stage>
      <Headline frame={frame} top={46} size={74}>
        A threat at 3 a.m. meets an analyst, <span style={{ color: TL.lime }}>not a pager.</span>
      </Headline>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <circle cx={CX} cy={CY} r={R} fill="rgba(10,20,50,0.75)" stroke="rgba(140,170,255,0.25)" strokeWidth={2} />
        {HUBS.map((h, i) => (
          <path key={h.name} d={arc(h.from, h.to, R - 18)} fill="none" stroke={h.color} strokeWidth={24} strokeLinecap="butt" opacity={prog(frame, 6 + i * 6, 20 + i * 6)} />
        ))}
        {Array.from({ length: 24 }, (_, i) => {
          const a = (i / 24) * 2 * Math.PI - Math.PI / 2;
          return <line key={i} x1={CX + (R - 50) * Math.cos(a)} y1={CY + (R - 50) * Math.sin(a)} x2={CX + (R - 62) * Math.cos(a)} y2={CY + (R - 62) * Math.sin(a)} stroke="rgba(255,255,255,0.35)" strokeWidth={2} />;
        })}
        <line x1={CX} y1={CY} x2={CX + (R - 70) * Math.cos(ha)} y2={CY + (R - 70) * Math.sin(ha)} stroke="#ffffff" strokeWidth={6} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={10} fill="#ffffff" />
        {alert && <circle cx={CX + (R - 18) * Math.cos(ha)} cy={CY + (R - 18) * Math.sin(ha)} r={18 + 10 * Math.abs(Math.sin(frame / 5))} fill={handled ? TL.lime : C.threat} opacity={0.85} />}
      </svg>
      <div style={{ position: "absolute", left: CX - 110, top: CY + 40, width: 220, textAlign: "center", fontFamily: MONO, fontSize: 40, fontWeight: 600 }}>
        {String(Math.floor(hour)).padStart(2, "0")}:{String(Math.floor((hour % 1) * 60)).padStart(2, "0")}
      </div>
      <div style={{ position: "absolute", left: 140, top: 900, display: "flex", gap: 26, flexWrap: "wrap", width: 700 }}>
        {HUBS.map((h, i) => (
          <div key={h.name} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 22, color: "#dbe3f5", opacity: prog(frame, 20 + i * 6, 34 + i * 6) }}>
            <div style={{ width: 16, height: 16, borderRadius: 4, background: h.color }} />
            {h.name}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 900, top: 280, width: 900, display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.14em", color: C.tealBright, opacity: prog(frame, 20, 34) }}>FOLLOW-THE-SUN DELIVERY HUBS · 24/7</div>
        {STEPS.map((s) => {
          const p = prog(frame, s.at, s.at + 14);
          return (
            <div key={s.t} style={{ display: "flex", alignItems: "center", gap: 24, padding: "22px 28px", borderRadius: 20, background: "rgba(10,20,50,0.9)", border: `2px solid ${s.color}`, opacity: p, transform: `translateX(${(1 - p) * 40}px)` }}>
              <div style={{ fontFamily: MONO, fontSize: 36, fontWeight: 600, color: s.color }}>{s.t}</div>
              <div style={{ fontSize: 32, fontWeight: 600 }}>{s.s}</div>
            </div>
          );
        })}
        <div style={{ fontSize: 26, color: "#c8d4f0", opacity: prog(frame, 160, 176) }}>Your clients’ defenses never sleep. Neither does your phone have to.</div>
        <div style={{ fontFamily: MONO, fontSize: 17, color: C.faint, opacity: prog(frame, 160, 176) }}>Illustrative scenario. Service levels are set per engagement.</div>
      </div>
      <Badge />
    </Stage>
  );
};

/** 11 · Protected deals and partner margin. */
export const TlDeals: React.FC = () => (
  <ConsoleScene
    title="Protected deals. Your margin."
    src="screens/tl/tl-deals.png"
    url="TeamLogic IT · Partner Sales · Deal Registration"
    keys={[
      { f: 0, z: 1, x: 1000, y: 562 },
      { f: 36, z: 1, x: 1000, y: 562 },
      { f: 110, z: 1.4, x: 1150, y: 760 },
    ]}
    overlay={(px, frame) => (
      <>
        <Mask px={px} y={262} text="Register opportunities to protect them. An approved registration locks the deal to you for 90 days." />
        <Spotlight px={px} x={1806} y={464} w={164} h={40} show={prog(frame, 36, 50)} color={TL.lime} />
        <Spotlight px={px} x={1146} y={560} w={320} h={540} show={prog(frame, 112, 126)} color={TL.lime} />
      </>
    )}
    side={[
      { at: 40, title: "Register and protect", body: "Approved deals are locked to you for 90 days, renewable while live." },
      { at: 116, title: "Wholesale in, your price out", body: "HexaShield sets a wholesale rate; TeamLogic IT sets the client price and keeps the margin." },
    ]}
  />
);

/** 12 · Onboarding in weeks. */
export const TlOnboarding: React.FC = () => {
  const frame = useCurrentFrame();
  const STEPS = [
    { w: "WEEKS 1–2", t: "Apply and align", d: "Confirm the model and sign the partner agreement" },
    { w: "WEEKS 2–4", t: "Brand the console", d: "Your logo, domain and colors, plus enablement" },
    { w: "WEEKS 4–6", t: "Certify and pilot", d: "Certify sellers, register deals, provision a pilot client" },
    { w: "WEEKS 6–8", t: "Go live and grow", d: "First clients live under your brand, then expand" },
  ];
  const X = (i: number) => 330 + i * 420;
  const Y = 470;
  return (
    <Stage>
      <Headline frame={frame}>Signed partner to first client, in weeks.</Headline>
      <div style={{ position: "absolute", left: X(0), top: Y - 3, width: (X(3) - X(0)) * prog(frame, 14, 90), height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${TL.lime}, ${C.tealBright})` }} />
      {STEPS.map((s, i) => {
        const p = prog(frame, 14 + i * 22, 32 + i * 22);
        return (
          <React.Fragment key={s.t}>
            <Hex x={X(i)} y={Y} w={130} color={i === 3 ? TL.green : "#12305f"} style={{ opacity: p, transform: `scale(${0.7 + p * 0.3})` }}>
              <div style={{ fontSize: 46, fontWeight: 700 }}>{i + 1}</div>
            </Hex>
            <div style={{ position: "absolute", left: X(i) - 185, top: Y + 100, width: 370, textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
              <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.1em", color: TL.lime }}>{s.w}</div>
              <div style={{ fontSize: 34, fontWeight: 700, marginTop: 6 }}>{s.t}</div>
              <div style={{ fontSize: 23, color: "#c8d4f0", marginTop: 8, lineHeight: 1.35 }}>{s.d}</div>
            </div>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 880, textAlign: "center", fontFamily: MONO, fontSize: 18, color: C.faint, opacity: prog(frame, 100, 116) }}>Timings are indicative and confirmed with your partner team.</div>
      <Badge />
    </Stage>
  );
};

/** 13 · End card, held to the last frame. */
export const TlEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const lock = prog(frame, 0, 24);
  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 170, display: "flex", alignItems: "center", justifyContent: "center", gap: 56, opacity: lock, transform: `scale(${0.94 + lock * 0.06})` }}>
        <TlLogo height={130} />
        <div style={{ fontSize: 76, fontWeight: 300, color: C.dim }}>×</div>
        <HexaLockup width={520} />
      </div>
      <Eyebrow frame={frame} at={20} top={450} color={TL.lime}>MSP TO MSSP · ONE PARTNER CONSOLE</Eyebrow>
      <div style={{ position: "absolute", left: 0, right: 0, top: 510, textAlign: "center", fontSize: 70, fontWeight: 700, opacity: prog(frame, 28, 48) }}>
        Grow your security practice, <span style={{ color: TL.lime }}>not your SOC.</span>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 660, display: "flex", justifyContent: "center", opacity: prog(frame, 50, 70), transform: `scale(${0.94 + prog(frame, 50, 70) * 0.06})` }}>
        <div style={{ padding: "26px 56px", borderRadius: 999, background: TL.green, color: "#ffffff", fontSize: 40, fontWeight: 700 }}>Book a Partner Console walkthrough</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, textAlign: "center", fontFamily: MONO, fontSize: 24, letterSpacing: "0.2em", color: C.dim, opacity: prog(frame, 66, 84) }}>
        CYBER RESILIENCE. TRUSTED PARTNER. · HEXASHIELD.IO
      </div>
      <div style={{ position: "absolute", left: 160, right: 160, bottom: 40, textAlign: "center", fontFamily: MONO, fontSize: 16, color: C.faint, lineHeight: 1.5, opacity: prog(frame, 80, 96) }}>
        Console views show illustrative demo data. Service levels, scope and commercial terms are set per engagement. TeamLogic IT and the TeamLogic IT logo are registered trademarks of TeamLogic, Inc.
      </div>
    </Stage>
  );
};
