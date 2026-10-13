import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, MONO, prog, useSceneFrame } from "../theme";
import HC from "./hc.json";

// TAFA × HexaShield, Singapore healthcare: shared timeline and building blocks.
export const FPS = HC.fps;

type Line = (typeof HC.lines)[number] & { dur: number; durUs?: number };

/** The two reads: deeper British (Sonia) and American (Ava). */
export const HC_VOICES = { gb: { key: "dur", dir: "audio/hc-vo" }, us: { key: "durUs", dir: "audio/hc-vo-us" } } as const;
export type HcVoice = keyof typeof HC_VOICES;

/** Scene lengths: each scene grows only if its voiceover line needs more room. */
export const hcTimeline = (voice: HcVoice = "gb") => {
  const v = HC_VOICES[voice];
  const lines = (HC.lines as Line[]).map((l) => ({ ...l, dur: (l as Record<string, unknown>)[v.key] as number }));
  const frames = HC.shots.map((s) => {
    const need = Math.max(0, ...lines.filter((l) => l.scene === s.id).map((l) => l.offset + l.dur + HC.tail));
    return Math.round(Math.max(s.s, need) * FPS);
  });
  const start = frames.map((_, i) => frames.slice(0, i).reduce((a, b) => a + b, 0));
  const startOf = (id: string) => start[HC.shots.findIndex((s) => s.id === id)] / FPS;
  return {
    frames,
    start,
    total: frames.reduce((a, b) => a + b, 0),
    lines: lines.map((l) => ({ ...l, at: startOf(l.scene) + l.offset, src: `${v.dir}/${l.id}.mp3` })),
  };
};

/** TAFA's palette, sampled from its logo. */
export const TAFA = { navy: "#23508a", blue: "#2d5da7", sky: "#5fb9e5", gold: "#f2b84b" };

/** The TAFA logo on a white card: its artwork is navy on white, so it needs a light ground. */
export const TafaCard: React.FC<{ height: number; style?: React.CSSProperties }> = ({ height, style }) => (
  <div
    style={{
      background: "#ffffff",
      borderRadius: height * 0.18,
      padding: `${height * 0.16}px ${height * 0.22}px`,
      boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 0 0 2px rgba(255,255,255,0.6)",
      display: "inline-flex",
      ...style,
    }}
  >
    <Img src={staticFile("partners/tafa-logo.png")} style={{ height, width: height * (316 / 372) }} />
  </div>
);

export const Headline: React.FC<{ frame: number; at?: number; top?: number; size?: number; children: React.ReactNode }> = ({ frame, at = 2, top = 56, size = 80, children }) => {
  const p = prog(frame, at, at + 18);
  return (
    <div style={{ position: "absolute", left: 80, right: 80, top, textAlign: "center", fontSize: size, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.08, opacity: p, transform: `translateY(${(1 - p) * 30}px)` }}>
      {children}
    </div>
  );
};

export const Sub: React.FC<{ frame: number; at?: number; top: number; children: React.ReactNode }> = ({ frame, at = 14, top, children }) => {
  const p = prog(frame, at, at + 18);
  return <div style={{ position: "absolute", left: 120, right: 120, top, textAlign: "center", fontSize: 36, color: "#c8d4f0", opacity: p, transform: `translateY(${(1 - p) * 20}px)` }}>{children}</div>;
};

export const Eyebrow: React.FC<{ frame: number; at?: number; top: number; children: React.ReactNode; color?: string }> = ({ frame, at = 0, top, children, color = C.tealBright }) => (
  <div style={{ position: "absolute", left: 0, right: 0, top, textAlign: "center", fontFamily: MONO, fontSize: 24, letterSpacing: "0.22em", color, opacity: prog(frame, at, at + 14) }}>{children}</div>
);

/** A floating callout card. */
export const Callout: React.FC<{ x: number; y: number; w?: number; show: number; title: string; body?: string; accent?: string; align?: "left" | "right"; inline?: boolean }> = ({ x, y, w = 440, show, title, body, accent = C.tealBright, align = "left", inline }) => (
  <div
    style={{
      position: inline ? "relative" : "absolute",
      left: inline ? undefined : align === "left" ? x : undefined,
      right: inline ? undefined : align === "right" ? 1920 - x : undefined,
      top: inline ? undefined : y,
      boxSizing: "border-box",
      width: w,
      padding: "20px 24px",
      borderRadius: 18,
      background: "rgba(8,16,40,0.92)",
      border: `2px solid ${accent}`,
      boxShadow: `0 20px 60px rgba(0,0,0,0.45), 0 0 40px ${accent}40`,
      opacity: show,
      transform: `translateY(${(1 - show) * 24}px)`,
      textAlign: align,
    }}
  >
    <div style={{ fontSize: 30, fontWeight: 700 }}>{title}</div>
    {body && <div style={{ fontSize: 23, color: "#c8d4f0", marginTop: 8, lineHeight: 1.35 }}>{body}</div>}
  </div>
);

/** "TAFA · Powered by HexaShield", small, for scene corners. */
export const PoweredBadge: React.FC<{ show: number; top?: number; right?: number }> = ({ show, top = 34, right = 40 }) => (
  <div style={{ position: "absolute", top, right, display: "flex", alignItems: "center", gap: 14, opacity: show }}>
    <TafaCard height={46} style={{ padding: "6px 10px", borderRadius: 10 }} />
    <div style={{ fontFamily: MONO, fontSize: 15, letterSpacing: "0.16em", color: C.dim, lineHeight: 1.4 }}>
      POWERED BY
      <br />
      <span style={{ color: C.tealBright }}>HEXASHIELD</span>
    </div>
  </div>
);

/**
 * A real HexaView screen in a browser frame, with a camera that moves between focus points.
 * Keyframes: frame → zoom and the image point (in source pixels) to centre on.
 */
export const ConsoleShot: React.FC<{
  src: string;
  imgW: number;
  imgH: number;
  width: number;
  top: number;
  left?: number;
  url: string;
  keys: { f: number; z: number; x: number; y: number }[];
  overlay?: (px: (n: number) => number) => React.ReactNode;
}> = ({ src, imgW, imgH, width, top, left, url, keys, overlay }) => {
  const frame = useSceneFrame();
  const k = width / imgW;
  const H = imgH * k;
  const BAR = 40;
  const enter = prog(frame, 0, 26);
  const fs = keys.map((q) => q.f);
  const ip = (vals: number[]) => interpolate(frame, fs, vals, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const z = ip(keys.map((q) => q.z));
  const fx = ip(keys.map((q) => q.x));
  const fy = ip(keys.map((q) => q.y));
  // Keep the focus point centred, but never pan past the edges of the screenshot.
  const tx = Math.min(0, Math.max(width - width * z, width / 2 - fx * k * z));
  const ty = Math.min(0, Math.max(H - H * z, H / 2 - fy * k * z));
  const px = (n: number) => n * k;
  return (
    <div style={{ position: "absolute", inset: 0, perspective: 2400 }}>
      <div
        style={{
          position: "absolute",
          left: left ?? (1920 - width) / 2,
          top,
          width,
          height: H + BAR,
          borderRadius: 22,
          overflow: "hidden",
          background: "#070d1d",
          border: "2px solid rgba(140,170,255,0.35)",
          boxShadow: "0 80px 180px rgba(0,0,0,0.55), 0 0 120px rgba(58,208,174,0.18)",
          transformOrigin: "50% 100%",
          transform: `translateY(${(1 - enter) * 140}px) rotateX(${(1 - enter) * 20}deg) scale(${0.92 + enter * 0.08})`,
          opacity: enter,
        }}
      >
        <div style={{ height: BAR, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: "#0b1328", borderBottom: "1px solid rgba(140,170,255,0.2)" }}>
          {["#ff5f57", "#febc2e", "#28c840"].map((d) => (
            <div key={d} style={{ width: 13, height: 13, borderRadius: "50%", background: d }} />
          ))}
          <div style={{ marginLeft: 18, flex: 1, height: 24, borderRadius: 8, background: "rgba(255,255,255,0.06)", fontFamily: MONO, fontSize: 15, color: C.dim, display: "flex", alignItems: "center", paddingLeft: 14 }}>{url}</div>
        </div>
        <div style={{ position: "relative", width, height: H, overflow: "hidden" }}>
          <div style={{ position: "absolute", left: 0, top: 0, width, height: H, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
            <Img src={staticFile(src)} style={{ width, height: H }} />
            {overlay?.(px)}
          </div>
        </div>
      </div>
    </div>
  );
};

/** A glowing ring drawn around a region of a ConsoleShot, in source pixels. */
export const Spotlight: React.FC<{ px: (n: number) => number; x: number; y: number; w: number; h: number; show: number; color?: string }> = ({ px, x, y, w, h, show, color = C.tealBright }) => (
  <div
    style={{
      position: "absolute",
      left: px(x - 8),
      top: px(y - 8),
      width: px(w + 16),
      height: px(h + 16),
      borderRadius: px(22),
      border: `${px(5)}px solid ${color}`,
      boxShadow: `0 0 ${px(40)}px ${color}aa`,
      opacity: show,
      transform: `scale(${1.05 - show * 0.05})`,
      boxSizing: "border-box",
    }}
  />
);
