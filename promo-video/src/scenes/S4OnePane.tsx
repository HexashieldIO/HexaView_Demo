import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, HEX_CLIP, MONO, Stage, prog, rise } from "../theme";

const tile: React.CSSProperties = {
  background: C.panel,
  border: `2px solid ${C.line}`,
  borderRadius: 20,
  padding: "24px 28px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
  boxSizing: "border-box",
};
const lbl: React.CSSProperties = { fontFamily: MONO, fontSize: 20, color: C.dim, letterSpacing: "0.08em" };
const NAV = ["HexaSOC", "HexaInt", "HexaStrike", "HexaOT", "HexaComply", "HexaCustody", "HexaAI"];
const TOOLS = [C.navy2, C.navy2, C.tealDeep, C.navy2, C.tealDeep, C.navy2, C.tealDeep, C.navy2, C.tealDeep, C.navy2, C.tealDeep, C.navy2, C.navy2, C.tealDeep];

export const S4OnePane: React.FC = () => {
  const frame = useCurrentFrame();
  const panel = prog(frame, 4, 30);
  const dial = prog(frame, 40, 100);
  const score = Math.round(dial * 87);
  const push = interpolate(frame, [0, 180], [1, 1.05]);
  const R = 96;
  const circ = 2 * Math.PI * R;

  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 50, textAlign: "center", fontSize: 72, fontWeight: 700, letterSpacing: "-0.02em", ...rise(frame, 2) }}>
        One pane. Every function. Full control.
      </div>

      <div
        style={{
          position: "absolute",
          left: 160,
          top: 170,
          width: 1600,
          height: 840,
          background: "#0a1124",
          border: "2px solid #2a3a5c",
          borderRadius: 32,
          display: "flex",
          overflow: "hidden",
          boxShadow: "0 60px 160px rgba(47,191,160,0.2)",
          opacity: panel,
          transform: `translateY(${(1 - panel) * 80}px) scale(${push * (0.94 + panel * 0.06)})`,
        }}
      >
        <div style={{ width: 300, background: "#070d1d", borderRight: "2px solid #1a2542", padding: "32px 28px", boxSizing: "border-box", display: "flex", flexDirection: "column", gap: 22, fontSize: 24, color: C.dim }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, color: C.text, fontWeight: 700, fontSize: 28 }}>
            <Img src={staticFile("brand/HexaView_mark.svg")} style={{ width: 46, height: 46 }} />
            HexaView
          </div>
          <div style={{ color: C.text, background: "#122348", margin: "0 -12px", padding: "8px 12px", borderRadius: 10 }}>Command Centre</div>
          {NAV.map((n, i) => (
            <div key={n} style={rise(frame, 14 + i * 3, 12, 10)}>{n}</div>
          ))}
        </div>

        <div style={{ flex: 1, padding: 32, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gridTemplateRows: "400px 1fr", gap: 24 }}>
          <div style={{ ...tile, alignItems: "center", ...rise(frame, 22) }}>
            <div style={lbl}>RESILIENCE INDEX</div>
            <div style={{ position: "relative", width: 240, height: 240 }}>
              <svg width={240} height={240} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
                <circle cx={120} cy={120} r={R} stroke="#1a2542" strokeWidth={20} fill="none" />
                <circle cx={120} cy={120} r={R} stroke={C.teal} strokeWidth={20} fill="none" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - 0.87 * dial)} />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 84, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>{score}</div>
            </div>
            <div style={{ fontFamily: MONO, fontSize: 18, color: C.faint }}>demo data</div>
          </div>

          <div style={{ ...tile, ...rise(frame, 30) }}>
            <div style={lbl}>ESTATE</div>
            {[
              ["Cloud", "healthy", C.assured],
              ["On-prem", "healthy", C.assured],
              ["OT", "1 to review", C.warning],
            ].map(([n, s, col], i) => (
              <div key={n} style={{ display: "flex", justifyContent: "space-between", fontSize: 30, paddingTop: 18, ...rise(frame, 40 + i * 8, 14) }}>
                <span>{n}</span>
                <span style={{ color: col }}>{s}</span>
              </div>
            ))}
            <div style={{ height: 12, borderRadius: 6, background: "#1a2542", marginTop: "auto" }}>
              <div style={{ width: `${82 * prog(frame, 50, 100)}%`, height: 12, borderRadius: 6, background: C.assured }} />
            </div>
          </div>

          <div style={{ ...tile, ...rise(frame, 38) }}>
            <div style={lbl}>ATTENTION QUEUE</div>
            {[
              ["OT · vessel segment drift", "#15120a", "#f5d77a"],
              ["Contained · phishing wave", "#0f2a26", "#b6f2e3"],
              ["Closed · exposed S3 bucket", "#0f2a26", "#b6f2e3"],
            ].map(([t, bg, col], i) => {
              const p = prog(frame, 56 + i * 12, 70 + i * 12);
              return (
                <div key={t} style={{ fontSize: 24, padding: "16px 18px", borderRadius: 12, background: bg, color: col, opacity: p, transform: `translateX(${(1 - p) * 40}px)` }}>
                  {t}
                </div>
              );
            })}
          </div>

          <div style={{ ...tile, gridColumn: "span 3", justifyContent: "center", gap: 24, ...rise(frame, 46) }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={lbl}>HEXACORE · INTEGRATION FABRIC</div>
              <div style={{ fontSize: 26, color: C.muted }}>Read from every tool. Write back with approval.</div>
            </div>
            <div style={{ display: "flex", gap: 16, justifyContent: "space-between" }}>
              {TOOLS.map((col, i) => {
                const lit = prog(frame, 70 + i * 6, 80 + i * 6);
                return (
                  <div
                    key={i}
                    style={{
                      width: 76,
                      height: 88,
                      clipPath: HEX_CLIP,
                      background: i === TOOLS.length - 1 && lit > 0.5 ? C.teal : col,
                      opacity: 0.25 + lit * 0.75,
                      transform: `scale(${0.8 + lit * 0.2})`,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Stage>
  );
};
