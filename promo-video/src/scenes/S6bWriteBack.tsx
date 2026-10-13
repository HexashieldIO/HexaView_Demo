import React from "react";
import { interpolate } from "remotion";
import { BrandIcon, C, MONO, Stage, prog, rise, useSceneFrame } from "../theme";

// Bi-directional: an alert flows in from the tool, the analyst acts on the notification,
// and the change is written back to the same tool, approved and logged.
const ROWS = [
  { tool: "EDR", kind: "Endpoint", alert: "Ransomware behaviour detected", action: "Isolate host", done: "Host isolated", risk: "High", sev: C.threat },
  { tool: "Identity provider", kind: "Users & access", alert: "MFA push storm on a finance user", action: "Revoke sessions", done: "Sessions revoked", risk: "Medium", sev: C.warning },
  { tool: "Firewall", kind: "Network", alert: "Beaconing to a known C2 domain", action: "Block domain", done: "Domain blocked", risk: "Medium", sev: C.threat },
  { tool: "Cloud security", kind: "Posture", alert: "Public bucket exposing PII", action: "Make private", done: "Bucket locked down", risk: "Low", sev: C.warning },
  { tool: "ITSM", kind: "Service desk", alert: "P1 ticket about to breach SLA", action: "Escalate", done: "Escalated to on-call", risk: "Low", sev: C.warning },
];

const ROW_Y0 = 330;
const ROW_STEP = 128;
const CARD_H = 104;
const LEFT_X = 90;
const LEFT_W = 650;
const RIGHT_X = 1180;
const RIGHT_W = 650;
const HUB_X = 960;
const HUB_Y = ROW_Y0 + ROW_STEP * 2;

const rowY = (i: number) => ROW_Y0 + i * ROW_STEP;
const timing = (i: number) => {
  const t = 16 + i * 20;
  return { inbound: t, card: t + 12, click: t + 28, outbound: t + 30, done: t + 42 };
};

// A point along tool → hub → notification (inbound) or the reverse (outbound).
const along = (i: number, p: number, inbound: boolean) => {
  const y = rowY(i);
  const a = inbound ? { x: RIGHT_X, y } : { x: LEFT_X + LEFT_W, y };
  const b = inbound ? { x: LEFT_X + LEFT_W, y } : { x: RIGHT_X, y };
  if (p < 0.5) {
    const q = p * 2;
    return { x: a.x + (HUB_X - a.x) * q, y: a.y + (HUB_Y - a.y) * q };
  }
  const q = (p - 0.5) * 2;
  return { x: HUB_X + (b.x - HUB_X) * q, y: HUB_Y + (b.y - HUB_Y) * q };
};

export const S6bWriteBack: React.FC = () => {
  const frame = useSceneFrame();
  const open = ROWS.filter((_, i) => frame >= timing(i).card && frame < timing(i).done).length;
  const raised = ROWS.filter((_, i) => frame >= timing(i).card).length;
  const resolved = ROWS.filter((_, i) => frame >= timing(i).done).length;
  const badge = raised - resolved;

  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 48, textAlign: "center", fontSize: 78, fontWeight: 700, letterSpacing: "-0.02em", ...rise(frame, 2) }}>
        Act on any alert, right where you see it.
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 152, textAlign: "center", fontSize: 36, color: "#c8d4f0", ...rise(frame, 12) }}>
        Bi-directional by design: read from every tool, write back with approval.
      </div>

      {/* Column headers */}
      <div style={{ position: "absolute", left: LEFT_X, top: 238, width: LEFT_W, display: "flex", alignItems: "center", gap: 14, ...rise(frame, 8, 16) }}>
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke={C.text} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0112 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 003.4 0" />
        </svg>
        <div style={{ fontSize: 30, fontWeight: 700 }}>HexaView notifications</div>
        <div
          style={{
            minWidth: 40,
            height: 40,
            borderRadius: 20,
            padding: "0 10px",
            boxSizing: "border-box",
            background: badge > 0 ? C.threat : C.teal,
            color: badge > 0 ? "#fff" : C.night,
            fontWeight: 700,
            fontSize: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {badge > 0 ? badge : "0 ✓"}
        </div>
      </div>
      <div style={{ position: "absolute", left: RIGHT_X, top: 238, width: RIGHT_W, textAlign: "right", fontSize: 30, fontWeight: 700, ...rise(frame, 8, 16) }}>
        Your security tools
      </div>

      {/* HexaCore links: every row is wired both ways through the hub. */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {ROWS.map((_, i) => (
          <g key={i} opacity={0.5 * prog(frame, 6, 20)}>
            <line x1={LEFT_X + LEFT_W} y1={rowY(i)} x2={HUB_X} y2={HUB_Y} stroke="rgba(140,170,255,0.45)" strokeWidth={2} strokeDasharray="6 8" />
            <line x1={HUB_X} y1={HUB_Y} x2={RIGHT_X} y2={rowY(i)} stroke="rgba(140,170,255,0.45)" strokeWidth={2} strokeDasharray="6 8" />
          </g>
        ))}
        {ROWS.map((r, i) => {
          const t = timing(i);
          const pin = prog(frame, t.inbound, t.inbound + 12);
          const pout = prog(frame, t.outbound, t.outbound + 12);
          const inPt = along(i, pin, true);
          const outPt = along(i, pout, false);
          return (
            <g key={r.tool}>
              {pin > 0 && pin < 1 && <circle cx={inPt.x} cy={inPt.y} r={11} fill={r.sev} style={{ filter: `drop-shadow(0 0 10px ${r.sev})` }} />}
              {pout > 0 && pout < 1 && <circle cx={outPt.x} cy={outPt.y} r={11} fill={C.tealBright} style={{ filter: "drop-shadow(0 0 12px #3ad0ae)" }} />}
            </g>
          );
        })}
      </svg>

      <BrandIcon
        name="HexaView_mark"
        x={HUB_X}
        y={HUB_Y}
        size={190}
        style={{
          opacity: prog(frame, 0, 14),
          transform: `scale(${1 + 0.06 * Math.sin(frame / 4) * (open > 0 ? 1 : 0)})`,
          filter: "drop-shadow(0 0 30px rgba(58,208,174,0.55))",
        }}
      />
      <div style={{ position: "absolute", left: HUB_X - 160, top: HUB_Y + 96, width: 320, textAlign: "center", fontFamily: MONO, fontSize: 20, letterSpacing: "0.1em", color: C.tealBright, opacity: prog(frame, 10, 24) }}>
        HEXACORE · TWO-WAY
      </div>

      {ROWS.map((r, i) => {
        const t = timing(i);
        const card = prog(frame, t.card, t.card + 10);
        const clicked = frame >= t.click;
        const press = frame >= t.click && frame < t.click + 5 ? 0.93 : 1;
        const done = frame >= t.done;
        const doneP = prog(frame, t.done, t.done + 8);
        const tool = prog(frame, 4 + i * 3, 18 + i * 3);
        const y = rowY(i) - CARD_H / 2;
        return (
          <React.Fragment key={r.tool}>
            {/* Notification with its action, on the left */}
            <div
              style={{
                position: "absolute",
                left: LEFT_X,
                top: y,
                width: LEFT_W,
                height: CARD_H,
                boxSizing: "border-box",
                borderRadius: 18,
                background: "rgba(10,20,50,0.92)",
                border: `2px solid ${done ? "rgba(58,208,174,0.6)" : "rgba(140,170,255,0.3)"}`,
                display: "flex",
                alignItems: "center",
                gap: 18,
                padding: "0 18px 0 0",
                overflow: "hidden",
                opacity: card * (done ? 0.75 : 1),
                transform: `translateX(${(1 - card) * -60}px)`,
              }}
            >
              <div style={{ width: 8, alignSelf: "stretch", background: done ? C.teal : r.sev }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: MONO, fontSize: 17, color: C.dim }}>{r.tool.toUpperCase()} · {r.kind.toUpperCase()}</div>
                <div style={{ fontSize: 25, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", textDecoration: done ? "line-through" : "none", textDecorationColor: "rgba(229,233,242,0.5)" }}>{r.alert}</div>
              </div>
              <div
                style={{
                  flexShrink: 0,
                  minWidth: 170,
                  height: 56,
                  borderRadius: 28,
                  padding: "0 20px",
                  boxSizing: "border-box",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 21,
                  fontWeight: 700,
                  background: clicked ? "rgba(58,208,174,0.16)" : C.tealBright,
                  color: clicked ? "#b6f2e3" : C.night,
                  boxShadow: clicked && !done ? "0 0 26px rgba(58,208,174,0.7)" : "none",
                  transform: `scale(${press})`,
                }}
              >
                {done ? "✓ Done" : clicked ? "Writing back…" : r.action}
              </div>
            </div>

            {/* The source tool, on the right: alert in, change written back */}
            <div
              style={{
                position: "absolute",
                left: RIGHT_X,
                top: y,
                width: RIGHT_W,
                height: CARD_H,
                boxSizing: "border-box",
                borderRadius: 18,
                background: "rgba(10,20,50,0.92)",
                border: `2px solid ${done ? C.tealBright : frame >= t.inbound && !done ? r.sev : "rgba(140,170,255,0.3)"}`,
                boxShadow: done ? `0 0 ${30 * (1 - doneP) + 10}px rgba(58,208,174,0.35)` : "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0 24px",
                opacity: tool,
              }}
            >
              <div>
                <div style={{ fontSize: 27, fontWeight: 700 }}>{r.tool}</div>
                <div style={{ fontFamily: MONO, fontSize: 17, color: C.dim }}>{r.kind.toUpperCase()}</div>
              </div>
              {done ? (
                <div style={{ textAlign: "right", opacity: doneP }}>
                  <div style={{ fontSize: 23, fontWeight: 700, color: C.tealBright }}>✓ {r.done}</div>
                  <div style={{ fontFamily: MONO, fontSize: 16, color: "#9fe6c4" }}>approved · risk {r.risk.toLowerCase()} · logged</div>
                </div>
              ) : frame >= t.inbound ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 18, color: r.sev }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: r.sev, opacity: frame % 16 < 8 ? 1 : 0.4 }} />
                  ALERT RAISED
                </div>
              ) : (
                <div style={{ fontFamily: MONO, fontSize: 18, color: C.dim }}>connected</div>
              )}
            </div>
          </React.Fragment>
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 40,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 26,
          letterSpacing: "0.08em",
          color: C.tealBright,
          opacity: interpolate(frame, [150, 166], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        5 ALERTS · 5 ACTIONS · 0 CONSOLE SWITCHES · EVERY CHANGE APPROVED AND AUDITED
      </div>
    </Stage>
  );
};
