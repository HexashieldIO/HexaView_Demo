import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, Hex, MONO, Stage, prog, rand } from "../theme";

const LOGO_W = 900;
const LOGO_H = LOGO_W * (348 / 1194);

// Cells from across the film, collapsing into the logo.
const SHARDS = Array.from({ length: 26 }, (_, i) => {
  const a = rand(i + 3) * Math.PI * 2;
  const r = 700 + rand(i + 9) * 500;
  return { x: 960 + Math.cos(a) * r, y: 540 + Math.sin(a) * r * 0.7, w: 60 + rand(i + 5) * 90, teal: rand(i + 1) > 0.5, delay: Math.floor(rand(i + 7) * 12) };
});

export const S8EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const logo = prog(frame, 30, 52);
  const sweep = interpolate(frame, [54, 80], [-300, LOGO_W + 300], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const tag = prog(frame, 64, 84);
  const cta = prog(frame, 88, 104);
  const by = prog(frame, 104, 120);

  return (
    <Stage>
      {SHARDS.map((s, i) => {
        const p = prog(frame, s.delay, 36 + s.delay);
        if (p >= 1) return null;
        return (
          <Hex
            key={i}
            x={interpolate(p, [0, 1], [s.x, 960 - LOGO_W / 2 + 150])}
            y={interpolate(p, [0, 1], [s.y, 400])}
            w={s.w * (1 - p * 0.8)}
            color={s.teal ? C.tealDark : C.navy2}
            style={{ opacity: 0.85 * (1 - p * 0.6) }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 960 - LOGO_W / 2,
          top: 400 - LOGO_H / 2,
          width: LOGO_W,
          height: LOGO_H,
          opacity: logo,
          transform: `scale(${0.92 + logo * 0.08})`,
          overflow: "hidden",
        }}
      >
        <Img src={staticFile("brand/HexaView_logo_reverse.png")} style={{ width: LOGO_W, height: LOGO_H }} />
        {/* The light wave passes once across the lockup. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: sweep,
            width: 160,
            background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.35), rgba(255,255,255,0))",
            transform: "skewX(-20deg)",
            mixBlendMode: "overlay",
          }}
        />
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 610, textAlign: "center", fontSize: 64, fontWeight: 500, color: "#d8f3ec", opacity: tag, transform: `translateY(${(1 - tag) * 24}px)` }}>
        Visibility you can act on.
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 760, display: "flex", justifyContent: "center", opacity: cta, transform: `scale(${0.94 + cta * 0.06})` }}>
        <div style={{ padding: "26px 56px", borderRadius: 999, background: C.teal, color: C.night, fontSize: 40, fontWeight: 700 }}>Book a demo · hexaview.io</div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 64, textAlign: "center", fontFamily: MONO, fontSize: 26, letterSpacing: "0.2em", color: C.dim, opacity: by }}>
        POWERED BY HEXASHIELD
      </div>
    </Stage>
  );
};
