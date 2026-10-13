import React from "react";
import { interpolate } from "remotion";
import { C, MONO, Stage, prog, rand, rise, useSceneFrame } from "../theme";

type Env = "CLOUD" | "ON-PREM" | "OT";
const ENV_COLOR: Record<Env, string> = { CLOUD: "#52C5EF", "ON-PREM": "#A580F8", OT: "#EFA468" };

const CONSOLES: { name: string; env: Env; color: string; clue?: string }[] = [
  { name: "Dark web feed", env: "CLOUD", color: "#DF70A8", clue: "02:41 · password on a paste site" },
  { name: "SIEM", env: "ON-PREM", color: "#68B1FF" },
  { name: "Cloud posture", env: "CLOUD", color: "#52C5EF" },
  { name: "Firewall", env: "ON-PREM", color: "#EB7074" },
  { name: "EDR", env: "ON-PREM", color: "#A580F8" },
  { name: "Identity provider", env: "CLOUD", color: "#9980FD", clue: "02:44 · login from a new country" },
  { name: "Email security", env: "CLOUD", color: "#61C49A" },
  { name: "Vuln scanner", env: "ON-PREM", color: "#ECC873" },
  { name: "Ticketing", env: "CLOUD", color: "#8f9bb6" },
  { name: "DLP", env: "ON-PREM", color: "#DF70A8", clue: "02:46 · 4 GB to an unknown host" },
  { name: "Backup", env: "ON-PREM", color: "#61C49A" },
  { name: "OT monitor", env: "OT", color: "#EFA468", clue: "02:47 · PLC setpoint changed" },
];

const COLS = 4;
const WIN_W = 390;
const WIN_H = 196;
const GAP_X = 44;
const GAP_Y = 40;
const GRID_X = (1920 - (COLS * WIN_W + (COLS - 1) * GAP_X)) / 2;
const GRID_Y = 300;

const pos = (i: number) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return { x: GRID_X + col * (WIN_W + GAP_X), y: GRID_Y + row * (WIN_H + GAP_Y) };
};

const CLUE_IDX = CONSOLES.map((c, i) => (c.clue ? i : -1)).filter((i) => i >= 0);
const HOPS = [0, 5, 9, 2, 11, 6, 1, 7, 3, 10, 4, 8]; // where attention jumps, tab after tab

export const S2Islands: React.FC = () => {
  const frame = useSceneFrame();
  const hop = Math.min(HOPS.length - 1, Math.floor(Math.max(0, frame - 14) / 5));
  const hopOn = frame >= 14 && frame < 74;
  const tryLink = prog(frame, 92, 108);
  const snap = prog(frame, 110, 116);

  return (
    <Stage>
      <div style={{ position: "absolute", inset: 0 }}>
        <div style={{ position: "absolute", left: 0, right: 0, top: 70, textAlign: "center", fontSize: 88, fontWeight: 700, letterSpacing: "-0.02em", ...rise(frame, 2) }}>
          Your security lives in a dozen places.
        </div>
        <div style={{ position: "absolute", left: 0, right: 0, top: 186, textAlign: "center", fontSize: 40, color: "#c8d4f0", ...rise(frame, 84) }}>
          Each tool holds a fragment. Attackers live in the gaps between them.
        </div>

        {CONSOLES.map((c, i) => {
          const { x, y } = pos(i);
          const p = prog(frame, i * 2, i * 2 + 14);
          const fy = Math.sin((frame + i * 13) / 18) * 5;
          const isClue = !!c.clue;
          const clueOn = isClue ? prog(frame, 44 + CLUE_IDX.indexOf(i) * 10, 52 + CLUE_IDX.indexOf(i) * 10) : 0;
          const focused = hopOn && HOPS[hop] === i;
          const bars = Array.from({ length: 14 }, (_, b) => 0.25 + rand(i * 40 + b) * 0.75);
          return (
            <div
              key={c.name}
              style={{
                position: "absolute",
                left: x,
                top: y + fy + (1 - p) * 40,
                width: WIN_W,
                height: WIN_H,
                opacity: p * (frame > 44 && !isClue ? 0.55 : 1),
                background: "rgba(12,22,52,0.92)",
                border: `2px solid ${clueOn > 0.5 ? C.warning : focused ? C.tealBright : "rgba(120,150,220,0.28)"}`,
                borderRadius: 18,
                boxShadow: clueOn > 0.5 ? "0 0 50px rgba(234,179,8,0.35)" : focused ? "0 0 40px rgba(58,208,174,0.35)" : "0 20px 40px rgba(0,0,0,0.35)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ height: 40, display: "flex", alignItems: "center", gap: 8, padding: "0 14px", background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(120,150,220,0.18)" }}>
                {["#ff5f57", "#febc2e", "#28c840"].map((d) => (
                  <div key={d} style={{ width: 11, height: 11, borderRadius: "50%", background: d, opacity: 0.8 }} />
                ))}
                <div style={{ marginLeft: 8, fontSize: 21, fontWeight: 600, flex: 1 }}>{c.name}</div>
                <div style={{ fontFamily: MONO, fontSize: 14, color: ENV_COLOR[c.env], border: `1px solid ${ENV_COLOR[c.env]}`, borderRadius: 6, padding: "2px 7px" }}>{c.env}</div>
              </div>
              <div style={{ flex: 1, padding: "14px 16px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                {isClue && clueOn > 0 ? (
                  <div style={{ fontFamily: MONO, fontSize: 20, color: "#f5d77a", background: "rgba(234,179,8,0.12)", borderRadius: 8, padding: "8px 10px", opacity: clueOn }}>{c.clue}</div>
                ) : (
                  <div style={{ fontFamily: MONO, fontSize: 15, color: C.dim }}>sign in required · separate login</div>
                )}
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 62 }}>
                  {bars.map((h, b) => (
                    <div key={b} style={{ flex: 1, height: `${h * 100 * (0.6 + 0.4 * Math.abs(Math.sin((frame + b * 7 + i) / 10)))}%`, background: c.color, opacity: 0.55, borderRadius: 3 }} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}

        {/* Analysts try to join the clues by hand; the links never hold. */}
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
          {CLUE_IDX.slice(0, -1).map((from, k) => {
            const to = CLUE_IDX[k + 1];
            const a = pos(from);
            const b = pos(to);
            const ax = a.x + WIN_W / 2, ay = a.y + WIN_H / 2, bx = b.x + WIN_W / 2, by = b.y + WIN_H / 2;
            const mx = ax + (bx - ax) * 0.5, my = ay + (by - ay) * 0.5;
            const len = tryLink * 0.5;
            const gap = snap * 0.12;
            return (
              <g key={k} opacity={tryLink}>
                <line x1={ax} y1={ay} x2={ax + (bx - ax) * Math.max(0, len - gap)} y2={ay + (by - ay) * Math.max(0, len - gap)} stroke={C.warning} strokeWidth={4} strokeDasharray="12 10" />
                <line x1={bx} y1={by} x2={bx - (bx - ax) * Math.max(0, len - gap)} y2={by - (by - ay) * Math.max(0, len - gap)} stroke={C.warning} strokeWidth={4} strokeDasharray="12 10" />
                <g opacity={snap} transform={`translate(${mx} ${my}) scale(${0.6 + snap * 0.4})`}>
                  <circle r={26} fill={C.threat} />
                  <path d="M -9 -9 L 9 9 M 9 -9 L -9 9" stroke="#fff" strokeWidth={5} strokeLinecap="round" />
                </g>
              </g>
            );
          })}
        </svg>

        <div
          style={{
            position: "absolute",
            right: 70,
            bottom: 34,
            fontFamily: MONO,
            fontSize: 26,
            color: "#c8d4f0",
            opacity: interpolate(frame, [14, 20, 70, 80], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        >
          switching console {hop + 1} / 12
        </div>
        <div style={{ position: "absolute", left: 70, bottom: 34, fontFamily: MONO, fontSize: 26, color: "#f5d77a", ...rise(frame, 112, 10, 10) }}>
          4 clues · 4 consoles · 0 shared context
        </div>
      </div>
    </Stage>
  );
};
