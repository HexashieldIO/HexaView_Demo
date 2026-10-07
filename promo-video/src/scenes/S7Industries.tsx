import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, Hex, MONO, Stage, prog, rise } from "../theme";

const Icon: React.FC<{ d: React.ReactNode; size: number }> = ({ d, size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

const INDUSTRIES = [
  { name: "Maritime", fw: "Vessels at sea · port OT", tint: "#0f2f4a", d: <><path d="M3 17l2 4h14l2-4z" /><path d="M5 17V11h14v6" /><path d="M9 11V6h6v5" /><path d="M12 6V3" /></> },
  { name: "Finance", fw: "DORA · PCI DSS · SWIFT CSP", tint: "#14284d", d: <><path d="M3 10l9-6 9 6" /><path d="M5 10v8M9 10v8M15 10v8M19 10v8" /><path d="M3 21h18" /></> },
  { name: "Media", fw: "TPN · MPA · content custody", tint: "#3a2a10", d: <><rect x="3" y="9" width="18" height="12" rx="1" /><path d="M3 9l2-5h16l-2 5" /><path d="M8 4l-1 5M13 4l-1 5M18 4l-1 5" /></> },
  { name: "Healthcare", fw: "HIPAA · HITRUST · FDA 524B", tint: "#0f3a35", d: <><path d="M12 21s-8-5-8-11a4.5 4.5 0 018-2.8A4.5 4.5 0 0120 10c0 6-8 11-8 11z" /><path d="M8 12h2l1-2 2 4 1-2h2" /></> },
  { name: "Automotive", fw: "UNECE R155 · TISAX · IEC 62443", tint: "#3a1a1d", d: <><path d="M3 16v-3l2-5h14l2 5v3z" /><circle cx="7.5" cy="17" r="2" /><circle cx="16.5" cy="17" r="2" /><path d="M5 13h14" /></> },
];

const CUT = 14; // frames per match cut
const SHRINK = INDUSTRIES.length * CUT; // 70

export const S7Industries: React.FC = () => {
  const frame = useCurrentFrame();
  const shrink = prog(frame, SHRINK, SHRINK + 26);
  const current = Math.min(INDUSTRIES.length - 1, Math.floor(frame / CUT));

  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 80, textAlign: "center", fontSize: 80, fontWeight: 700, letterSpacing: "-0.02em", lineHeight: 1.12, ...rise(frame, 4) }}>
        From the terminal to the trading floor
        <br />
        to the operating theatre.
      </div>

      {/* Match cuts: one world per beat inside a single large cell. */}
      {shrink < 1 && (
        <Hex
          x={960}
          y={interpolate(shrink, [0, 1], [640, 640])}
          w={interpolate(shrink, [0, 1], [460, 200])}
          color={INDUSTRIES[current].tint}
          style={{ opacity: 1 - shrink, color: "#e5f6f1", gap: 10 }}
        >
          <Icon d={INDUSTRIES[current].d} size={170} />
          <div style={{ fontSize: 44, fontWeight: 700 }}>{INDUSTRIES[current].name}</div>
        </Hex>
      )}

      <div style={{ position: "absolute", left: 0, right: 0, top: 470, display: "flex", justifyContent: "center", gap: 44 }}>
        {INDUSTRIES.map((ind, i) => {
          const p = prog(frame, SHRINK + 8 + i * 4, SHRINK + 26 + i * 4);
          return (
            <div key={ind.name} style={{ width: 290, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: p, transform: `translateY(${(1 - p) * 40}px)` }}>
              <div style={{ position: "relative", width: 220, height: 254 }}>
                <Hex x={110} y={127} w={220} color={ind.tint} style={{ color: "#cfeee6" }}>
                  <Icon d={ind.d} size={96} />
                </Hex>
              </div>
              <div style={{ fontSize: 38, fontWeight: 700 }}>{ind.name}</div>
              <div style={{ fontFamily: MONO, fontSize: 20, color: C.dim, textAlign: "center", lineHeight: 1.5 }}>{ind.fw}</div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, bottom: 70, textAlign: "center", fontFamily: MONO, fontSize: 28, letterSpacing: "0.06em", color: C.tealBright, ...rise(frame, 130, 16) }}>
        758 INTEGRATIONS · IT AND OT · SAAS, DEDICATED, CUSTOMER-HOSTED OR AIR-GAPPED
      </div>
    </Stage>
  );
};
