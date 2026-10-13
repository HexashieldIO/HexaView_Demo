import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, MONO, Stage, prog, rand } from "../theme";
import { Callout, ConsoleShot, Headline, Spotlight } from "../hc/common";
import { HoneyWave, StrikeBuild } from "./fx";

// HexaStrike AI penetration testing: a HexaShield production.
// Platform colours: HexaStrike red, HexaView teal, HexaShield blue.
export const RED = "#E5484D";
export const HS_BLUE = "#21B5EA";
const PLEX = "'IBM Plex Sans', sans-serif";
const SHOT = { imgW: 2000, imgH: 1125 };

const StrikeLogo: React.FC<{ width: number; style?: React.CSSProperties }> = ({ width, style }) => (
  <Img src={staticFile("brand/strike/HexaStrike_logo_reverse.png")} style={{ width, height: width * (348 / 1275), ...style }} />
);
const ViewLogo: React.FC<{ width: number; style?: React.CSSProperties }> = ({ width, style }) => (
  <Img src={staticFile("brand/strike/HexaView_logo_reverse.png")} style={{ width, height: width * (348 / 1194), ...style }} />
);
/** The HexaShield wordmark: IBM Plex Sans Bold, "Hexa" in white and "Shield" in HexaShield blue. */
const HexaShieldMark: React.FC<{ size: number }> = ({ size }) => (
  <span style={{ fontFamily: PLEX, fontWeight: 700, fontSize: size, color: "#ffffff", letterSpacing: "-0.01em" }}>
    Hexa<span style={{ color: HS_BLUE }}>Shield</span>
  </span>
);

const Badge: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", right: 40, bottom: 28, display: "flex", alignItems: "center", gap: 18, opacity: prog(frame, 10, 24) }}>
      <StrikeLogo width={190} />
      <div style={{ width: 1, height: 38, background: "rgba(255,255,255,0.25)" }} />
      <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.16em", color: C.dim, lineHeight: 1.4 }}>
        IN
        <br />
        <span style={{ color: C.tealBright }}>HEXAVIEW</span>
      </div>
    </div>
  );
};

/** Drifting particle field for depth. */
const Particles: React.FC<{ color?: string; count?: number; opacity?: number }> = ({ color = "#8db4ff", count = 70, opacity = 0.5 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity }}>
      {Array.from({ length: count }, (_, i) => {
        const x = (rand(i) * 1920 + frame * (0.2 + rand(i + 9) * 0.6)) % 1920;
        const y = (rand(i + 3) * 1080 - frame * (0.1 + rand(i + 5) * 0.3) + 1080) % 1080;
        const s = 1.5 + rand(i + 7) * 2.5;
        return <div key={i} style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: "50%", background: color, opacity: 0.3 + 0.7 * Math.abs(Math.sin(frame / 20 + i)) }} />;
      })}
    </AbsoluteFill>
  );
};

/** Kinetic type: words slide up from a mask, one after another. */
const Kinetic: React.FC<{ words: string[]; at: number; size: number; top: number; accent?: number[]; color?: string }> = ({ words, at, size, top, accent = [], color = RED }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", justifyContent: "center", gap: size * 0.28, flexWrap: "wrap" }}>
      {words.map((w, i) => {
        const p = prog(frame, at + i * 5, at + 16 + i * 5);
        return (
          <div key={i} style={{ overflow: "hidden", height: size * 1.18 }}>
            <div style={{ fontSize: size, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.15, color: accent.includes(i) ? color : "#ffffff", transform: `translateY(${(1 - p) * 110}%)` }}>{w}</div>
          </div>
        );
      })}
    </div>
  );
};

// ── A stylised estate map shared by the exposure, visualise and remediate scenes ──
type Node = { id: string; label: string; x: number; y: number; kind: "edge" | "app" | "data" | "vault" };
const NODES: Node[] = [
  { id: "web", label: "Customer portal", x: 360, y: 560, kind: "edge" },
  { id: "api", label: "Payments API", x: 700, y: 360, kind: "app" },
  { id: "app", label: "App servers", x: 760, y: 760, kind: "app" },
  { id: "dir", label: "Directory", x: 1080, y: 560, kind: "app" },
  { id: "db", label: "Core database", x: 1380, y: 380, kind: "data" },
  { id: "files", label: "File shares", x: 1380, y: 760, kind: "data" },
  { id: "vault", label: "Customer data", x: 1640, y: 570, kind: "vault" },
];
const LINKS: [string, string][] = [["web", "api"], ["web", "app"], ["api", "dir"], ["app", "dir"], ["dir", "db"], ["dir", "files"], ["db", "vault"], ["files", "vault"]];
const ROUTE = ["web", "app", "dir", "db", "vault"];
const node = (id: string) => NODES.find((n) => n.id === id)!;

const EstateMap: React.FC<{ weak: number; route: number; scan?: number; found?: number; fixed?: number; blocked?: number }> = ({ weak, route, scan = -1, found = 0, fixed = 0, blocked = 0 }) => {
  const frame = useCurrentFrame();
  const segs = ROUTE.slice(0, -1).map((id, i) => [node(id), node(ROUTE[i + 1])] as const);
  const totalLen = segs.reduce((n, [a, b]) => n + Math.hypot(b.x - a.x, b.y - a.y), 0);
  const routeColor = fixed > 0.5 ? C.tealBright : RED;
  return (
    <AbsoluteFill>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <radialGradient id="scanGlow">
            <stop offset="0" stopColor="rgba(229,72,77,0.35)" />
            <stop offset="1" stopColor="rgba(229,72,77,0)" />
          </radialGradient>
        </defs>
        {LINKS.map(([a, b], i) => {
          const A = node(a), B = node(b);
          return <line key={i} x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke="rgba(140,170,255,0.28)" strokeWidth={2.5} />;
        })}
        {/* Data quietly flowing along every link. */}
        {LINKS.map(([a, b], i) => {
          const A = node(a), B = node(b);
          const t = ((frame + i * 13) % 60) / 60;
          return <circle key={`p${i}`} cx={A.x + (B.x - A.x) * t} cy={A.y + (B.y - A.y) * t} r={4} fill="#8db4ff" opacity={0.6} />;
        })}
        {/* The exposed route from the weakness to the most valuable data. */}
        {route > 0 && (
          <polyline
            points={ROUTE.map((id) => `${node(id).x},${node(id).y}`).join(" ")}
            fill="none"
            stroke={routeColor}
            strokeWidth={6}
            strokeDasharray={blocked > 0 ? "18 14" : `${totalLen}`}
            strokeDashoffset={blocked > 0 ? -frame * 2 : totalLen * (1 - route)}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={1 - blocked * 0.75}
            style={{ filter: `drop-shadow(0 0 12px ${routeColor})` }}
          />
        )}
        {scan >= 0 && <rect x={scan * 2200 - 300} y={0} width={300} height={1080} fill="url(#scanGlow)" />}
        {scan >= 0 && <line x1={scan * 2200 - 150} y1={0} x2={scan * 2200 - 150} y2={1080} stroke={RED} strokeWidth={3} opacity={0.8} />}
      </svg>
      {NODES.map((n, i) => {
        const appear = prog(frame, 4 + i * 4, 20 + i * 4);
        const isWeak = n.id === "web";
        const isVault = n.kind === "vault";
        const lit = isWeak ? weak * (1 - fixed) : 0;
        const vaultHot = isVault ? route * (1 - fixed) : 0;
        const ok = (isWeak || isVault) && fixed > 0.5;
        const ring = ((frame + i * 9) % 40) / 40;
        const col = ok ? C.tealBright : lit > 0.3 || vaultHot > 0.6 ? RED : n.kind === "vault" ? "#ECC873" : "#5b7fd6";
        const size = isVault ? 150 : 118;
        return (
          <React.Fragment key={n.id}>
            {(lit > 0.3 || vaultHot > 0.6 || ok) && (
              <div style={{ position: "absolute", left: n.x - size * 0.9, top: n.y - size * 0.9, width: size * 1.8, height: size * 1.8, borderRadius: "50%", border: `3px solid ${col}`, opacity: (1 - ring) * 0.7, transform: `scale(${0.6 + ring * 0.6})` }} />
            )}
            <div
              style={{
                position: "absolute",
                left: n.x - size / 2,
                top: n.y - size * 0.577,
                width: size,
                height: size * 1.1547,
                clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)",
                background: `linear-gradient(160deg, ${col}, ${col}88)`,
                opacity: appear,
                transform: `scale(${0.6 + appear * 0.4})`,
                boxShadow: `0 0 40px ${col}`,
              }}
            />
            <div style={{ position: "absolute", left: n.x - 160, top: n.y + size * 0.62, width: 320, textAlign: "center", fontSize: 26, fontWeight: 600, color: "#e6ecff", opacity: appear }}>{n.label}</div>
            {isWeak && lit > 0.3 && found === 0 && (
              <div style={{ position: "absolute", left: n.x - 150, top: n.y - size - 40, width: 300, textAlign: "center", fontFamily: MONO, fontSize: 20, letterSpacing: "0.1em", color: RED, opacity: lit }}>UNPATCHED WEAKNESS</div>
            )}
            {isWeak && found > 0 && fixed < 0.5 && (
              <div style={{ position: "absolute", left: n.x - 170, top: n.y - size - 92, width: 340, textAlign: "center", opacity: found }}>
                <span style={{ fontFamily: MONO, fontSize: 18, padding: "6px 14px", borderRadius: 8, background: "rgba(229,72,77,0.18)", border: `1px solid ${RED}`, color: "#ffb4b6" }}>FOUND · CRITICAL · FIX FIRST</span>
              </div>
            )}
            {ok && (
              <div style={{ position: "absolute", left: n.x - 150, top: n.y - size - 40, width: 300, textAlign: "center", fontFamily: MONO, fontSize: 20, letterSpacing: "0.1em", color: C.tealBright }}>{isWeak ? "PATCHED" : "PROTECTED"}</div>
            )}
          </React.Fragment>
        );
      })}
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────────────────────── 1 · studio card
export const HsStudio: React.FC = () => {
  const frame = useCurrentFrame();
  const p = prog(frame, 4, 26);
  const out = prog(frame, 82, 104);
  const sweep = interpolate(frame, [20, 60], [-400, 2300], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ background: "#03060f", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 18 }}>
      {/* Hexagon wave rolling out from behind the wordmark, in HexaShield blue. */}
      <HoneyWave cx={960} cy={540} start={0} from="#0a2a4a" to="#1f8fc7" speed={24} opacity={1 - out} />
      <HoneyWave cx={960} cy={540} start={30} from="#1f8fc7" to="#0b2f4f" speed={24} opacity={0.8 * (1 - out)} />
      <Particles color={HS_BLUE} count={50} opacity={0.4 * (1 - out)} />
      <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.5em", color: "#8f9bb6", opacity: p * (1 - out), paddingLeft: "0.5em" }}>A</div>
      <div style={{ position: "relative", overflow: "hidden", opacity: p * (1 - out), transform: `scale(${0.96 + p * 0.04})` }}>
        <HexaShieldMark size={104} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: sweep - 960, width: 120, background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)", transform: "skewX(-20deg)" }} />
      </div>
      <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.5em", color: "#8f9bb6", opacity: p * (1 - out), paddingLeft: "0.5em" }}>PRODUCTION</div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 2 · the exposure nobody can see
export const HsExposure: React.FC = () => {
  const frame = useCurrentFrame();
  const weak = prog(frame, 60, 80);
  const route = prog(frame, 120, 230);
  const zoom = interpolate(frame, [0, 360], [1.08, 1], { extrapolateRight: "clamp" });
  return (
    <Stage dark>
      <Particles count={60} opacity={0.35} />
      <div style={{ position: "absolute", inset: 0, transform: `scale(${zoom})` }}>
        <EstateMap weak={weak} route={route} />
      </div>
      <Kinetic words={["Every", "organisation", "has", "a", "blind", "spot."]} at={10} size={70} top={70} accent={[4, 5]} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 950, textAlign: "center", fontFamily: MONO, fontSize: 26, letterSpacing: "0.16em", color: "#ffb4b6", opacity: prog(frame, 230, 250) }}>
        ONE WEAKNESS · ONE PATH · YOUR MOST VALUABLE DATA
      </div>
    </Stage>
  );
};

// ─────────────────────────────────────────────── 3 · glitch rewind, "found it first?"
export const HsRewind: React.FC = () => {
  const frame = useCurrentFrame();
  // The last part of the scene rewinds the exposure: path retracts, weakness fades, timecode runs back.
  const RW = 52;
  const rw = prog(frame, RW, RW + 52);
  const rwOn = frame >= RW - 6;
  const tc = Math.max(0, 14.2 - rw * 14.2);
  const streak = (k: number) => (rand(Math.floor(frame / 2) * 13 + k) - 0.5) * 80;
  const glitch = frame < 18;
  const g = (k: number) => (glitch ? (rand(frame * 7 + k) - 0.5) * 60 : 0);
  return (
    <AbsoluteFill style={{ background: "#03060f", color: "#ffffff", fontFamily: "'Space Grotesk', sans-serif" }}>
      {glitch &&
        Array.from({ length: 10 }, (_, i) => (
          <div key={i} style={{ position: "absolute", left: 0, right: 0, top: rand(frame + i) * 1080, height: 4 + rand(i + frame) * 40, background: i % 2 ? "rgba(229,72,77,0.5)" : "rgba(58,208,174,0.4)", transform: `translateX(${g(i)}px)` }} />
        ))}
      {rwOn && (
        <AbsoluteFill style={{ opacity: prog(frame, RW - 6, RW + 4) }}>
          <div style={{ position: "absolute", inset: 0, transform: `translateX(${streak(1) * 0.3}px) scale(${1 + (1 - rw) * 0.04})`, filter: "saturate(1.2)" }}>
            <EstateMap weak={1 - prog(frame, RW + 30, RW + 50)} route={1 - rw} />
          </div>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{ position: "absolute", left: 0, right: 0, top: rand(Math.floor(frame / 2) + i * 7) * 1080, height: 3 + rand(i + frame) * 18, background: i % 2 ? "rgba(229,72,77,0.35)" : "rgba(58,208,174,0.3)", transform: `translateX(${streak(i)}px)` }} />
          ))}
          <div style={{ position: "absolute", left: 60, top: 50, fontFamily: MONO, fontSize: 40, color: "#ffffff", display: "flex", gap: 18, alignItems: "center", textShadow: "0 0 12px rgba(0,0,0,0.8)" }}>
            <span style={{ color: C.tealBright }}>◀◀</span> REW
          </div>
          <div style={{ position: "absolute", right: 60, top: 50, fontFamily: MONO, fontSize: 40, color: "#ffffff" }}>00:00:{tc.toFixed(1).padStart(4, "0")}</div>
        </AbsoluteFill>
      )}
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, textAlign: "center", fontFamily: MONO, fontSize: 28, letterSpacing: "0.4em", color: C.tealBright, opacity: prog(frame, 14, 26) * (1 - prog(frame, RW - 6, RW)), paddingLeft: "0.4em" }}>
        ◀◀ REWIND
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 450, textAlign: "center", transform: `translateX(${g(99)}px)` }}>
        <span style={{ fontSize: 110, fontWeight: 700, letterSpacing: "-0.02em", textShadow: glitch ? `6px 0 ${RED}, -6px 0 ${C.tealBright}` : "none", opacity: prog(frame, 16, 30) * (1 - prog(frame, RW - 6, RW)) }}>
          What if you found it <span style={{ color: C.tealBright }}>first?</span>
        </span>
      </div>
    </AbsoluteFill>
  );
};

// ─────────────────────────────────────────────── 4 · HexaStrike introduced
export const HsIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const hv = prog(frame, 112, 132);
  return (
    <Stage dark>
      <Particles color={RED} count={80} opacity={0.5} />
      {/* The first film's honeycomb light wave, in HexaStrike red, rippling out from the mark as it fills. */}
      <HoneyWave cx={633} cy={410} start={28} from="#2a0c12" to="#c23a42" speed={30} opacity={0.95} />
      <StrikeBuild width={900} cx={960} cy={410} />
      <Kinetic words={["AI", "penetration", "testing."]} at={88} size={64} top={580} accent={[0]} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 700, display: "flex", alignItems: "center", justifyContent: "center", gap: 22, opacity: hv, transform: `translateY(${(1 - hv) * 20}px)` }}>
        <div style={{ fontFamily: MONO, fontSize: 24, letterSpacing: "0.2em", color: C.dim }}>BUILT INTO</div>
        <ViewLogo width={360} />
      </div>
    </Stage>
  );
};

// ─────────────────────────────────────────────── 5 · it maps the weakness and the path
export const HsVisualise: React.FC = () => {
  const frame = useCurrentFrame();
  const scan = interpolate(frame, [10, 120], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const weak = prog(frame, 40, 56);
  const found = prog(frame, 70, 86);
  const route = prog(frame, 90, 170);
  return (
    <Stage dark>
      <EstateMap weak={weak} route={route} scan={frame < 130 ? scan : -1} found={found} />
      <Headline frame={frame} top={56} size={72}>
        It thinks like an attacker, <span style={{ color: RED }}>so you don’t have to.</span>
      </Headline>
      <div style={{ position: "absolute", left: 60, top: 880, display: "flex", gap: 16 }}>
        {["Weakness found", "Path mapped", "Risk ranked"].map((t, i) => {
          const p = prog(frame, 80 + i * 24, 96 + i * 24);
          return <div key={t} style={{ padding: "12px 24px", borderRadius: 999, border: `2px solid ${RED}`, background: "rgba(229,72,77,0.12)", fontSize: 26, fontWeight: 600, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>✓ {t}</div>;
        })}
      </div>
      <Badge />
    </Stage>
  );
};

// ─────────────────────────────────────────────── 6 · fix it, close the path
export const HsRemediate: React.FC = () => {
  const frame = useCurrentFrame();
  const fixed = prog(frame, 40, 60);
  const blocked = prog(frame, 60, 80);
  const shield = prog(frame, 70, 100);
  return (
    <Stage dark>
      <HoneyWave cx={1640} cy={570} start={56} from="#3a1418" to="#0f3a35" speed={34} opacity={0.9} />
      <EstateMap weak={1} route={1} found={1} fixed={fixed} blocked={blocked} />
      <div style={{ position: "absolute", left: 1640 - 120, top: 570 - 140, width: 240, height: 277, clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)", border: "none", background: "rgba(58,208,174,0.18)", opacity: shield, transform: `scale(${0.6 + shield * 0.6})` }} />
      <Kinetic words={["Stop", "the", "attack", "before", "it", "happens."]} at={70} size={84} top={60} accent={[0]} color={C.tealBright} />
      <div style={{ position: "absolute", left: 60, top: 880, display: "flex", gap: 16 }}>
        {["Weakness patched", "Path closed", "Data protected"].map((t, i) => {
          const p = prog(frame, 50 + i * 20, 66 + i * 20);
          return <div key={t} style={{ padding: "12px 24px", borderRadius: 999, border: `2px solid ${C.tealBright}`, background: "rgba(58,208,174,0.12)", fontSize: 26, fontWeight: 600, opacity: p, transform: `translateY(${(1 - p) * 16}px)` }}>✓ {t}</div>;
        })}
      </div>
      <Badge />
    </Stage>
  );
};

// ─────────────────────────────────────────────── product walkthrough in HexaView
const Step: React.FC<{ n: number; label: string }> = ({ n, label }) => {
  const frame = useCurrentFrame();
  const STEPS = ["Scope", "Price", "Authorise", "Run live", "Report"];
  return (
    <div style={{ position: "absolute", left: 0, right: 0, top: 36, display: "flex", justifyContent: "center", gap: 10, opacity: prog(frame, 0, 14) }}>
      {STEPS.map((s, i) => (
        <div key={s} style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ padding: "8px 18px", borderRadius: 999, fontFamily: MONO, fontSize: 18, letterSpacing: "0.08em", background: i + 1 === n ? RED : "rgba(255,255,255,0.06)", color: i + 1 === n ? "#fff" : i + 1 < n ? C.tealBright : C.dim, border: `1px solid ${i + 1 === n ? RED : "rgba(255,255,255,0.15)"}` }}>
            {i + 1 < n ? "✓ " : `${i + 1} `}
            {s.toUpperCase()}
          </div>
          {i < STEPS.length - 1 && <div style={{ width: 22, height: 2, background: "rgba(255,255,255,0.2)" }} />}
        </div>
      ))}
      <div style={{ display: "none" }}>{label}</div>
    </div>
  );
};

const Walk: React.FC<{
  n: number;
  title: React.ReactNode;
  src: string;
  url: string;
  keys: { f: number; z: number; x: number; y: number }[];
  overlay: (px: (n: number) => number, frame: number) => React.ReactNode;
  side: { at: number; title: string; body: string; accent?: string }[];
}> = ({ n, title, src, url, keys, overlay, side }) => {
  const frame = useCurrentFrame();
  const W = 1230;
  return (
    <Stage>
      <Step n={n} label={String(title)} />
      <Headline frame={frame} top={100} size={64}>
        {title}
      </Headline>
      <ConsoleShot src={src} {...SHOT} width={W} left={70} top={210} url={url} keys={keys} overlay={(px) => overlay(px, frame)} />
      <div style={{ position: "absolute", left: 70 + W + 40, top: 240, width: 1920 - (70 + W + 40) - 60, display: "flex", flexDirection: "column", gap: 20 }}>
        {side.map((s) => (
          <Callout key={s.title} inline x={0} y={0} w={1920 - (70 + W + 40) - 60} show={prog(frame, s.at, s.at + 16)} title={s.title} body={s.body} accent={s.accent ?? RED} />
        ))}
      </div>
      <Badge />
    </Stage>
  );
};

export const HsScope: React.FC = () => (
  <Walk
    n={1}
    title="Scope it in minutes."
    src="screens/strike/aipt-scoping.png"
    url="HexaView · HexaStrike · AI Penetration Testing · Scoping"
    keys={[
      { f: 0, z: 1, x: 1000, y: 562 },
      { f: 30, z: 1, x: 1000, y: 562 },
      { f: 100, z: 1.4, x: 900, y: 860 },
    ]}
    overlay={(px, frame) => (
      <>
        <Spotlight px={px} x={374} y={584} w={1018} h={200} show={prog(frame, 30, 44)} color={RED} />
        <Spotlight px={px} x={890} y={900} w={244} h={182} show={prog(frame, 100, 114)} color={RED} />
        <Spotlight px={px} x={1438} y={520} w={530} h={140} show={prog(frame, 130, 144)} color={C.tealBright} />
      </>
    )}
    side={[
      { at: 36, title: "Pre-filled from your estate", body: "Domains, tenants, cloud accounts and headcount drive the effort." },
      { at: 104, title: "Pick what to test", body: "Web, API, infrastructure, cloud, mobile, AI and LLM apps." },
      { at: 134, title: "Effort and price, live", body: "Every choice updates the estimate as you go.", accent: C.tealBright },
    ]}
  />
);

export const HsPrice: React.FC = () => (
  <Walk
    n={2}
    title="Know the price before you commit."
    src="screens/strike/aipt-pricing.png"
    url="HexaView · HexaStrike · Pricing & Purchase"
    keys={[
      { f: 0, z: 1, x: 1000, y: 562 },
      { f: 24, z: 1, x: 1000, y: 562 },
      { f: 90, z: 1.5, x: 1700, y: 880 },
    ]}
    overlay={(px, frame) => (
      <>
        <Spotlight px={px} x={1438} y={590} w={530} h={70} show={prog(frame, 40, 54)} color={RED} />
        <Spotlight px={px} x={1460} y={1058} w={486} h={46} show={prog(frame, 96, 110)} color={C.tealBright} />
      </>
    )}
    side={[
      { at: 44, title: "Your quote, line by line", body: "Effort computed from the scoping counts, so the price matches the scope." },
      { at: 100, title: "Pay and book", body: "From a retainer, or pay as you go, right in the console.", accent: C.tealBright },
    ]}
  />
);

export const HsAuthorise: React.FC = () => (
  <Walk
    n={3}
    title="Authorise it, signed and sealed."
    src="screens/strike/aipt-authorisation.png"
    url="HexaView · HexaStrike · Authorisation"
    keys={[
      { f: 0, z: 1, x: 1000, y: 562 },
      { f: 24, z: 1, x: 1000, y: 562 },
      { f: 90, z: 1.35, x: 1100, y: 800 },
    ]}
    overlay={(px, frame) => (
      <>
        <Spotlight px={px} x={374} y={500} w={516} h={30} show={prog(frame, 30, 44)} color={RED} />
        <Spotlight px={px} x={950} y={672} w={980} h={300} show={prog(frame, 96, 110)} color={RED} />
      </>
    )}
    side={[
      { at: 36, title: "Letter of Authorisation", body: "And Rules of Engagement, generated from your scope." },
      { at: 100, title: "Signed in HexaView", body: "Nothing is tested until ownership and authorisation are verified." },
    ]}
  />
);

export const HsLive: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Walk
      n={4}
      title="Watch it run, live."
      src={frame < 150 ? "screens/strike/aipt-live.png" : "screens/strike/aipt-live-2.png"}
      url="HexaView · HexaStrike · Live Testing"
      keys={[
        { f: 0, z: 1, x: 1000, y: 562 },
        { f: 24, z: 1, x: 1000, y: 562 },
        { f: 80, z: 1.35, x: 1100, y: 560 },
        { f: 150, z: 1.35, x: 1500, y: 860 },
      ]}
      overlay={(px, f) => (
        <>
          <Spotlight px={px} x={372} y={496} w={1574} h={62} show={prog(f, 30, 44) * (1 - prog(f, 140, 150))} color={RED} />
          <Spotlight px={px} x={350} y={598} w={1618} h={104} show={prog(f, 80, 94) * (1 - prog(f, 140, 150))} color={C.tealBright} />
          <Spotlight px={px} x={1438} y={790} w={530} h={210} show={prog(f, 160, 174)} color={RED} />
        </>
      )}
      side={[
        { at: 36, title: "Every phase, in real time", body: "Recon, discovery, vulnerability analysis, validation and reporting." },
        { at: 86, title: "Findings as they appear", body: "Ranked by severity, explained in plain language.", accent: C.tealBright },
        { at: 166, title: "The attack path, validated", body: "How findings chain together, so you fix what matters first." },
      ]}
    />
  );
};

export const HsReport: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <Walk
      n={5}
      title="Your report builds itself."
      src={frame < 120 ? "screens/strike/aipt-reports.png" : "screens/strike/aipt-reports-2.png"}
      url="HexaView · HexaStrike · Reports"
      keys={[
        { f: 0, z: 1, x: 1000, y: 562 },
        { f: 24, z: 1, x: 1000, y: 562 },
        { f: 110, z: 1, x: 1000, y: 562 },
        { f: 170, z: 1.3, x: 1150, y: 700 },
      ]}
      overlay={(px, f) => (
        <>
          <Spotlight px={px} x={374} y={596} w={1572} h={474} show={prog(f, 30, 44) * (1 - prog(f, 110, 120))} color={RED} />
          <Spotlight px={px} x={374} y={264} w={1572} h={54} show={prog(f, 130, 144)} color={C.tealBright} />
          <Spotlight px={px} x={396} y={456} w={1530} h={560} show={prog(f, 170, 184)} color={RED} />
        </>
      )}
      side={[
        { at: 36, title: "Pick the sections", body: "Executive summary, findings, attack path and retest status." },
        { at: 134, title: "Signed off and sealed", body: "Anchored to the audit ledger, ready to share.", accent: C.tealBright },
        { at: 174, title: "Then retest", body: "Every finding tracked to fixed, and turned into a detection." },
      ]}
    />
  );
};

// ─────────────────────────────────────────────── end card
export const HsEndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = prog(frame, 0, 24);
  return (
    <Stage dark>
      <Particles color={RED} count={60} opacity={0.35} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 200, display: "flex", justifyContent: "center", opacity: logo, transform: `scale(${0.92 + logo * 0.08})` }}>
        <StrikeLogo width={760} />
      </div>
      <Kinetic words={["Stop", "the", "attack", "before", "it", "happens."]} at={18} size={80} top={450} accent={[0, 1, 2]} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, display: "flex", justifyContent: "center", opacity: prog(frame, 50, 70) }}>
        <div style={{ padding: "24px 54px", borderRadius: 999, background: RED, color: "#fff", fontSize: 38, fontWeight: 700 }}>Scope your first test in HexaView</div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 790, display: "flex", justifyContent: "center", alignItems: "center", gap: 26, opacity: prog(frame, 70, 90) }}>
        <ViewLogo width={300} />
        <div style={{ width: 1, height: 50, background: "rgba(255,255,255,0.25)" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ fontFamily: MONO, fontSize: 18, letterSpacing: "0.2em", color: C.dim }}>A PLATFORM BY</div>
          <HexaShieldMark size={40} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 920, textAlign: "center", fontFamily: MONO, fontSize: 22, letterSpacing: "0.2em", color: C.dim, opacity: prog(frame, 84, 100) }}>CYBER RESILIENCE. TRUSTED PARTNER. · <span style={{ color: HS_BLUE }}>HEXASHIELD.IO</span></div>
      <div style={{ position: "absolute", left: 160, right: 160, bottom: 30, textAlign: "center", fontFamily: MONO, fontSize: 15, color: C.faint, opacity: prog(frame, 90, 106) }}>Console views show illustrative demo data. All testing is authorised and scoped by the client.</div>
    </Stage>
  );
};

// ─────────────────────────────────────────────── guard-railed by design
export const HsGuardrails: React.FC = () => {
  const frame = useCurrentFrame();
  const ITEMS = [
    { t: "Exclusions", d: "Out-of-scope systems are never touched", icon: "M4 4l16 16M20 4L4 20" },
    { t: "Rate limits", d: "Testing paced to keep services running", icon: "M4 18h16M6 14l4-4 3 3 5-6" },
    { t: "Stop button", d: "Pause or stop any test, instantly", icon: "M6 6h12v12H6z" },
    { t: "Analyst review", d: "Every finding checked by a person", icon: "M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" },
  ];
  const ring = prog(frame, 6, 40);
  return (
    <Stage dark>
      <Particles color={RED} count={40} opacity={0.3} />
      <Kinetic words={["Guard-railed", "by", "design."]} at={4} size={84} top={70} accent={[0]} />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <circle cx={960} cy={600} r={300} fill="none" stroke="rgba(229,72,77,0.25)" strokeWidth={3} />
        <circle cx={960} cy={600} r={300} fill="none" stroke={RED} strokeWidth={6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - ring} transform="rotate(-90 960 600)" style={{ filter: `drop-shadow(0 0 14px ${RED})` }} />
      </svg>
      <div style={{ position: "absolute", left: 960 - 90, top: 600 - 104, opacity: prog(frame, 20, 40) }}>
        <Img src={staticFile("brand/strike/HexaStrike_icon.svg")} style={{ width: 180, height: 180 }} />
      </div>
      {ITEMS.map((it, i) => {
        const a = (-45 + i * 90) * (Math.PI / 180);
        const x = 960 + Math.cos(a) * 520;
        const y = 600 + Math.sin(a) * 300;
        const p = prog(frame, 40 + i * 18, 58 + i * 18);
        const right = Math.cos(a) > 0;
        return (
          <div key={it.t} style={{ position: "absolute", left: right ? x - 60 : undefined, right: right ? undefined : 1920 - x - 60, top: y - 70, width: 440, display: "flex", flexDirection: right ? "row" : "row-reverse", alignItems: "center", gap: 20, opacity: p, transform: `translateX(${(1 - p) * (right ? 40 : -40)}px)` }}>
            <div style={{ width: 96, height: 96, flexShrink: 0, borderRadius: 26, background: "rgba(229,72,77,0.16)", border: `2px solid ${RED}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width={48} height={48} viewBox="0 0 24 24" fill="none" stroke="#ffb4b6" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d={it.icon} /></svg>
            </div>
            <div style={{ textAlign: right ? "left" : "right" }}>
              <div style={{ fontSize: 36, fontWeight: 700 }}>{it.t}</div>
              <div style={{ fontSize: 23, color: "#c8d4f0", marginTop: 4 }}>{it.d}</div>
            </div>
          </div>
        );
      })}
      <Badge />
    </Stage>
  );
};

// ─────────────────────────────────────────────── fix, retest, prove it's closed
export const HsRetest: React.FC = () => {
  const frame = useCurrentFrame();
  const STAGES = [
    { t: "Found", c: RED },
    { t: "Fixed", c: "#ECC873" },
    { t: "Retested", c: C.tealBright },
    { t: "Closed", c: C.tealBright },
  ];
  return (
    <Stage>
      <Headline frame={frame} top={56} size={70}>
        Fix it. Retest it. <span style={{ color: C.tealBright }}>Prove it’s closed.</span>
      </Headline>
      <ConsoleShot
        src="screens/strike/aipt-retests.png"
        {...SHOT}
        width={1180}
        left={70}
        top={200}
        url="HexaView · HexaStrike · Retests"
        keys={[
          { f: 0, z: 1, x: 1000, y: 562 },
          { f: 30, z: 1, x: 1000, y: 562 },
          { f: 110, z: 1.35, x: 1100, y: 700 },
        ]}
        overlay={(px) => <Spotlight px={px} x={352} y={420} w={1616} h={640} show={prog(frame, 40, 56)} color={C.tealBright} />}
      />
      <div style={{ position: "absolute", left: 1300, top: 250, width: 560, display: "flex", flexDirection: "column", gap: 22 }}>
        {STAGES.map((s, i) => {
          const p = prog(frame, 50 + i * 22, 66 + i * 22);
          return (
            <div key={s.t} style={{ display: "flex", alignItems: "center", gap: 22, opacity: p, transform: `translateX(${(1 - p) * 40}px)` }}>
              <div style={{ width: 70, height: 80, clipPath: "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)", background: s.c, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, color: "#06121d" }}>{i + 1}</div>
              <div style={{ fontSize: 44, fontWeight: 700, color: s.c }}>{s.t}</div>
            </div>
          );
        })}
        <div style={{ fontSize: 27, color: "#c8d4f0", marginTop: 8, opacity: prog(frame, 150, 166) }}>Every finding becomes a detection, so the same gap never reopens.</div>
      </div>
      <Badge />
    </Stage>
  );
};

// ─────────────────────────────────────────────── no way in
export const HsNoWayIn: React.FC = () => {
  const frame = useCurrentFrame();
  const probes = Array.from({ length: 14 }, (_, i) => ({ y: 180 + rand(i + 2) * 760, start: 6 + i * 9, speed: 26 + rand(i) * 14 }));
  const EDGE = 240;
  return (
    <Stage dark>
      <HoneyWave cx={1200} cy={560} start={0} from="#0b1d3a" to="#0f3a35" speed={60} opacity={0.6} />
      <EstateMap weak={1} route={1} found={1} fixed={1} blocked={1} />
      {/* A shield wall in front of every patched system. */}
      <div style={{ position: "absolute", left: EDGE - 6, top: 120, width: 12, height: 840, borderRadius: 6, background: `linear-gradient(180deg, transparent, ${C.tealBright}, transparent)`, boxShadow: `0 0 40px ${C.tealBright}`, opacity: prog(frame, 0, 16) }} />
      {probes.map((p, i) => {
        const t = frame - p.start;
        if (t < 0) return null;
        const hitAt = (EDGE - 20) / p.speed;
        const x = t < hitAt ? t * p.speed : EDGE - 20 - (t - hitAt) * p.speed * 0.6;
        const fade = t < hitAt ? 1 : Math.max(0, 1 - (t - hitAt) / 14);
        const flash = t >= hitAt && t < hitAt + 6;
        return (
          <React.Fragment key={i}>
            <div style={{ position: "absolute", left: x - 10, top: p.y - 10, width: 20, height: 20, borderRadius: "50%", background: RED, boxShadow: `0 0 18px ${RED}`, opacity: fade }} />
            {flash && <div style={{ position: "absolute", left: EDGE - 50, top: p.y - 50, width: 100, height: 100, borderRadius: "50%", border: `3px solid ${C.tealBright}`, opacity: 0.8 }} />}
          </React.Fragment>
        );
      })}
      <Kinetic words={["No", "way", "in."]} at={50} size={130} top={60} accent={[0, 1, 2]} color={C.tealBright} />
      <div style={{ position: "absolute", left: 0, right: 0, top: 940, textAlign: "center", fontFamily: MONO, fontSize: 26, letterSpacing: "0.16em", color: C.tealBright, opacity: prog(frame, 80, 96) }}>
        TESTED · FIXED · PROVEN
      </div>
    </Stage>
  );
};
