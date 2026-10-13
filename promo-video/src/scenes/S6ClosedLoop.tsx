import React from "react";
import { Img, interpolate, staticFile } from "remotion";
import { C, MONO, Stage, prog, rise, useSceneFrame } from "../theme";

const typed = (text: string, frame: number, start: number, cps = 1.6) => text.slice(0, Math.max(0, Math.floor((frame - start) * cps)));

// One incident, five modules, one console: a leaked password becomes a contained account.
const STEPS = [
  { time: "02:41:08", icon: "HexaInt_icon", module: "HexaInt", color: "#DF70A8", title: "Credential for sale", at: 14 },
  { time: "02:44:12", icon: "HexaSOC_icon", module: "HexaSOC", color: "#A580F8", title: "Same account, new country", at: 40 },
  { time: "02:44:31", icon: "HexaAI_icon", module: "HexaAI", color: "#9980FD", title: "Likely account takeover", at: 66 },
  { time: "02:45:02", icon: "HexaView_mark", module: "Action Centre", color: "#3AD0AE", title: "Contain, with approval", at: 94 },
  { time: "02:45:20", icon: "HexaComply_icon", module: "HexaComply", color: "#61C49A", title: "Evidence on file", at: 128 },
];

const CARD_W = 300;
const CLICK = 116;

export const S6ClosedLoop: React.FC = () => {
  const frame = useSceneFrame();
  const active = STEPS.filter((s) => frame >= s.at).length;
  const clock = active ? STEPS[active - 1].time : "02:41:00";
  const loop = prog(frame, 146, 172);
  const cur = prog(frame, 100, CLICK - 2);
  const clicked = frame >= CLICK;

  const body = (i: number): React.ReactNode => {
    const s = STEPS[i];
    switch (i) {
      case 0:
        return <div style={{ fontSize: 21, lineHeight: 1.4, color: "#c8d4f0" }}>Finance user’s password posted on a paste site.</div>;
      case 1:
        return <div style={{ fontSize: 21, lineHeight: 1.4, color: "#c8d4f0" }}>Sign-in from an unfamiliar country, three minutes later.</div>;
      case 2:
        return (
          <div style={{ fontSize: 21, lineHeight: 1.4, color: "#c8d4f0" }}>
            {typed("Credential reuse matches the leak. Recommend revoking sessions.", frame, s.at + 4)}
            {frame > s.at + 44 && <span style={{ color: "#b9b3ff" }}> [1] [2] [3]</span>}
          </div>
        );
      case 3:
        return (
          <div
            style={{
              marginTop: "auto",
              minHeight: 70,
              borderRadius: 14,
              background: clicked ? "rgba(58,208,174,0.16)" : C.tealBright,
              color: clicked ? "#b6f2e3" : C.night,
              fontSize: 22,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "0 12px",
              transform: `scale(${frame >= CLICK && frame < CLICK + 5 ? 0.95 : 1})`,
            }}
          >
            {clicked ? "Sessions revoked · reset sent ✓" : "Approve: revoke sessions & reset"}
          </div>
        );
      default:
        return (
          <div style={{ fontFamily: MONO, fontSize: 18, lineHeight: 1.6, color: "#9fe6c4" }}>
            {typed("ISO 27001 A.5.26 · incident response", frame, s.at + 2, 2.4)}
            <br />
            {frame > s.at + 14 && "audit ledger · hash chained ✓"}
          </div>
        );
    }
  };

  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
        <div style={{ fontSize: 84, fontWeight: 700, letterSpacing: "-0.02em", ...rise(frame, 2) }}>From leaked password to locked door.</div>
        <div style={{ fontSize: 40, color: "#c8d4f0", ...rise(frame, 12) }}>Contained at 02:45, before the 02:46 data theft could happen.</div>
      </div>

      <div style={{ position: "absolute", right: 120, top: 300, fontFamily: MONO, fontSize: 30, color: C.tealBright, display: "flex", alignItems: "center", gap: 14, ...rise(frame, 10) }}>
        <div style={{ width: 14, height: 14, borderRadius: "50%", background: C.threat, opacity: frame % 20 < 10 ? 1 : 0.35 }} />
        {clock} · LIVE
      </div>

      <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", justifyContent: "center", alignItems: "stretch", gap: 18 }}>
        {STEPS.map((s, i) => {
          const on = prog(frame, s.at, s.at + 10);
          return (
            <React.Fragment key={s.module}>
              {i > 0 && <div style={{ alignSelf: "center", fontSize: 44, color: on > 0.5 ? s.color : "rgba(140,170,255,0.35)" }}>→</div>}
              <div
                style={{
                  width: CARD_W,
                  height: 360,
                  boxSizing: "border-box",
                  padding: 24,
                  borderRadius: 24,
                  background: "rgba(10,20,50,0.9)",
                  border: `3px solid ${on > 0.5 ? s.color : "rgba(140,170,255,0.25)"}`,
                  boxShadow: on > 0.5 ? `0 0 60px ${s.color}44` : "0 20px 40px rgba(0,0,0,0.35)",
                  opacity: 0.4 + on * 0.6,
                  transform: `translateY(${(1 - on) * 16}px)`,
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Img src={staticFile(`brand/${s.icon}.svg`)} style={{ width: 50, height: 50 }} />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.module}</div>
                    <div style={{ fontFamily: MONO, fontSize: 18, color: C.dim }}>{s.time}</div>
                  </div>
                </div>
                <div style={{ fontSize: 29, fontWeight: 700, lineHeight: 1.15 }}>{s.title}</div>
                {body(i)}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      {/* Cursor travels to Approve and clicks. */}
      <svg
        width={46}
        height={46}
        viewBox="0 0 24 24"
        style={{
          position: "absolute",
          left: interpolate(cur, [0, 1], [1460, 1310]),
          top: interpolate(cur, [0, 1], [960, 686]),
          opacity: frame > 96 && frame < 136 ? 1 : 0,
        }}
      >
        <path d="M4 2l16 10-7 1.5L9.5 21z" fill={C.text} stroke={C.night} strokeWidth={1.5} strokeLinejoin="round" />
      </svg>

      <svg width={1920} height={240} style={{ position: "absolute", left: 0, top: 750 }}>
        <path
          d="M 1720 0 L 1720 110 Q 1720 180 1650 180 L 270 180 Q 200 180 200 110 L 200 0"
          fill="none"
          stroke={C.tealBright}
          strokeWidth={4}
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - loop}
        />
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 952, textAlign: "center", fontFamily: MONO, fontSize: 26, letterSpacing: "0.1em", color: C.tealBright, opacity: prog(frame, 160, 172) }}>
        CLOSED-LOOP ASSURANCE · DETECTED · EXPLAINED · CONTAINED · PROVEN
      </div>
    </Stage>
  );
};
