import React from "react";
import { interpolate } from "remotion";
import { C, MONO, Stage, prog, rand, useSceneFrame } from "../theme";

type Alert = { text: string; x: number; y: number; rot: number; tone: "red" | "amber"; at: number; fade?: number };

const ALERTS: Alert[] = [
  { text: "EDR · CRITICAL · host-4471", x: 80, y: 90, rot: 0, tone: "red", at: 0 },
  { text: "SIEM · 1,204 events / min", x: 600, y: 170, rot: -3, tone: "red", at: 0 },
  { text: "Firewall · policy drift", x: 1240, y: 80, rot: 0, tone: "amber", at: 0 },
  { text: "Cloud posture · 38 misconfigs", x: 180, y: 290, rot: 2, tone: "amber", at: 0 },
  { text: "OT sensor · PLC write detected", x: 1060, y: 300, rot: 0, tone: "red", at: 0 },
  { text: "IAM · impossible travel", x: 1460, y: 440, rot: 4, tone: "red", at: 0 },
  { text: "Email gateway · 212 quarantined", x: 60, y: 760, rot: -2, tone: "red", at: 0 },
  { text: "Vuln scanner · 9,812 open", x: 1280, y: 800, rot: 0, tone: "amber", at: 0 },
  { text: "Dark web · credentials for sale", x: 640, y: 880, rot: 3, tone: "red", at: 0 },
  { text: "Ticketing · 47 unassigned", x: 120, y: 520, rot: 0, tone: "amber", at: 32, fade: 0.5 },
  { text: "DLP · USB exfil attempt", x: 1500, y: 640, rot: -2, tone: "red", at: 38, fade: 0.55 },
  { text: "MDM · 312 devices non-compliant", x: 860, y: 60, rot: 2, tone: "amber", at: 44, fade: 0.6 },
  { text: "WAF · SQLi burst", x: 420, y: 660, rot: -4, tone: "red", at: 50, fade: 0.5 },
  { text: "Backup · job failed", x: 1560, y: 220, rot: 3, tone: "amber", at: 56, fade: 0.5 },
];

const TONES = {
  red: { bg: "#140c14", border: "#5a2330", color: "#ffb4b4" },
  amber: { bg: "#15120a", border: "#6b5410", color: "#f5d77a" },
};

export const S1Noise: React.FC = () => {
  const frame = useSceneFrame();
  // 12 fps stutter: the noise act deliberately moves on every other frame.
  const step = Math.floor(frame / 2);
  const head = prog(frame, 46, 54);
  const sub = prog(frame, 66, 78);
  const ping = (frame % 24) / 24;

  return (
    <Stage>
      {ALERTS.map((a, i) => {
        if (frame < a.at) return null;
        const t = TONES[a.tone];
        const pop = a.at === 0 ? 1 : prog(frame, a.at, a.at + 4);
        const jx = (rand(i * 31 + step) - 0.5) * 8;
        const jy = (rand(i * 17 + step * 3) - 0.5) * 8;
        const drift = interpolate(frame, [0, 120], [0, (rand(i) - 0.5) * 60]);
        return (
          <div
            key={a.text}
            style={{
              position: "absolute",
              left: a.x + jx + drift,
              top: a.y + jy,
              transform: `rotate(${a.rot}deg) scale(${1.25 - pop * 0.25})`,
              opacity: pop * (a.fade ?? 1) * (1 - 0.6 * head),
              background: t.bg,
              border: `2px solid ${t.border}`,
              color: t.color,
              borderRadius: 14,
              padding: "16px 22px",
              fontFamily: MONO,
              fontSize: 26,
              whiteSpace: "nowrap",
            }}
          >
            {a.text}
          </div>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 1720,
          top: 590,
          width: 26,
          height: 26,
          marginLeft: -13,
          borderRadius: "50%",
          background: C.threat,
          boxShadow: `0 0 0 ${ping * 60}px rgba(239,68,68,${0.35 * (1 - ping)})`,
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 420,
          textAlign: "center",
          fontSize: 150,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          opacity: head,
          transform: `scale(${1.35 - head * 0.35})`,
          textShadow: `${(1 - head) * 10 + 3}px 0 rgba(239,68,68,0.55), ${-(1 - head) * 10 - 3}px 0 rgba(34,211,238,0.35)`,
        }}
      >
        Too many tools.
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 600,
          textAlign: "center",
          fontSize: 58,
          fontWeight: 500,
          color: C.muted,
          opacity: sub,
        }}
      >
        Too many alerts. Not enough eyes.
      </div>
    </Stage>
  );
};
