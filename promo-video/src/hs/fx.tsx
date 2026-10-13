import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, EASE_IN, Hex, prog } from "../theme";

// The two motion signatures from the HexaView film, in HexaStrike red:
// a logo build (cells fuse, the hexagon draws on, the bolt traces, the wordmark wipes, a light sweep)
// and a honeycomb light wave rippling out from a point.
const HEX = "M60 8 L105 34 L105 86 L60 112 L15 86 L15 34 Z";
const BOLT = "M13 2L4 14h6l-1 8 9-12h-6z";

/** HexaStrike logo build. The PNG is 1275×348; its mark is centred at about (174, 174). */
export const StrikeBuild: React.FC<{ width: number; cx: number; cy: number; start?: number }> = ({ width, cx, cy, start = 0 }) => {
  const frame = useCurrentFrame() - start;
  const K = width / 1275;
  const H = 348 * K;
  const X = cx - width / 2;
  const Y = cy - H / 2;
  const MCX = X + 174 * K;
  const MCY = Y + 174 * K;
  const MARK = 316 * K;
  const outline = prog(frame, 8, 32);
  const fill = prog(frame, 26, 42);
  const bolt = prog(frame, 38, 60);
  const word = prog(frame, 54, 80);
  const swap = prog(frame, 82, 90);
  const sweep = interpolate(frame, [90, 116], [-200, width + 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = prog(frame, 32, 48) * (1 - prog(frame, 48, 80));
  const shards = [0, 60, 120, 180, 240, 300].map((a, i) => ({ a: (a * Math.PI) / 180, delay: i * 2 }));
  return (
    <AbsoluteFill>
      {shards.map((s, i) => {
        const p = prog(frame, s.delay, 24 + s.delay, EASE_IN);
        if (p >= 1 || frame < 0) return null;
        const r = interpolate(p, [0, 1], [720, 0]);
        return <Hex key={i} x={MCX + Math.cos(s.a) * r} y={MCY + Math.sin(s.a) * r * 0.8} w={interpolate(p, [0, 1], [110, 36])} color={i % 2 ? "#C03C41" : "#EB7074"} style={{ opacity: 0.25 + p * 0.75 }} />;
      })}
      <div style={{ position: "absolute", left: MCX - 300, top: MCY - 300, width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(229,72,77,0.5) 0%, rgba(229,72,77,0) 65%)", opacity: glow }} />
      {frame >= 0 && (
        <svg viewBox="0 0 120 120" width={MARK} height={MARK} style={{ position: "absolute", left: MCX - MARK / 2, top: MCY - MARK / 2, opacity: 1 - swap, overflow: "visible" }}>
          <defs>
            <linearGradient id="strikeBuild" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#EB7074" />
              <stop offset="1" stopColor="#C03C41" />
            </linearGradient>
          </defs>
          <path d={HEX} fill="url(#strikeBuild)" fillOpacity={fill} stroke="url(#strikeBuild)" strokeOpacity={fill} strokeWidth={11} strokeLinejoin="round" />
          <path d={HEX} fill="none" stroke="#ffb3b5" strokeWidth={3} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outline} opacity={outline > 0 ? 1 - fill : 0} />
          <g transform="translate(39,39) scale(1.75)" fill="none" stroke="#ffffff" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" opacity={bolt > 0 ? 1 : 0}>
            <path d={BOLT} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - bolt} />
          </g>
        </svg>
      )}
      <div style={{ position: "absolute", left: X, top: Y, width, height: H, overflow: "hidden" }}>
        <Img
          src={staticFile("brand/strike/HexaStrike_logo_reverse.png")}
          style={{
            width,
            height: H,
            clipPath: swap > 0 ? "none" : `inset(0 ${(1 - word) * 73}% 0 27%)`,
            transform: `translateX(${(1 - word) * -40}px)`,
            opacity: swap > 0 ? 1 : word,
          }}
        />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: sweep, width: 160, background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.4), rgba(255,255,255,0))", transform: "skewX(-20deg)", mixBlendMode: "overlay" }} />
      </div>
    </AbsoluteFill>
  );
};

const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
};

/** A honeycomb that fills with a light wave from (cx, cy). Colours shift from `from` to `to` as the crest passes. */
export const HoneyWave: React.FC<{ cx: number; cy: number; start: number; from: string; to: string; speed?: number; opacity?: number }> = ({ cx, cy, start, from, to, speed = 30, opacity = 1 }) => {
  const frame = useCurrentFrame();
  const W = 120;
  const ROW = W * 1.1547 * 0.75;
  const waveR = Math.max(0, (frame - start) * speed);
  const cells: { x: number; y: number; d: number }[] = [];
  for (let row = -6; row <= 7; row++) {
    for (let col = -10; col <= 16; col++) {
      const x = cx + col * W + (Math.abs(row) % 2 === 1 ? W / 2 : 0);
      const y = cy + row * ROW;
      if (x < -W || x > 1920 + W || y < -W || y > 1080 + W) continue;
      cells.push({ x, y, d: Math.hypot(x - cx, y - cy) });
    }
  }
  if (frame < start) return null;
  return (
    <AbsoluteFill style={{ opacity }}>
      {cells.map((c, i) => {
        const passed = waveR > c.d ? 1 : 0;
        const crest = Math.exp(-(((c.d - waveR) / 110) ** 2));
        const base = passed * (c.d < 300 ? 0.5 : 0.18);
        const color = crest > 0.12 ? mix(from, to, Math.min(1, crest * 1.2)) : passed ? to : from;
        return <Hex key={i} x={c.x} y={c.y} w={W - 8} color={color} style={{ opacity: Math.max(base, crest * 0.7) }} />;
      })}
    </AbsoluteFill>
  );
};

export { C };
