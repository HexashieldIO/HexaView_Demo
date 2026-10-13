import React from "react";
import { Img, interpolate, staticFile } from "remotion";
import { C, MONO, Stage, prog, rise, useSceneFrame } from "../theme";

// The real Command Centre screen (2000×1070).
const SHOT_W = 1440;
const SHOT_H = SHOT_W * (1070 / 2000);
const BAR = 44;
const FRAME_X = (1920 - SHOT_W) / 2;
const FRAME_Y = 190;

// The Resilience Index hexagon sits at about (902, 490) in the screenshot.
const FOCUS_X = 902 / 2000;
const FOCUS_Y = 490 / 1070;

const Callout: React.FC<{ x: number; y: number; at: number; frame: number; title: string; body: string; align?: "left" | "right" }> = ({ x, y, at, frame, title, body, align = "left" }) => {
  const p = prog(frame, at, at + 16);
  return (
    <div
      style={{
        position: "absolute",
        left: align === "left" ? x : undefined,
        right: align === "right" ? 1920 - x : undefined,
        top: y,
        width: 400,
        padding: "20px 24px",
        borderRadius: 18,
        background: "rgba(8,16,40,0.88)",
        border: `2px solid ${C.tealBright}`,
        boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 0 40px rgba(58,208,174,0.25)",
        opacity: p,
        transform: `translateY(${(1 - p) * 24}px)`,
        textAlign: align,
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 700, color: C.text }}>{title}</div>
      <div style={{ fontSize: 22, color: "#c8d4f0", marginTop: 6, lineHeight: 1.35 }}>{body}</div>
    </div>
  );
};

export const S4OnePane: React.FC = () => {
  const frame = useSceneFrame();
  const enter = prog(frame, 0, 34);
  const zoomIn = prog(frame, 56, 100);
  const zoomOut = prog(frame, 160, 190);
  const zoom = 1 + 0.7 * zoomIn * (1 - zoomOut);
  const ring = prog(frame, 92, 108) * (1 - zoomOut);
  const pulse = 1 + 0.06 * Math.sin((frame - 92) / 5) * ring;
  const ringR = 0.058 * SHOT_W * zoom * pulse;
  const fx = FOCUS_X * SHOT_W;
  const fy = BAR + FOCUS_Y * SHOT_H;
  const hexPts = [0, 60, 120, 180, 240, 300]
    .map((a) => `${fx + ringR * Math.cos(((a - 90) * Math.PI) / 180)},${fy + ringR * Math.sin(((a - 90) * Math.PI) / 180)}`)
    .join(" ");

  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 56, textAlign: "center", fontSize: 80, fontWeight: 700, letterSpacing: "-0.02em", ...rise(frame, 2) }}>
        One platform. Every function. Full control.
      </div>

      <div style={{ position: "absolute", inset: 0, perspective: 2400 }}>
        <div
          style={{
            position: "absolute",
            left: FRAME_X,
            top: FRAME_Y,
            width: SHOT_W,
            height: SHOT_H + BAR,
            borderRadius: 22,
            overflow: "hidden",
            background: "#070d1d",
            border: "2px solid rgba(140,170,255,0.35)",
            boxShadow: "0 80px 180px rgba(0,0,0,0.55), 0 0 120px rgba(58,208,174,0.18)",
            transformOrigin: "50% 100%",
            transform: `translateY(${(1 - enter) * 160}px) rotateX(${(1 - enter) * 22}deg) scale(${0.9 + enter * 0.1})`,
            opacity: enter,
          }}
        >
          <div style={{ height: BAR, display: "flex", alignItems: "center", gap: 10, padding: "0 18px", background: "#0b1328", borderBottom: "1px solid rgba(140,170,255,0.2)" }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((d) => (
              <div key={d} style={{ width: 13, height: 13, borderRadius: "50%", background: d }} />
            ))}
            <div style={{ marginLeft: 18, flex: 1, height: 26, borderRadius: 8, background: "rgba(255,255,255,0.06)", fontFamily: MONO, fontSize: 15, color: C.dim, display: "flex", alignItems: "center", paddingLeft: 14 }}>
              HexaView · Cyber Resilience Overview
            </div>
          </div>
          <div style={{ position: "relative", width: SHOT_W, height: SHOT_H, overflow: "hidden" }}>
            <Img
              src={staticFile("screens/command-centre.webp")}
              style={{
                width: SHOT_W,
                height: SHOT_H,
                transformOrigin: `${FOCUS_X * 100}% ${FOCUS_Y * 100}%`,
                transform: `scale(${zoom})`,
              }}
            />
          </div>
          <svg width={SHOT_W} height={SHOT_H + BAR} style={{ position: "absolute", left: 0, top: 0 }}>
            <polygon points={hexPts} fill="none" stroke={C.tealBright} strokeWidth={5} strokeLinejoin="round" opacity={ring} />
          </svg>
        </div>
      </div>

      <Callout x={70} y={790} at={104} frame={frame} title="One explainable score" body="A live Resilience Index across every tenant, weighted by criticality." />
      <Callout x={1850} y={260} at={124} frame={frame} title="Every capability, scored" body="SOC, intel, offensive, OT, compliance and custody, side by side." align="right" />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 30,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: 26,
          letterSpacing: "0.08em",
          color: C.tealBright,
          opacity: interpolate(frame, [166, 182], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      >
        READ FROM EVERY TOOL · WRITE BACK WITH APPROVAL
      </div>
    </Stage>
  );
};
