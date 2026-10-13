import React from "react";
import { interpolate } from "remotion";
import { BrandIcon, C, MONO, Stage, prog, rise, useSceneFrame } from "../theme";

// HexaView is a vendor-agnostic SaaS platform: it plugs into whatever security tooling a client
// already owns, maps it into one canonical model and manages it both ways. Shown by category,
// never by vendor.
type Env = "IT" | "CLOUD" | "OT";
const ENV_COLOR: Record<Env, string> = { IT: "#68B1FF", CLOUD: "#9980FD", OT: "#EFA468" };

const LEFT: [string, string, Env][] = [
  ["EDR / XDR", "Endpoints", "IT"],
  ["SIEM", "Logs & detections", "IT"],
  ["Identity", "Users & access", "CLOUD"],
  ["PAM", "Privileged access", "IT"],
  ["SASE / SSE", "Secure access", "CLOUD"],
  ["Firewall", "Network edge", "IT"],
  ["NDR", "Network traffic", "IT"],
  ["Email security", "Inbound mail", "CLOUD"],
  ["DLP", "Data protection", "IT"],
  ["MDM", "Mobile & devices", "CLOUD"],
];
const RIGHT: [string, string, Env][] = [
  ["Cloud", "IaaS & SaaS", "CLOUD"],
  ["CNAPP", "Cloud posture", "CLOUD"],
  ["Vulnerability", "Scanners", "IT"],
  ["Attack surface", "External exposure", "CLOUD"],
  ["Threat intel", "Feeds & IOCs", "CLOUD"],
  ["OT security", "ICS & PLCs", "OT"],
  ["IoT & medical", "Connected devices", "OT"],
  ["Backup", "Recovery", "IT"],
  ["ITSM", "Tickets & change", "CLOUD"],
  ["GRC", "Controls & evidence", "CLOUD"],
];

const MODEL = ["Assets", "Identities", "Exposures", "Detections", "Controls", "Evidence"];

const COL_W = 250;
const ROW_H = 62;
const GRID_TOP = 300;
const ROWS = 5;
const HUB = { x: 960, y: 520 };

const chipPos = (side: "L" | "R", i: number) => {
  const col = Math.floor(i / ROWS);
  const row = i % ROWS;
  const x = side === "L" ? 80 + col * (COL_W + 20) : 1920 - 80 - COL_W - col * (COL_W + 20);
  return { x, y: GRID_TOP + row * (ROW_H + 18) };
};

const Chip: React.FC<{ name: string; kind: string; env: Env; x: number; y: number; show: number; lit: number }> = ({ name, kind, env, x, y, show, lit }) => (
  <div
    style={{
      position: "absolute",
      left: x,
      top: y,
      width: COL_W,
      height: ROW_H,
      boxSizing: "border-box",
      borderRadius: 14,
      background: "rgba(10,20,50,0.9)",
      border: `2px solid ${lit > 0.5 ? C.tealBright : "rgba(140,170,255,0.3)"}`,
      boxShadow: lit > 0.5 ? "0 0 24px rgba(58,208,174,0.35)" : "none",
      padding: "0 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      opacity: show,
      transform: `scale(${0.85 + show * 0.15})`,
    }}
  >
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 22, fontWeight: 700, whiteSpace: "nowrap" }}>{name}</div>
      <div style={{ fontFamily: MONO, fontSize: 14, color: C.dim }}>{kind.toUpperCase()}</div>
    </div>
    <div style={{ fontFamily: MONO, fontSize: 12, color: ENV_COLOR[env], border: `1px solid ${ENV_COLOR[env]}`, borderRadius: 6, padding: "2px 6px", flexShrink: 0 }}>{env}</div>
  </div>
);

export const S5Integrations: React.FC = () => {
  const frame = useSceneFrame();
  const hub = prog(frame, 6, 22);
  const all = [...LEFT.map((c, i) => ({ c, side: "L" as const, i })), ...RIGHT.map((c, i) => ({ c, side: "R" as const, i }))];
  const connected = all.filter((_, k) => frame >= 30 + k * 3).length;

  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 50, textAlign: "center", fontSize: 84, fontWeight: 700, letterSpacing: "-0.02em", ...rise(frame, 2) }}>
        Integrated, not assembled.
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 160, textAlign: "center", fontSize: 36, color: "#c8d4f0", ...rise(frame, 12) }}>
        Any vendor, any tool you already own. HexaCore maps it all into one model.
      </div>

      {/* Connections: each tool docks into HexaCore; data flows in, actions flow back out. */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {all.map(({ side, i }, k) => {
          const p = chipPos(side, i);
          const sx = side === "L" ? p.x + COL_W : p.x;
          const sy = p.y + ROW_H / 2;
          const on = prog(frame, 30 + k * 3, 40 + k * 3);
          const ex = sx + (HUB.x - sx) * on;
          const ey = sy + (HUB.y - sy) * on;
          // Packets loop continuously: inbound in blue, the occasional write-back in teal.
          const cycle = 36;
          const ph = ((frame + k * 7) % cycle) / cycle;
          const inbound = (k + Math.floor((frame + k * 7) / cycle)) % 4 !== 0;
          const t = inbound ? ph : 1 - ph;
          return (
            <g key={k}>
              <line x1={sx} y1={sy} x2={ex} y2={ey} stroke="rgba(140,170,255,0.35)" strokeWidth={2} />
              {on >= 1 && frame > 60 && (
                <circle cx={sx + (HUB.x - sx) * t} cy={sy + (HUB.y - sy) * t} r={6} fill={inbound ? "#8db4ff" : C.tealBright} opacity={0.9} />
              )}
            </g>
          );
        })}
      </svg>

      {all.map(({ c, side, i }, k) => {
        const p = chipPos(side, i);
        return <Chip key={c[0]} name={c[0]} kind={c[1]} env={c[2]} x={p.x} y={p.y} show={prog(frame, 14 + k * 2, 26 + k * 2)} lit={prog(frame, 38 + k * 3, 42 + k * 3)} />;
      })}

      <BrandIcon name="HexaView_mark" x={HUB.x} y={HUB.y} size={230} style={{ opacity: hub, transform: `scale(${0.7 + hub * 0.3 + 0.03 * Math.sin(frame / 5)})`, filter: "drop-shadow(0 0 40px rgba(58,208,174,0.6))" }} />
      <div style={{ position: "absolute", left: HUB.x - 200, top: HUB.y + 112, width: 400, textAlign: "center", opacity: hub }}>
        <div style={{ fontSize: 30, fontWeight: 700 }}>HexaCore</div>
        <div style={{ fontFamily: MONO, fontSize: 18, color: C.tealBright, letterSpacing: "0.06em" }}>{connected} / {all.length} CONNECTED</div>
      </div>

      {/* One canonical model comes out of the other side. */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 790, display: "flex", justifyContent: "center", gap: 14 }}>
        {MODEL.map((m, i) => {
          const p = prog(frame, 120 + i * 6, 132 + i * 6);
          return (
            <div
              key={m}
              style={{
                padding: "14px 24px",
                borderRadius: 999,
                background: "rgba(58,208,174,0.14)",
                border: `2px solid ${C.tealBright}`,
                fontSize: 26,
                fontWeight: 600,
                color: "#d8f3ec",
                opacity: p,
                transform: `translateY(${(1 - p) * 20}px)`,
              }}
            >
              {m}
            </div>
          );
        })}
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 50,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 26,
          letterSpacing: "0.08em",
          color: "#c8d4f0",
          opacity: interpolate(frame, [160, 176], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        VENDOR-AGNOSTIC · 758 INTEGRATIONS · 56 CATEGORIES · WRITE BACK WITH APPROVAL
      </div>
    </Stage>
  );
};
