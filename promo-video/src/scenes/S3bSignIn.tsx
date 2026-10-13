import React from "react";
import { Img, interpolate, staticFile } from "remotion";
import { C, MONO, Stage, prog, rise, useSceneFrame } from "../theme";

// The real sign-in screen (2000×1093). Overlay positions below are in its pixels.
const IMG_W = 2000;
const IMG_H = 1093;
const SHOT_W = 1500;
const K = SHOT_W / IMG_W;
const SHOT_H = IMG_H * K;
const BAR = 40;
const FRAME_X = (1920 - SHOT_W) / 2;
const FRAME_Y = 150;

const TENANTS = [
  { name: "Starfall Entertainment", sector: "Media & Entertainment", color: "#c03fd8" },
  { name: "Halcyon Ports & Shipping", sector: "Maritime", color: "#1c98c5" },
  { name: "Aldersgate Financial Group", sector: "Financial Services", color: "#3482d6" },
  { name: "Mercy Ridge Health", sector: "Healthcare", color: "#2d966a" },
  { name: "Vireo Motor Group", sector: "Automotive", color: "#c03c41" },
  { name: "Sentry Peak Defense Systems", sector: "Defence", color: "#c57434" },
];

const BUTTONS = [
  { x: 1322, y: 562, w: 576, h: 74, at: 110 }, // Okta
  { x: 1322, y: 652, w: 576, h: 74, at: 116 }, // Microsoft Entra ID
  { x: 1322, y: 782, w: 576, h: 64, at: 122 }, // Passkey
];

const CHECKS = ["Passkey verified (FIDO2, device-bound)", "Checking device and session policy", "Applying your role and licence", "Computing your Resilience Index"];

const px = (n: number) => n * K;

const Callout: React.FC<{ top: number; show: number; title: string; body: string }> = ({ top, show, title, body }) => (
  <div
    style={{
      position: "absolute",
      left: 70,
      top,
      width: 470,
      padding: "22px 26px",
      borderRadius: 18,
      background: "rgba(8,16,40,0.9)",
      border: `2px solid ${C.tealBright}`,
      boxShadow: "0 20px 60px rgba(0,0,0,0.45), 0 0 40px rgba(58,208,174,0.25)",
      opacity: show,
      transform: `translateY(${(1 - show) * 24}px)`,
    }}
  >
    <div style={{ fontSize: 32, fontWeight: 700 }}>{title}</div>
    <div style={{ fontSize: 23, color: "#c8d4f0", marginTop: 8, lineHeight: 1.35 }}>{body}</div>
  </div>
);

// The beats were authored over 165 frames; the scene now plays them in 99 (about 3.9s on screen).
const SPEED = 165 / 99;

export const S3bSignIn: React.FC = () => {
  const frame = useSceneFrame() * SPEED;
  const enter = prog(frame, 0, 26);

  // Camera: whole page → the sign-in card → the organisation picker → the identity options.
  const KF = [0, 22, 50, 64, 100, 116, 165];
  const ip = (vals: number[]) => interpolate(frame, KF, vals, { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const z = ip([1, 1, 1.15, 1.7, 1.7, 1.7, 1.75]);
  const fx = ip([1000, 1000, 1610, 1610, 1610, 1610, 1610]);
  const fy = ip([546.5, 546.5, 533, 430, 430, 700, 705]);
  const sx = ip([SHOT_W / 2, SHOT_W / 2, SHOT_W * 0.64, SHOT_W * 0.64, SHOT_W * 0.64, SHOT_W * 0.64, SHOT_W * 0.64]);
  const sy = SHOT_H / 2;
  const tx = sx - px(fx) * z;
  const ty = sy - px(fy) * z;

  const open = prog(frame, 48, 58) * (1 - prog(frame, 100, 106));
  const hop = frame < 58 ? 0 : frame > 96 ? 0 : Math.floor((frame - 58) / 7) % TENANTS.length;
  const calloutA = prog(frame, 56, 70) * (1 - prog(frame, 100, 108));
  const calloutB = prog(frame, 110, 124);
  const checks = prog(frame, 122, 132);

  return (
    <Stage>
      <div style={{ position: "absolute", left: 0, right: 0, top: 40, textAlign: "center", fontSize: 76, fontWeight: 700, letterSpacing: "-0.02em", ...rise(frame, 2) }}>
        Multi-tenant. Secure by design.
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
            <div style={{ marginLeft: 18, flex: 1, height: 24, borderRadius: 8, background: "rgba(255,255,255,0.06)", fontFamily: MONO, fontSize: 15, color: C.dim, display: "flex", alignItems: "center", paddingLeft: 14 }}>
              hexaview · Sign in
            </div>
          </div>

          <div style={{ position: "relative", width: SHOT_W, height: SHOT_H, overflow: "hidden" }}>
            <div style={{ position: "absolute", left: 0, top: 0, width: SHOT_W, height: SHOT_H, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${z})` }}>
              <Img src={staticFile("screens/sign-in.webp")} style={{ width: SHOT_W, height: SHOT_H }} />

              {/* Organisation picker: every tenant, one sign-in. */}
              <div
                style={{
                  position: "absolute",
                  left: px(1322),
                  top: px(324),
                  width: px(576),
                  padding: px(8),
                  borderRadius: px(16),
                  background: "#0d1630",
                  border: "1px solid rgba(140,170,255,0.4)",
                  boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
                  transformOrigin: "50% 0",
                  transform: `scaleY(${open})`,
                  opacity: open,
                  display: "flex",
                  flexDirection: "column",
                  gap: px(4),
                }}
              >
                {TENANTS.map((t, i) => (
                  <div
                    key={t.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: px(14),
                      padding: `${px(10)}px ${px(14)}px`,
                      borderRadius: px(10),
                      background: i === hop ? "rgba(58,208,174,0.18)" : "transparent",
                      border: `1px solid ${i === hop ? C.tealBright : "transparent"}`,
                    }}
                  >
                    <div style={{ width: px(40), height: px(40), borderRadius: px(10), background: t.color, color: "#fff", fontWeight: 700, fontSize: px(17), display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {t.name
                        .split(" ")
                        .slice(0, 2)
                        .map((w) => w[0])
                        .join("")}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <div style={{ fontSize: px(21), fontWeight: 700, color: "#eaf0fb" }}>{t.name}</div>
                      <div style={{ fontSize: px(16), color: "#9fb0d0" }}>{t.sector}</div>
                    </div>
                  </div>
                ))}
              </div>

              {BUTTONS.map((b) => {
                const p = prog(frame, b.at, b.at + 8);
                return (
                  <div
                    key={b.y}
                    style={{
                      position: "absolute",
                      left: px(b.x - 6),
                      top: px(b.y - 6),
                      width: px(b.w + 12),
                      height: px(b.h + 12),
                      borderRadius: px(18),
                      border: `${px(4)}px solid ${C.tealBright}`,
                      boxShadow: `0 0 ${px(30)}px rgba(58,208,174,0.6)`,
                      opacity: p,
                      transform: `scale(${1.04 - p * 0.04})`,
                      boxSizing: "border-box",
                    }}
                  />
                );
              })}
            </div>
            {/* Fade the cropped page copy so the callouts read cleanly. */}
            <div
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: SHOT_W * 0.5,
                height: SHOT_H,
                background: "linear-gradient(90deg, rgba(5,10,24,0.92) 0%, rgba(5,10,24,0.75) 60%, rgba(5,10,24,0) 100%)",
                opacity: prog(frame, 40, 60),
              }}
            />
          </div>
        </div>
      </div>

      <Callout top={260} show={calloutA} title="Every tenant, isolated" body="Each organisation, business unit and tenant gets its own scope, roles and data plane." />
      <Callout top={260} show={calloutB} title="Sign in your way" body="Your own identity provider or a passkey, with conditional access built in." />

      <div
        style={{
          position: "absolute",
          left: 70,
          top: 520,
          width: 470,
          padding: "20px 24px",
          borderRadius: 18,
          background: "rgba(8,16,40,0.9)",
          border: "1px solid rgba(140,170,255,0.35)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          opacity: checks,
          transform: `translateY(${(1 - checks) * 24}px)`,
        }}
      >
        {CHECKS.map((c, i) => {
          const done = frame >= 128 + i * 8;
          return (
            <div key={c} style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22, color: done ? C.text : C.dim }}>
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  flexShrink: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: done ? C.teal : "transparent",
                  border: done ? "none" : `3px solid rgba(140,170,255,0.4)`,
                  borderTopColor: done ? undefined : C.tealBright,
                  transform: done ? "none" : `rotate(${frame * 18}deg)`,
                  color: C.night,
                  fontWeight: 700,
                  fontSize: 18,
                  boxSizing: "border-box",
                }}
              >
                {done ? "✓" : ""}
              </div>
              {c}
            </div>
          );
        })}
      </div>
    </Stage>
  );
};
