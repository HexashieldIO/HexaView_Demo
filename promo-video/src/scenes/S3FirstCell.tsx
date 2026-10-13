import React from "react";
import { interpolate } from "remotion";
import { BrandIcon, C, EASE_IN, Hex, MONO, Stage, hexPolygon, prog, rise, useSceneFrame } from "../theme";

const MARK = 210; // rendered size of the HexaView mark (its hexagon is ~84% of the box)
const W = 186; // honeycomb pitch
const HEX_W = 172;
const ROW = W * 1.1547 * 0.75;
const CX = 960;
const CY = 450;

// A pointy-top honeycomb centred on the first cell.
const CELLS: { x: number; y: number; d: number }[] = [];
for (let row = -6; row <= 6; row++) {
  for (let col = -8; col <= 8; col++) {
    const x = CX + col * W + (Math.abs(row) % 2 === 1 ? W / 2 : 0);
    const y = CY + row * ROW;
    if (x < -W || x > 1920 + W || y < -W || y > 1080 + W) continue;
    if (col === 0 && row === 0) continue;
    CELLS.push({ x, y, d: Math.hypot(x - CX, y - CY) });
  }
}

const mix = (a: string, b: string, t: number) => {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i] - v) * t)).join(",")})`;
};

const LAND = 16;

export const S3FirstCell: React.FC = () => {
  const frame = useSceneFrame();
  const drop = prog(frame, 0, LAND, EASE_IN);
  const y = interpolate(drop, [0, 1], [-260, CY]);
  const waveR = Math.max(0, (frame - LAND) * 34);
  const ring = prog(frame, LAND, LAND + 36);

  return (
    <Stage dark>
      {frame >= LAND &&
        CELLS.map((c, i) => {
          const passed = waveR > c.d ? 1 : 0;
          const crest = Math.exp(-(((c.d - waveR) / 120) ** 2));
          const near = c.d < W * 1.2 ? 0.9 : c.d < W * 2.2 ? 0.55 : 0.25;
          const base = passed * near;
          const color = crest > 0.15 ? mix(C.tealDeep, C.teal, crest) : C.tealDeep;
          return <Hex key={i} x={c.x} y={c.y} w={HEX_W} color={color} style={{ opacity: Math.max(base, crest * 0.9) }} />;
        })}

      {/* Shockwave outline on landing. */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: C.tealBright,
          clipPath: hexPolygon(CX, CY, 100 + ring * 520),
          opacity: (1 - ring) * 0.22,
        }}
      />

      <BrandIcon name="HexaView_mark" x={CX} y={y} size={MARK} />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 790,
          textAlign: "center",
          fontSize: 76,
          fontWeight: 700,
          letterSpacing: "-0.02em",
          textShadow: `0 0 40px ${C.night}, 0 0 20px ${C.night}`,
          ...rise(frame, 58),
        }}
      >
        What if every tool lived in one platform?
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 920,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 30,
          color: C.tealBright,
          letterSpacing: `${interpolate(prog(frame, 84, 112), [0, 1], [0.1, 0.32])}em`,
          opacity: prog(frame, 84, 98),
          textShadow: `0 0 20px ${C.night}`,
        }}
      >
        HEXAVIEW™ TRUST CONSOLE
      </div>
    </Stage>
  );
};
