import React from "react";
import { Sequence, Series, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { HexIris, PARTNERS, PartnerContext, SlowContext, loadBrandFonts } from "./theme";
import TIMELINE from "./timeline.json";
import { FPS, buildTimeline, type Voice } from "./timeline";
import { S0Intro } from "./scenes/S0Intro";
import { S1Noise } from "./scenes/S1Noise";
import { S2Islands } from "./scenes/S2Islands";
import { S3FirstCell } from "./scenes/S3FirstCell";
import { S3bSignIn } from "./scenes/S3bSignIn";
import { S4OnePane } from "./scenes/S4OnePane";
import { S5Integrations } from "./scenes/S5Integrations";
import { S6ClosedLoop } from "./scenes/S6ClosedLoop";
import { S6bWriteBack } from "./scenes/S6bWriteBack";
import { MaritimeComply, MaritimeOT, MaritimeSoc } from "./scenes/S6cMaritime";
import { S7Industries } from "./scenes/S7Industries";
import { S8EndCard } from "./scenes/S8EndCard";

// Concept A, "From Noise to Hive". Scene order and lengths live in timeline.json.
const SCENES: Record<string, { C: React.FC; iris: boolean }> = {
  intro: { C: S0Intro, iris: false },
  noise: { C: S1Noise, iris: true },
  islands: { C: S2Islands, iris: true },
  firstCell: { C: S3FirstCell, iris: false }, // hard cut from black
  signIn: { C: S3bSignIn, iris: true },
  onePane: { C: S4OnePane, iris: true },
  integrations: { C: S5Integrations, iris: true }, // the SaaS story: integrate the tooling clients already own
  closedLoop: { C: S6ClosedLoop, iris: true },
  writeBack: { C: S6bWriteBack, iris: true }, // bi-directional write-back
  maritimeOT: { C: MaritimeOT, iris: true }, // Cyber Dockside cut: ports and fleet
  maritimeComply: { C: MaritimeComply, iris: true },
  maritimeSoc: { C: MaritimeSoc, iris: true },
  global: { C: S7Industries, iris: true }, // any industry, global, IT and OT, real time
  endCard: { C: S8EndCard, iris: true },
};

export type PromoProps = {
  /** Which read: "ava" (master) or "gb" (British). Also picks the matching music bed. */
  voice: Voice;
  /** Play the voiceover. */
  voiceover: boolean;
  /** Music level while the voice speaks, and between lines. */
  musicUnderVoice: number;
  musicAlone: number;
  /** Key into PARTNERS for a co-branded cut, or "" for the HexaView master. */
  partner: string;
};

export const promoLength = (p: Pick<PromoProps, "voice" | "partner">) => buildTimeline(p.voice, p.partner || "master").total;

type Line = ReturnType<typeof buildTimeline>["lines"][number];
const voActive = (lines: Line[], t: number) => lines.some((l) => t > l.at - 0.15 && t < l.at + l.dur - 0.2);

export const Promo: React.FC<PromoProps> = ({ voice, voiceover, musicUnderVoice, musicAlone, partner }) => {
  loadBrandFonts();
  // Lines marked "only" belong to one version: the master, or a named partner cut.
  const { shots, slow, shotFrames, lines, music } = buildTimeline(voice, partner || "master");
  return (
    <SlowContext.Provider value={slow}>
    <PartnerContext.Provider value={PARTNERS[partner] ?? null}>
      <Series>
        {shots.map((shot, i) => {
          const { C, iris } = SCENES[shot.id];
          return (
          <Series.Sequence key={shot.id} durationInFrames={shotFrames[i]}>
            {iris ? (
              <HexIris>
                <C />
              </HexIris>
            ) : (
              <C />
            )}
          </Series.Sequence>
          );
        })}
      </Series>

      {music && (
        <Audio
          src={staticFile(music)}
          // Duck the music under each voiceover line.
          volume={(f) => (voiceover && voActive(lines, f / FPS) ? musicUnderVoice : musicAlone)}
        />
      )}
      {voiceover &&
        lines.map((l) => (
          <Sequence key={l.id} from={Math.round(l.at * FPS)} durationInFrames={Math.ceil(l.dur * FPS) + 8}>
            <Audio src={staticFile(l.src)} volume={0.85} />
          </Sequence>
        ))}
    </PartnerContext.Provider>
    </SlowContext.Provider>
  );
};
