import React from "react";
import { Img, interpolate, staticFile } from "remotion";
import { C, EASE_IN, Hex, MONO, Stage, prog, useSceneFrame, PartnerLogo, usePartner } from "../theme";

// The logo PNG is 1194×348; its mark is centred at (176, 174) and ~303px tall.
const LOGO_W = 1100;
const K = LOGO_W / 1194;
const LOGO_H = 348 * K;
const LOGO_X = 960 - LOGO_W / 2;
const LOGO_Y = 470 - LOGO_H / 2;
const MARK_CX = LOGO_X + 176 * K;
const MARK_CY = LOGO_Y + 174 * K;
const MARK = 316 * K; // the mark's 120-unit viewBox at logo scale
const WORD_START = 0.27; // the wordmark begins 27% across the PNG

const HEX = "M60 8 L105 34 L105 86 L60 112 L15 86 L15 34 Z";
const ICON = ["M34 52 H86", "M48 52 V79", "M40 60 H43.5", "M40 66 H43.5", "M40 72 H43.5", "M58 73 V68", "M66 73 V63", "M74 73 V58"];

// Six cells fly in and fuse into the mark.
const SHARDS = [0, 60, 120, 180, 240, 300].map((a, i) => ({ a: (a * Math.PI) / 180, delay: i * 2 }));

export const S0Intro: React.FC = () => {
  const frame = useSceneFrame();
  const outline = prog(frame, 8, 34);
  const fill = prog(frame, 28, 44);
  const icon = prog(frame, 40, 62);
  const dot = prog(frame, 58, 64);
  const word = prog(frame, 56, 82);
  const swap = prog(frame, 84, 92); // hand over from the drawn mark to the real PNG
  const tag = prog(frame, 80, 100);
  const sweep = interpolate(frame, [92, 116], [-200, LOGO_W + 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const glow = prog(frame, 34, 50) * (1 - prog(frame, 50, 80));
  const partner = usePartner();

  return (
    <Stage>
      {SHARDS.map((s, i) => {
        const p = prog(frame, s.delay, 26 + s.delay, EASE_IN);
        if (p >= 1) return null;
        const r = interpolate(p, [0, 1], [760, 0]);
        return (
          <Hex
            key={i}
            x={MARK_CX + Math.cos(s.a) * r}
            y={MARK_CY + Math.sin(s.a) * r * 0.8}
            w={interpolate(p, [0, 1], [120, 40])}
            color={i % 2 ? C.tealDark : C.tealBright}
            style={{ opacity: 0.25 + p * 0.75 }}
          />
        );
      })}

      {/* Bloom behind the mark as it fills. */}
      <div
        style={{
          position: "absolute",
          left: MARK_CX - 300,
          top: MARK_CY - 300,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(58,208,174,0.45) 0%, rgba(58,208,174,0) 65%)",
          opacity: glow,
        }}
      />

      <svg
        viewBox="0 0 120 120"
        width={MARK}
        height={MARK}
        style={{ position: "absolute", left: MARK_CX - MARK / 2, top: MARK_CY - MARK / 2, opacity: 1 - swap, overflow: "visible" }}
      >
        <defs>
          <linearGradient id="introTeal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3AD0AE" />
            <stop offset="1" stopColor="#1E9E86" />
          </linearGradient>
        </defs>
        <path d={HEX} fill="url(#introTeal)" fillOpacity={fill} stroke="url(#introTeal)" strokeOpacity={fill} strokeWidth={11} strokeLinejoin="round" />
        <path d={HEX} fill="none" stroke="#7af0d2" strokeWidth={3} strokeLinejoin="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - outline} opacity={outline > 0 ? 1 - fill : 0} />
        <g fill="none" stroke="#ffffff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" opacity={icon > 0 ? 1 : 0}>
          <rect x={34} y={41} width={52} height={38} rx={6} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - icon} />
          {ICON.map((d, i) => (
            <path key={d} d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - prog(frame, 46 + i * 2, 58 + i * 2)} />
          ))}
        </g>
        <circle cx={80} cy={47} r={1.9} fill="#ffffff" opacity={dot} />
      </svg>

      <div style={{ position: "absolute", left: LOGO_X, top: LOGO_Y, width: LOGO_W, height: LOGO_H, overflow: "hidden" }}>
        <Img
          src={staticFile("brand/HexaView_logo_reverse.png")}
          style={{
            width: LOGO_W,
            height: LOGO_H,
            // Wordmark wipes in from behind the mark; the PNG's own mark appears at the hand-over.
            clipPath: swap > 0 ? "none" : `inset(0 ${(1 - word) * (1 - WORD_START) * 100}% 0 ${WORD_START * 100}%)`,
            transform: `translateX(${(1 - word) * -40}px)`,
            opacity: swap > 0 ? 1 : word,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            bottom: 0,
            left: sweep,
            width: 160,
            background: "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,0.35), rgba(255,255,255,0))",
            transform: "skewX(-20deg)",
            mixBlendMode: "overlay",
          }}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 700,
          textAlign: "center",
          fontFamily: MONO,
          fontWeight: 600,
          fontSize: 34,
          letterSpacing: `${interpolate(tag, [0, 1], [0.08, 0.2])}em`,
          color: C.tealBright,
          opacity: tag,
        }}
      >
        THE TRUST CONSOLE. VISIBILITY YOU CAN ACT ON.
      </div>

      {partner && <PartnerLogo partner={partner} top={790} height={84} show={prog(frame, 88, 104)} label="IN PARTNERSHIP WITH" />}
    </Stage>
  );
};
