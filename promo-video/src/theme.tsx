import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { loadFont } from "@remotion/fonts";
import { FPS, SLOW } from "./timeline";

export { FPS, SLOW };
/** The current cut's pace; a cut can run slower than the master. Default 1 (no stretch) outside a promo cut. */
export const SlowContext = React.createContext(1);
/** Scene time in authored frames: every animation stretches evenly with the cut's pace. */
export const useSceneFrame = () => useCurrentFrame() / React.useContext(SlowContext);
export const sec = (s: number) => Math.round(s * FPS);

export const C = {
  night: "#050a18",
  ink: "#0b1220",
  panel: "#0e1730",
  line: "#1f2c4c",
  deep: "#0a1430",
  navy: "#10224a",
  navy2: "#13306a",
  tealDeep: "#0f3a35",
  teal: "#2fbfa0",
  tealBright: "#3ad0ae",
  tealDark: "#1e9e86",
  signal: "#4f8cff",
  signalSoft: "#8db4ff",
  assured: "#2fbfa0",
  glass: "#22d3ee",
  warning: "#eab308",
  threat: "#ef4444",
  text: "#e5e9f2",
  muted: "#aab5cc",
  dim: "#8f9bb6",
  faint: "#6b7690",
};

export const DISPLAY = "'Space Grotesk', sans-serif";
export const MONO = "'JetBrains Mono', monospace";

// Fonts must load from the render phase, never at module scope.
let fontsRequested = false;
export const loadBrandFonts = () => {
  if (fontsRequested) return;
  fontsRequested = true;
  const sg = (w: string) =>
    loadFont({ family: "Space Grotesk", url: staticFile(`fonts/space-grotesk-latin-${w}-normal.woff2`), weight: w });
  const jb = (w: string) =>
    loadFont({ family: "JetBrains Mono", url: staticFile(`fonts/jetbrains-mono-latin-${w}-normal.woff2`), weight: w });
  sg("400");
  sg("500");
  sg("700");
  jb("400");
  jb("600");
  loadFont({ family: "IBM Plex Sans", url: staticFile("fonts/ibm-plex-sans-latin-700-normal.woff2"), weight: "700" });
};

export const EASE = Easing.bezier(0.16, 1, 0.3, 1);
export const EASE_IN = Easing.bezier(0.55, 0, 0.9, 0.4);

/** Clamped, eased interpolation from 0 to 1 between two frames. */
export const prog = (frame: number, start: number, end: number, ease = EASE) =>
  interpolate(frame, [start, end], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });

export const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

// Pointy-top, like the HexaView mark.
export const HEX_CLIP = "polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%)";
export const HEX_RATIO = 1.1547; // height / width

/** A pointy-top hexagon centred on (x, y). */
export const Hex: React.FC<{
  x: number;
  y: number;
  w: number;
  color: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}> = ({ x, y, w, color, style, children }) => {
  const h = w * HEX_RATIO;
  return (
    <div
      style={{
        position: "absolute",
        left: x - w / 2,
        top: y - h / 2,
        width: w,
        height: h,
        clipPath: HEX_CLIP,
        background: color,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/** Clip path for a pointy-top hexagon of radius r centred on (cx, cy), in px. */
export const hexPolygon = (cx: number, cy: number, r: number) => {
  const pts = [30, 90, 150, 210, 270, 330].map((a) => {
    const rad = (a * Math.PI) / 180;
    return `${(cx + r * Math.cos(rad)).toFixed(1)}px ${(cy + r * Math.sin(rad)).toFixed(1)}px`;
  });
  return `polygon(${pts.join(", ")})`;
};

/** Every scene enters through a hexagonal iris: the hexagon is the camera. */
export const HexIris: React.FC<{ children: React.ReactNode; duration?: number; cx?: number; cy?: number }> = ({
  children,
  duration = 16,
  cx = 960,
  cy = 540,
}) => {
  const frame = useSceneFrame();
  const p = prog(frame, 0, duration);
  if (p >= 1) return <AbsoluteFill>{children}</AbsoluteFill>;
  const r = interpolate(p, [0, 1], [40, 1250]);
  return <AbsoluteFill style={{ clipPath: hexPolygon(cx, cy, r) }}>{children}</AbsoluteFill>;
};

/** The console's own backdrop: a navy-to-blue glow under a faint, drifting honeycomb. */
export const Backdrop: React.FC<{ dark?: boolean }> = ({ dark }) => {
  const frame = useCurrentFrame();
  const r = 64;
  const w = Math.sqrt(3) * r;
  const drift = (frame * 0.4) % (3 * r);
  return (
    <AbsoluteFill
      style={{
        background: dark
          ? "radial-gradient(ellipse at 50% 42%, #0d1d45 0%, #050a18 65%)"
          : "radial-gradient(ellipse 70% 60% at 32% 38%, rgba(48,78,190,0.55) 0%, rgba(48,78,190,0) 70%), radial-gradient(ellipse 50% 50% at 88% 85%, rgba(47,191,160,0.22) 0%, rgba(47,191,160,0) 70%), radial-gradient(ellipse 45% 45% at 80% 10%, rgba(124,92,255,0.18) 0%, rgba(124,92,255,0) 70%), linear-gradient(160deg, #10215a 0%, #0b1740 50%, #08122f 100%)",
      }}
    >
      <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
        <defs>
          <pattern id="honeycomb" width={w} height={3 * r} patternUnits="userSpaceOnUse" patternTransform={`translate(0 ${-drift})`}>
            <path
              d={`M ${w / 2} 0 L ${w} ${r / 2} L ${w} ${(3 * r) / 2} L ${w / 2} ${2 * r} L 0 ${(3 * r) / 2} L 0 ${r / 2} Z M ${w / 2} ${2 * r} L ${w / 2} ${3 * r}`}
              fill="none"
              stroke={dark ? "rgba(120,160,255,0.06)" : "rgba(150,185,255,0.11)"}
              strokeWidth={1.5}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#honeycomb)" />
      </svg>
    </AbsoluteFill>
  );
};

export const Stage: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; dark?: boolean }> = ({ children, style, dark }) => (
  <AbsoluteFill style={{ color: C.text, fontFamily: DISPLAY, overflow: "hidden", ...style }}>
    <Backdrop dark={dark} />
    {children}
  </AbsoluteFill>
);

/** Fade + short rise, the house entrance. */
export const rise = (frame: number, start: number, dist = 30, dur = 18): React.CSSProperties => {
  const p = prog(frame, start, start + dur);
  return { opacity: p, transform: `translateY(${(1 - p) * dist}px)` };
};

/** A brand icon from public/brand (HexaView_mark, HexaSOC_icon …), centred on (x, y). */
export const BrandIcon: React.FC<{ name: string; x: number; y: number; size: number; style?: React.CSSProperties }> = ({ name, x, y, size, style }) => (
  <Img
    src={staticFile(`brand/${name}.svg`)}
    style={{ position: "absolute", left: x - size / 2, top: y - size / 2, width: size, height: size, ...style }}
  />
);

/** Co-branded cuts: a distribution partner's logo and call to action. */
export type Partner = { name: string; logo: string; ratio: number; cta: string; endLabel: string };
export const PARTNERS: Record<string, Partner> = {
  cyberdockside: { name: "Cyber Dockside", logo: "partners/cyberdockside-reverse.png", ratio: 650 / 182, cta: "Book a demo · cyberdockside.ai", endLabel: "EXCLUSIVE MARITIME HEXAVIEW PARTNER" },
};
export const PartnerContext = React.createContext<Partner | null>(null);
export const usePartner = () => React.useContext(PartnerContext);

/** The partner's reversed logo, centred horizontally at `top`. */
export const PartnerLogo: React.FC<{ partner: Partner; top: number; height: number; show: number; label: string; emphasis?: boolean }> = ({ partner, top, height, show, label, emphasis }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top, display: "flex", flexDirection: "column", alignItems: "center", gap: 14, opacity: show, transform: `translateY(${(1 - show) * 20}px)` }}>
    <div style={{ fontFamily: MONO, fontSize: emphasis ? 27 : 22, fontWeight: emphasis ? 600 : 400, letterSpacing: "0.2em", color: emphasis ? C.tealBright : C.dim }}>{label}</div>
    <Img src={staticFile(partner.logo)} style={{ height, width: height * partner.ratio }} />
  </div>
);
