import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame } from "remotion";
import { Promo, type PromoProps } from "./Promo";
import { Backdrop, C, DISPLAY, MONO, loadBrandFonts } from "./theme";
import { FPS, buildTimeline, captionChunks } from "./timeline";

// LinkedIn feed cut: 1:1, the 16:9 film in the middle, a brand header above and burned-in
// captions below, because most feed video autoplays muted.
const SIZE = 1080;
const SCALE = SIZE / 1920;
const FILM_H = 1080 * SCALE;
const BAND = (SIZE - FILM_H) / 2;

const Captions: React.FC<{ props: PromoProps }> = ({ props }) => {
  const frame = useCurrentFrame();
  const t = frame / FPS;
  const { lines } = buildTimeline(props.voice, props.partner || "master");
  const chunk = lines.flatMap(captionChunks).find((c) => t >= c.start && t < c.end + 0.15);
  return (
    <div style={{ position: "absolute", left: 60, right: 60, top: BAND + FILM_H, height: BAND, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {chunk && (
        <div style={{ fontFamily: DISPLAY, fontSize: 44, fontWeight: 600, lineHeight: 1.25, color: "#ffffff", textAlign: "center", textShadow: "0 2px 12px rgba(5,10,24,0.9)" }}>{chunk.text}</div>
      )}
    </div>
  );
};

export const LinkedInSquare: React.FC<PromoProps> = (props) => {
  loadBrandFonts();
  return (
    <AbsoluteFill style={{ background: C.night, overflow: "hidden" }}>
      <Backdrop />
      {/* Brand header */}
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: BAND, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
        <Img src={staticFile("brand/HexaView_logo_reverse.png")} style={{ height: 96, width: 96 * (1194 / 348) }} />
        <div style={{ fontFamily: MONO, fontSize: 22, letterSpacing: "0.2em", color: C.tealBright }}>ONE PLATFORM FOR ALL YOUR SECURITY TOOLING</div>
      </div>
      {/* The film, scaled into the middle band */}
      <div style={{ position: "absolute", left: 0, top: BAND, width: SIZE, height: FILM_H, overflow: "hidden", boxShadow: "0 0 60px rgba(0,0,0,0.5)" }}>
        <div style={{ width: 1920, height: 1080, transform: `scale(${SCALE})`, transformOrigin: "0 0", position: "relative" }}>
          <Promo {...props} />
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: BAND - 1, height: 2, background: "rgba(58,208,174,0.5)" }} />
      <div style={{ position: "absolute", left: 0, right: 0, top: BAND + FILM_H - 1, height: 2, background: "rgba(58,208,174,0.5)" }} />
      <Captions props={props} />
    </AbsoluteFill>
  );
};
