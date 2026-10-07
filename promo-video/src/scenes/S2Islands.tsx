import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, MONO, Stage, prog, rise } from "../theme";

const ISLANDS = [
  { label: "CLOUD", x: 200, y: 420, rot: -4, dx: -90, bars: [["80%", "#1c2540"], ["60%", "#3b1d24"], ["70%", "#1c2540"]] },
  { label: "ON-PREM", x: 760, y: 520, rot: 2, dx: 0, bars: [["65%", "#1c2540"], ["85%", "#1c2540"], ["50%", "#3a3010"]] },
  { label: "OT · SHIPS · PLANTS", x: 1320, y: 400, rot: 5, dx: 90, bars: [["75%", "#3b1d24"], ["55%", "#1c2540"], ["80%", "#1c2540"]] },
];

const Link: React.FC<{ x: number; y: number; angle: number; grow: number; snap: number }> = ({ x, y, angle, grow, snap }) => {
  const gap = snap * 40;
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `rotate(${angle}deg)`, transformOrigin: "left center" }}>
      <div style={{ position: "absolute", left: 0, width: 80 * grow - gap / 2, borderTop: "4px dashed #3a4566", opacity: 1 - snap * 0.4 }} />
      <div style={{ position: "absolute", left: 80 + gap / 2, width: Math.max(0, 80 * grow - 80), borderTop: "4px dashed #3a4566", opacity: 1 - snap * 0.4 }} />
      <div
        style={{
          position: "absolute",
          left: 62,
          top: -34,
          fontSize: 50,
          fontWeight: 700,
          color: C.threat,
          opacity: snap,
          transform: `rotate(${-angle}deg) scale(${0.5 + snap * 0.5})`,
        }}
      >
        ×
      </div>
    </div>
  );
};

export const S2Islands: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = prog(frame, 0, 150);
  const push = interpolate(frame, [0, 150], [1, 1.06]);
  const grow = prog(frame, 36, 62);
  const snapA = prog(frame, 80, 86);
  const snapB = prog(frame, 94, 100);
  const out = prog(frame, 138, 150);

  return (
    <Stage>
      <div style={{ position: "absolute", inset: 0, transform: `scale(${push})`, opacity: 1 - out }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 110, textAlign: "center", fontSize: 92, fontWeight: 700, letterSpacing: "-0.02em", ...rise(frame, 4) }}>
          Your security lives in a dozen places.
        </div>

        {ISLANDS.map((isl, i) => (
          <div
            key={isl.label}
            style={{
              position: "absolute",
              left: isl.x + isl.dx * drift,
              top: isl.y + (i === 1 ? 30 : -20) * drift,
              width: 420,
              height: 320,
              transform: `rotate(${isl.rot * (0.6 + drift * 0.6)}deg)`,
              background: "#0e1424",
              border: "2px solid #26314a",
              borderRadius: 32,
              padding: 34,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: 22,
              ...rise(frame, 10 + i * 8, 50),
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 26, color: C.dim }}>{isl.label}</div>
            {isl.bars.map(([w, bg], j) => (
              <div key={j} style={{ width: w, height: 30, borderRadius: 8, background: bg }} />
            ))}
          </div>
        ))}

        <Link x={640 - 90 * drift * 0.5} y={600} angle={14} grow={grow} snap={snapA} />
        <Link x={1190 + 90 * drift * 0.5} y={640} angle={-16} grow={grow} snap={snapB} />

        <div style={{ position: "absolute", left: 0, right: 0, bottom: 90, textAlign: "center", fontFamily: MONO, fontSize: 30, color: C.faint, ...rise(frame, 104, 16) }}>
          12 consoles · 12 logins · 0 shared context
        </div>
      </div>
    </Stage>
  );
};
