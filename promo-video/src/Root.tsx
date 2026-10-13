import React from "react";
import { Composition } from "remotion";
import { Promo, promoLength, type PromoProps } from "./Promo";
import { LinkedInSquare } from "./LinkedInSquare";
import { HcFilm, hcLength } from "./hc/HcFilm";
import { TlFilm, tlTimeline } from "./tl/TlFilm";
import { HsFilm, hsTimeline } from "./hs/HsFilm";
import { FPS } from "./timeline";

const base: PromoProps = { voice: "ava", voiceover: true, musicUnderVoice: 0.32, musicAlone: 0.7, partner: "" };

// Each cut sizes itself from its own voiceover, so a longer read never gets clipped.
const CUTS: { id: string; props: PromoProps }[] = [
  { id: "HexaViewPromo", props: base }, // HexaView.io master
  { id: "HexaViewCyberDockside", props: { ...base, partner: "cyberdockside" } },
  { id: "HexaViewPromoBritish", props: { ...base, voice: "gb" } },
  { id: "HexaViewCyberDocksideBritish", props: { ...base, voice: "gb", partner: "cyberdockside" } },
];

export const RemotionRoot: React.FC = () => (
  <>
    {CUTS.map((c) => (
      <Composition key={c.id} id={c.id} component={Promo} durationInFrames={promoLength(c.props)} fps={FPS} width={1920} height={1080} defaultProps={c.props} />
    ))}
    {/* LinkedIn feed: square, captions burned in, master (Ava, American) voice. */}
    <Composition id="HexaViewLinkedInSquare" component={LinkedInSquare} durationInFrames={promoLength(base)} fps={FPS} width={1080} height={1080} defaultProps={base} />
    {/* TAFA × HexaShield: Health Information Act film for Singapore healthcare. */}
    <Composition id="HexaViewTafaHealthcare" component={HcFilm} durationInFrames={hcLength("gb")} fps={FPS} width={1920} height={1080} defaultProps={{ voice: "gb" as const, music: "audio/music-hc.wav", musicUnderVoice: 0.32, musicAlone: 0.7 }} />
    <Composition id="HexaViewTafaHealthcareUS" component={HcFilm} durationInFrames={hcLength("us")} fps={FPS} width={1920} height={1080} defaultProps={{ voice: "us" as const, music: "audio/music-hc-us.wav", musicUnderVoice: 0.32, musicAlone: 0.7 }} />
    {/* TeamLogic IT × HexaShield: MSP to MSSP through the Partner Console. */}
    <Composition id="HexaViewTeamLogicIT" component={TlFilm} durationInFrames={tlTimeline().total} fps={FPS} width={1920} height={1080} defaultProps={{ music: "audio/music-tl.wav", musicUnderVoice: 0.32, musicAlone: 0.7 }} />
    {/* HexaStrike AI penetration testing: a HexaShield production. Subtle music under the voice. */}
    <Composition id="HexaStrikeAIPentest" component={HsFilm} durationInFrames={hsTimeline().total} fps={FPS} width={1920} height={1080} defaultProps={{ music: "audio/music-hs.wav", musicUnderVoice: 0.2, musicAlone: 0.45 }} />
  </>
);
