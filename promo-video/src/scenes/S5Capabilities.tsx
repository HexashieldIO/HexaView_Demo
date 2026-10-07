import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { BrandIcon, C, Stage, prog, rise } from "../theme";

const RADIUS = 300;
const ICON = 180;
const CX = 960;
const CY = 520;

// Colours match each module's icon in the platform.
const CAPS = [
  { name: "HexaSOC", sub: "24/7 MDR & response", icon: "HexaSOC_icon", color: "#A580F8" },
  { name: "HexaInt", sub: "Dark web & intel", icon: "HexaInt_icon", color: "#DF70A8" },
  { name: "HexaStrike", sub: "AI pen testing", icon: "HexaStrike_icon", color: "#EB7074" },
  { name: "HexaOT", sub: "Ships, plants, devices", icon: "HexaOT_icon", color: "#EFA468" },
  { name: "HexaComply", sub: "GRC & third-party risk", icon: "HexaComply_icon", color: "#61C49A" },
  { name: "HexaCustody", sub: "Chain of evidence", icon: "HexaCustody_icon", color: "#ECC873" },
];

export const S5Capabilities: React.FC = () => {
  const frame = useCurrentFrame();
  const spin = prog(frame, 168, 200) * 60;
  const core = prog(frame, 0, 16);

  return (
    <Stage>
      {CAPS.map((cap, i) => {
        const start = 12 + i * 14;
        const p = prog(frame, start, start + 22);
        const angle = -90 + i * 60 + spin + (1 - p) * 120;
        const dist = interpolate(p, [0, 1], [1100, RADIUS]);
        const rad = (angle * Math.PI) / 180;
        const x = CX + dist * Math.cos(rad);
        const y = CY + dist * Math.sin(rad);
        // Each cell lights up in turn once the ring is complete.
        const at = 104 + i * 10;
        const pulse = prog(frame, at, at + 6) * (1 - prog(frame, at + 8, at + 20));
        return (
          <React.Fragment key={cap.name}>
            <BrandIcon
              name={cap.icon}
              x={x}
              y={y}
              size={ICON}
              style={{ opacity: p, transform: `scale(${1 + pulse * 0.12})`, filter: `drop-shadow(0 0 ${pulse * 40}px ${cap.color})` }}
            />
            <div
              style={{
                position: "absolute",
                left: x - 160,
                top: y + ICON / 2 - 4,
                width: 320,
                textAlign: "center",
                opacity: p,
              }}
            >
              <div style={{ fontSize: 32, fontWeight: 700, color: pulse > 0.3 ? cap.color : C.text }}>{cap.name}</div>
              <div style={{ fontSize: 21, color: C.muted, marginTop: 2 }}>{cap.sub}</div>
            </div>
          </React.Fragment>
        );
      })}

      <BrandIcon name="HexaView_mark" x={CX} y={CY} size={230} style={{ opacity: core, transform: `scale(${0.6 + core * 0.4})` }} />

      <div style={{ position: "absolute", left: 90, top: 430, width: 420, display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.05, ...rise(frame, 60) }}>Six capabilities.</div>
        <div style={{ fontSize: 38, color: C.muted, ...rise(frame, 78) }}>20 managed services.</div>
      </div>
      <div style={{ position: "absolute", right: 90, top: 430, width: 420, display: "flex", flexDirection: "column", gap: 18, textAlign: "right" }}>
        <div style={{ fontSize: 66, fontWeight: 700, lineHeight: 1.05, ...rise(frame, 110) }}>One console.</div>
        <div style={{ fontSize: 38, color: C.muted, ...rise(frame, 128) }}>With HexaAI, a cited copilot.</div>
      </div>
    </Stage>
  );
};
