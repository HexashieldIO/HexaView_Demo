import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, MONO, Stage, prog, rise } from "../theme";

const typed = (text: string, frame: number, start: number, cps = 1.4) =>
  text.slice(0, Math.max(0, Math.floor((frame - start) * cps)));

const COPILOT = "Matches ATT&CK for ICS T0836, Modify Parameter. Sources:";
const HASH = "sha256 · 9f2c71d0…e41a";

const Card: React.FC<{ k: string; title: string; on: number; children: React.ReactNode }> = ({ k, title, on, children }) => (
  <div
    style={{
      width: 360,
      height: 300,
      background: C.panel,
      border: `3px solid ${on > 0.5 ? C.assured : C.line}`,
      boxShadow: on > 0.5 ? "0 0 60px rgba(47,191,160,0.25)" : "none",
      borderRadius: 26,
      padding: 30,
      boxSizing: "border-box",
      display: "flex",
      flexDirection: "column",
      gap: 18,
      opacity: 0.35 + on * 0.65,
    }}
  >
    <div style={{ fontFamily: MONO, fontSize: 20, letterSpacing: "0.12em", color: C.dim }}>{k}</div>
    <div style={{ fontSize: 34, fontWeight: 700 }}>{title}</div>
    {children}
  </div>
);

const Arrow: React.FC<{ on: number }> = ({ on }) => (
  <div style={{ alignSelf: "center", fontSize: 56, color: on > 0.5 ? C.assured : "#3a4f80" }}>→</div>
);

export const S6ClosedLoop: React.FC = () => {
  const frame = useCurrentFrame();
  const on = [0, 1, 2, 3].map((i) => prog(frame, 18 + i * 28, 26 + i * 28));
  const click = 112;
  const clicked = frame >= click;
  const press = frame >= click && frame < click + 5 ? 0.95 : 1;
  const cur = prog(frame, 92, click - 2);
  const loop = prog(frame, 142, 172);
  const loopLen = 1700;

  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 110, display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
        <div style={{ fontSize: 96, fontWeight: 700, letterSpacing: "-0.02em", ...rise(frame, 2) }}>Not another dashboard.</div>
        <div style={{ fontSize: 42, color: C.muted, ...rise(frame, 14) }}>A console that writes back, with approval and on the record.</div>
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 420, display: "flex", justifyContent: "center", gap: 26 }}>
        <Card k="01 · DETECT" title="HexaSOC + HexaOT" on={on[0]}>
          <div style={{ fontSize: 24, padding: "14px 16px", borderRadius: 12, background: "#15120a", color: "#f5d77a" }}>Unusual PLC write · vessel segment</div>
        </Card>
        <Arrow on={on[1]} />
        <Card k="02 · EXPLAIN" title="HexaAI copilot" on={on[1]}>
          <div style={{ fontSize: 24, lineHeight: 1.4, color: "#c8d1e6" }}>
            {typed(COPILOT, frame, 50)}
            {frame > 50 + COPILOT.length / 1.4 && <span style={{ color: C.signalSoft }}> [1] [2] [3]</span>}
          </div>
        </Card>
        <Arrow on={on[2]} />
        <Card k="03 · ACT" title="Action Centre" on={on[2]}>
          <div
            style={{
              marginTop: "auto",
              height: 76,
              borderRadius: 16,
              background: clicked ? C.tealDeep : C.assured,
              color: clicked ? "#b6f2e3" : C.night,
              fontSize: 28,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${press})`,
            }}
          >
            {clicked ? "Isolated ✓" : "Approve isolation"}
          </div>
        </Card>
        <Arrow on={on[3]} />
        <Card k="04 · PROVE" title="Audit Ledger" on={on[3]}>
          <div style={{ fontFamily: MONO, fontSize: 22, lineHeight: 1.6, color: C.assured }}>
            {typed(HASH, frame, 132, 2)}
            <br />
            {frame > 146 && "✓ chained"}
          </div>
        </Card>
      </div>

      {/* Cursor travels to Approve and clicks. */}
      <svg
        width={44}
        height={44}
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: interpolate(cur, [0, 1], [1300, 1120]),
          top: interpolate(cur, [0, 1], [960, 668]),
          opacity: frame > 88 && frame < 134 ? 1 : 0,
        }}
      >
        <path d="M4 2l16 10-7 1.5L9.5 21z" fill={C.text} stroke={C.night} strokeWidth={1.5} strokeLinejoin="round" />
      </svg>

      <svg width={1920} height={260} style={{ position: "absolute", left: 0, top: 740 }}>
        <path
          d="M 180 0 L 180 120 Q 180 200 260 200 L 1660 200 Q 1740 200 1740 120 L 1740 0"
          fill="none"
          stroke={C.teal}
          strokeWidth={4}
          strokeDasharray={loopLen}
          strokeDashoffset={loopLen * (1 - loop)}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 922,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 26,
          letterSpacing: "0.1em",
          color: C.signalSoft,
          opacity: prog(frame, 160, 172),
        }}
      >
        <span style={{ background: C.night, padding: "0 24px" }}>CLOSED-LOOP ASSURANCE</span>
      </div>
    </Stage>
  );
};
