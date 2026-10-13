import React from "react";
import { Img, Sequence, staticFile, useCurrentFrame } from "remotion";
import { BrandIcon, C, Hex, MONO, Stage, prog } from "../theme";
import { Callout, ConsoleShot, Eyebrow, Headline, PoweredBadge, Spotlight, Sub, TAFA, TafaCard } from "./common";

const Badge: React.FC = () => {
  const frame = useCurrentFrame();
  return <PoweredBadge show={prog(frame, 10, 24)} top={986} right={36} />;
};

const Bullet: React.FC<{ text: string; color: string; show: number; size?: number }> = ({ text, color, show, size = 25 }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, fontSize: size, lineHeight: 1.3, padding: "6px 0", opacity: show, transform: `translateX(${(1 - show) * 14}px)` }}>
    <div style={{ width: 10, height: 10, borderRadius: "50%", background: color, flexShrink: 0, marginTop: size * 0.42 }} />
    {text}
  </div>
);

/** 7 · Advisory, tools, or a guided route. */
export const HcGuided: React.FC = () => {
  const frame = useCurrentFrame();
  const ROUTES = [
    { title: "The advisory route", sub: "Useful, not sufficient", items: ["A consultant writes a report", "You are left to execute it", "Nobody is watching at 2am"], good: false },
    { title: "The tools route", sub: "Necessary, not a programme", items: ["Software is bought", "Somebody still has to run it", "Alerts with nobody to triage"], good: false },
    { title: "The guided route", sub: "What TAFA delivers", items: ["A named person owns the outcome", "One plan across every licence", "Grants and paperwork handled", "Round-the-clock cover for the two-hour duty", "Evidence maintained, not rebuilt"], good: true },
  ];
  const lift = prog(frame, 70, 96);
  return (
    <Stage>
      <Headline frame={frame}>Where most organisations get stuck.</Headline>
      <Sub frame={frame} top={166}>Plenty of firms will assess you, and plenty will sell you tools. Very few will run what the assessment recommends.</Sub>
      <div style={{ position: "absolute", left: 120, right: 120, top: 300, display: "grid", gridTemplateColumns: "1fr 1fr 1.35fr", gap: 30, alignItems: "start" }}>
        {ROUTES.map((r, i) => {
          const p = prog(frame, 12 + i * 12, 32 + i * 12);
          const dim = r.good ? 1 : 1 - lift * 0.45;
          return (
            <div
              key={r.title}
              style={{
                borderRadius: 24,
                padding: "26px 30px",
                background: r.good ? "rgba(58,208,174,0.1)" : "rgba(10,20,50,0.85)",
                border: `2px solid ${r.good ? C.tealBright : "rgba(140,170,255,0.25)"}`,
                boxShadow: r.good ? `0 0 ${60 * lift}px rgba(58,208,174,0.35)` : "none",
                opacity: p * dim,
                transform: `translateY(${(1 - p) * 30 - (r.good ? lift * 20 : 0)}px) scale(${r.good ? 1 + lift * 0.03 : 1})`,
              }}
            >
              <div style={{ fontSize: 34, fontWeight: 700, color: r.good ? C.tealBright : "#dfe7fb" }}>{r.title}</div>
              <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.1em", color: r.good ? TAFA.gold : C.dim, marginTop: 4, marginBottom: 12 }}>{r.sub.toUpperCase()}</div>
              {r.items.map((it, j) => (
                <Bullet key={it} text={it} color={r.good ? C.tealBright : "#7f93bf"} show={prog(frame, 30 + i * 12 + j * 6, 42 + i * 12 + j * 6)} size={r.good ? 27 : 24} />
              ))}
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 860, textAlign: "center", fontSize: 40, fontWeight: 700, opacity: prog(frame, 120, 140) }}>
        A virtual CISO, on retainer. <span style={{ color: C.tealBright }}>The obligation is continuous.</span>
      </div>
      <Badge />
    </Stage>
  );
};

/** 8 · TAFA fronts, HexaShield powers. */
export const HcPartnership: React.FC = () => {
  const frame = useCurrentFrame();
  const left = prog(frame, 10, 34);
  const right = prog(frame, 24, 48);
  const link = prog(frame, 50, 80);
  const CardBox: React.FC<{ show: number; from: number; children: React.ReactNode; accent: string }> = ({ show, from, children, accent }) => (
    <div style={{ width: 700, minHeight: 520, boxSizing: "border-box", borderRadius: 26, padding: "34px 38px", background: "rgba(10,20,50,0.9)", border: `2px solid ${accent}`, boxShadow: `0 0 60px ${accent}33`, opacity: show, transform: `translateX(${(1 - show) * from}px)` }}>{children}</div>
  );
  const TAFA_POINTS = ["Your contract, your invoice, your first call", "Locally accountable, locally present", "Owns your programme end to end", "One relationship for every licence"];
  const HS_POINTS = ["The HexaView platform", "24/7 security operation, follow-the-sun", "Compliance, testing and medical-device specialists", "Working behind the TAFA service"];
  return (
    <Stage>
      <Headline frame={frame}>Local accountability. Global capability.</Headline>
      <div style={{ position: "absolute", left: 0, right: 0, top: 168, display: "flex", justifyContent: "center", opacity: prog(frame, 60, 76) }}>
        <div style={{ padding: "10px 26px", borderRadius: 999, background: "rgba(242,184,75,0.14)", border: `2px solid ${TAFA.gold}`, fontFamily: MONO, fontSize: 22, letterSpacing: "0.18em", color: "#ffe2a8" }}>EXCLUSIVE HEALTHCARE PARTNER</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 270, display: "flex", justifyContent: "center", gap: 160 }}>
        <CardBox show={left} from={-60} accent={TAFA.sky}>
          <TafaCard height={110} />
          <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.16em", color: TAFA.sky, marginTop: 22 }}>YOUR PARTNER</div>
          <div style={{ marginTop: 10 }}>
            {TAFA_POINTS.map((t, i) => (
              <Bullet key={t} text={t} color={TAFA.sky} show={prog(frame, 40 + i * 8, 52 + i * 8)} size={28} />
            ))}
          </div>
        </CardBox>
        <CardBox show={right} from={60} accent={C.tealBright}>
          <div style={{ height: 110 + 42, display: "flex", alignItems: "center" }}>
            <Img src={staticFile("brand/HexaView_logo_reverse.png")} style={{ width: 460, height: 460 * (348 / 1194) }} />
          </div>
          <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.16em", color: C.tealBright, marginTop: 22 }}>THE ENGINE · HEXASHIELD</div>
          <div style={{ marginTop: 10 }}>
            {HS_POINTS.map((t, i) => (
              <Bullet key={t} text={t} color={C.tealBright} show={prog(frame, 56 + i * 8, 68 + i * 8)} size={28} />
            ))}
          </div>
        </CardBox>
      </div>
      {/* The two halves, joined. */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={890} y1={530} x2={890 + 140 * link} y2={530} stroke={C.tealBright} strokeWidth={5} strokeLinecap="round" />
        {link >= 1 && [0, 1, 2].map((k) => {
          const t = ((frame + k * 14) % 42) / 42;
          return <circle key={k} cx={890 + 140 * t} cy={530} r={7} fill={k % 2 ? TAFA.sky : "#ffffff"} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 850, textAlign: "center", fontFamily: MONO, fontSize: 30, letterSpacing: "0.2em", color: "#d8f3ec", opacity: prog(frame, 100, 120) }}>
        TAFA-BRANDED · HEXASHIELD-POWERED
      </div>
    </Stage>
  );
};

/** 9 · The TAFA-branded HexaView console, then the HIA programme inside it. */
export const HcHexaView: React.FC = () => {
  const frame = useCurrentFrame();
  const SWITCH = 120;
  return (
    <Stage>
      <Headline frame={frame}>Your HIA programme, in one console.</Headline>
      <Sequence durationInFrames={SWITCH + 12} layout="none">
        <div style={{ opacity: 1 - prog(frame, SWITCH, SWITCH + 12) }}>
          <ConsoleShot
            src="screens/sg/tafa-command.png"
            imgW={2000}
            imgH={1125}
            width={1360}
            top={180}
            url="TAFA · Cyber Resilience Overview · Orchid Bay Healthcare"
            keys={[
              { f: 0, z: 1, x: 1000, y: 562 },
              { f: 40, z: 1, x: 1000, y: 562 },
              { f: 90, z: 1.5, x: 560, y: 300 },
            ]}
            overlay={(px) => <Spotlight px={px} x={14} y={14} w={300} h={80} show={prog(frame, 50, 66)} color={TAFA.gold} />}
          />
        </div>
      </Sequence>
      <Callout x={60} y={300} w={420} show={prog(frame, 56, 70) * (1 - prog(frame, SWITCH - 6, SWITCH + 4))} title="Your console, TAFA-branded" body="Powered by HexaShield. Each tenant sees only its own view." accent={TAFA.gold} />
      <Sequence from={SWITCH} layout="none">
        <ConsoleShot
          src="screens/sg/tafa-comply.png"
          imgW={2000}
          imgH={1125}
          width={1360}
          top={180}
          url="TAFA · HexaComply · Health Information Act"
          keys={[
            { f: 0, z: 1, x: 1000, y: 562 },
            { f: 30, z: 1, x: 1000, y: 562 },
            { f: 80, z: 1.28, x: 1160, y: 740 },
          ]}
          overlay={(px) => (
            <>
              <Spotlight px={px} x={352} y={598} w={522} h={276} show={prog(frame, SWITCH + 90, SWITCH + 104)} />
              <Spotlight px={px} x={898} y={598} w={524} h={276} show={prog(frame, SWITCH + 120, SWITCH + 134)} />
              <Spotlight px={px} x={1446} y={598} w={522} h={276} show={prog(frame, SWITCH + 150, SWITCH + 164)} />
            </>
          )}
        />
      </Sequence>
      <div style={{ position: "absolute", left: 0, right: 0, top: 1000, display: "flex", justifyContent: "center", gap: 20 }}>
        {["Every CS/DS Essentials control", "Batch 1 NEHR readiness", "Cyber Essentials mark for HIA"].map((t, i) => {
          const p = prog(frame, SWITCH + 92 + i * 30, SWITCH + 106 + i * 30);
          return (
            <div key={t} style={{ padding: "10px 22px", borderRadius: 999, background: "rgba(58,208,174,0.14)", border: `2px solid ${C.tealBright}`, fontSize: 24, fontWeight: 600, color: "#d8f3ec", opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
              {t}
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

/** 10 · Connected medical devices. */
export const HcDevices: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Stage>
      <Headline frame={frame}>Medical devices you can’t simply patch.</Headline>
      <ConsoleShot
        src="screens/sg/sg-ot.png"
        imgW={2000}
        imgH={1125}
        width={1300}
        left={80}
        top={180}
        url="HexaView · HexaOT · Orchid Bay Healthcare"
        keys={[
          { f: 0, z: 1, x: 1000, y: 562 },
          { f: 34, z: 1, x: 1000, y: 562 },
          { f: 90, z: 1.6, x: 980, y: 760 },
        ]}
        overlay={(px) => (
          <>
            <Spotlight px={px} x={622} y={366} w={262} h={98} show={prog(frame, 40, 54)} color="#EFA468" />
            <Spotlight px={px} x={366} y={948} w={760} h={28} show={prog(frame, 110, 124)} color={C.threat} />
          </>
        )}
      />
      <div style={{ position: "absolute", left: 1420, top: 200, width: 440, display: "flex", flexDirection: "column", gap: 22 }}>
        <BrandIcon name="HexaOT_icon" x={0} y={0} size={110} style={{ position: "relative", left: 0, top: 0, opacity: prog(frame, 8, 22) }} />
        <Callout inline x={0} y={0} w={440} show={prog(frame, 44, 60)} title="Every device, found passively" body="Infusion pumps, monitors, imaging and analysers, without touching patient care." accent="#EFA468" />
        <Callout inline x={0} y={0} w={440} show={prog(frame, 116, 132)} title="Segmented and watched" body="Compensating controls where devices can’t be patched, in line with HSA guidance GL-04." accent={C.tealBright} />
      </div>
      <Badge />
    </Stage>
  );
};

/** 11 · Twelve months, worked backwards from the grant deadline. */
export const HcJourney: React.FC = () => {
  const frame = useCurrentFrame();
  const STEPS = [
    { m: "MONTHS 1–2", t: "Find where you stand", d: "Licence and batch map, gap assessment, grants started" },
    { m: "MONTHS 2–3", t: "Plan and budget", d: "A costed roadmap with your grants mapped to each line" },
    { m: "MONTHS 3–8", t: "Do the work", d: "Controls, vendor contracts, training, incident response rehearsed" },
    { m: "MONTHS 8–10", t: "Certify", d: "Evidence assembled, Cyber Essentials mark for HIA entities" },
    { m: "MONTHS 10–12", t: "Go live and hold it", d: "Contribution on, monitoring in place, evidence maintained" },
  ];
  const X = (i: number) => 230 + i * 365;
  const Y = 470;
  const path = prog(frame, 14, 110);
  return (
    <Stage>
      <Headline frame={frame}>Twelve months, worked backwards.</Headline>
      <Sub frame={frame} top={166}>Sequenced around the funding deadline, because the money runs out first.</Sub>
      <div style={{ position: "absolute", left: X(0), top: Y - 3, width: (X(4) - X(0)) * path, height: 6, borderRadius: 3, background: `linear-gradient(90deg, ${TAFA.sky}, ${C.tealBright})` }} />
      {STEPS.map((s, i) => {
        const p = prog(frame, 14 + i * 20, 32 + i * 20);
        return (
          <React.Fragment key={s.t}>
            <Hex x={X(i)} y={Y} w={130} color={i === 3 ? C.teal : "#12305f"} style={{ opacity: p, transform: `scale(${0.7 + p * 0.3})` }}>
              <div style={{ fontSize: 46, fontWeight: 700, color: i === 3 ? C.night : "#dfe7fb" }}>{i + 1}</div>
            </Hex>
            <div style={{ position: "absolute", left: X(i) - 165, top: Y + 100, width: 330, textAlign: "center", opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>
              <div style={{ fontFamily: MONO, fontSize: 19, letterSpacing: "0.1em", color: TAFA.sky }}>{s.m}</div>
              <div style={{ fontSize: 32, fontWeight: 700, marginTop: 6 }}>{s.t}</div>
              <div style={{ fontSize: 22, color: "#c8d4f0", marginTop: 8, lineHeight: 1.35 }}>{s.d}</div>
            </div>
          </React.Fragment>
        );
      })}
      <div style={{ position: "absolute", left: 0, right: 0, top: 860, display: "flex", justifyContent: "center", gap: 28, opacity: prog(frame, 130, 150) }}>
        <div style={{ padding: "14px 26px", borderRadius: 16, border: `2px solid ${TAFA.gold}`, background: "rgba(242,184,75,0.12)", fontSize: 28, fontWeight: 600, color: "#ffe2a8" }}>Grants close 31 Aug 2027</div>
        <div style={{ padding: "14px 26px", borderRadius: 16, border: `2px solid ${C.tealBright}`, background: "rgba(58,208,174,0.12)", fontSize: 28, fontWeight: 600, color: "#d8f3ec" }}>Batch 1 obligation 1 Sept 2027</div>
      </div>
      <Badge />
    </Stage>
  );
};

/** 12 · A sensible way forward, then the co-branded end card. */
export const HcEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const STEPS = [
    { when: "THIS WEEK", t: "Licence and batch map", d: "Every licence, with its real deadline. Yours to keep." },
    { when: "WITHIN TWO WEEKS", t: "Grant entitlement review", d: "What you can claim, across all three schemes." },
    { when: "WITHIN A MONTH", t: "Cyber Resilience Assessment", d: "Fixed scope, four weeks, a costed plan." },
  ];
  const out = prog(frame, 120, 140);
  const lock = prog(frame, 136, 160);
  return (
    <Stage>
      <div style={{ opacity: 1 - out }}>
        <Headline frame={frame}>A sensible way forward.</Headline>
        <div style={{ position: "absolute", left: 140, right: 140, top: 260, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 30 }}>
          {STEPS.map((s, i) => {
            const p = prog(frame, 12 + i * 14, 32 + i * 14);
            return (
              <div key={s.t} style={{ borderRadius: 24, padding: "30px 32px", background: "rgba(10,20,50,0.9)", border: `2px solid ${i === 2 ? C.tealBright : "rgba(140,170,255,0.3)"}`, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
                <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.14em", color: TAFA.gold }}>{s.when}</div>
                <div style={{ fontSize: 38, fontWeight: 700, marginTop: 10 }}>{s.t}</div>
                <div style={{ fontSize: 26, color: "#c8d4f0", marginTop: 12, lineHeight: 1.35 }}>{s.d}</div>
              </div>
            );
          })}
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 700, textAlign: "center", fontSize: 34, color: "#d8f3ec", opacity: prog(frame, 60, 78) }}>The first two steps are useful whether or not you work with us.</div>
      </div>

      {/* Co-branded lockup, held to the last frame. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 150, display: "flex", alignItems: "center", justifyContent: "center", gap: 46, opacity: lock, transform: `scale(${0.94 + lock * 0.06})` }}>
        <TafaCard height={160} />
        <div style={{ fontSize: 76, fontWeight: 300, color: C.dim }}>×</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <Img src={staticFile("brand/HexaView_logo_reverse.png")} style={{ width: 560, height: 560 * (348 / 1194) }} />
          <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.24em", color: C.dim, paddingLeft: 12 }}>
            POWERED BY <span style={{ color: C.tealBright }}>HEXASHIELD</span>
          </div>
        </div>
      </div>
      <Eyebrow frame={frame} at={150} top={470} color={TAFA.gold}>EXCLUSIVE HEALTHCARE PARTNER · SINGAPORE</Eyebrow>
      <div style={{ position: "absolute", left: 0, right: 0, top: 530, textAlign: "center", fontSize: 64, fontWeight: 600, color: "#d8f3ec", opacity: prog(frame, 156, 176) }}>Ready for the Health Information Act.</div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 660, display: "flex", justifyContent: "center", opacity: prog(frame, 170, 190), transform: `scale(${0.94 + prog(frame, 170, 190) * 0.06})` }}>
        <div style={{ padding: "26px 56px", borderRadius: 999, background: C.teal, color: C.night, fontSize: 40, fontWeight: 700 }}>Book your free discovery call with TAFA</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 800, textAlign: "center", fontFamily: MONO, fontSize: 24, letterSpacing: "0.2em", color: C.dim, opacity: prog(frame, 184, 200) }}>CYBER RESILIENCE. TRUSTED PARTNER.</div>
      <div style={{ position: "absolute", left: 160, right: 160, bottom: 40, textAlign: "center", fontFamily: MONO, fontSize: 16, color: C.faint, lineHeight: 1.5, opacity: prog(frame, 190, 206) }}>
        General information about Singapore’s regulatory framework, not legal advice. Position current at September 2026 and subject to change. Console views are illustrative.
      </div>
    </Stage>
  );
};
