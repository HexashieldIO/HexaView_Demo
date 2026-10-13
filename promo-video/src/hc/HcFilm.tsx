import React from "react";
import { Sequence, Series, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { HexIris, loadBrandFonts } from "../theme";
import { FPS, hcTimeline, type HcVoice } from "./common";
import HC from "./hc.json";
import { HcDates, HcFunding, HcIntro, HcObligation, HcRecords, HcTwoHours } from "./scenesA";
import { HcDevices, HcEndCard, HcGuided, HcHexaView, HcJourney, HcPartnership } from "./scenesB";

// TAFA × HexaShield: the Health Information Act film for Singapore healthcare.
const SCENES: Record<string, React.FC> = {
  intro: HcIntro,
  records: HcRecords,
  dates: HcDates,
  obligation: HcObligation,
  twoHours: HcTwoHours,
  funding: HcFunding,
  guided: HcGuided,
  partnership: HcPartnership,
  hexaview: HcHexaView,
  devices: HcDevices,
  journey: HcJourney,
  endCard: HcEndCard,
};

export type HcProps = { voice: HcVoice; music: string; musicUnderVoice: number; musicAlone: number };
export const hcLength = (voice: HcVoice) => hcTimeline(voice).total;

export const HcFilm: React.FC<HcProps> = ({ voice, music, musicUnderVoice, musicAlone }) => {
  loadBrandFonts();
  const { frames, lines } = hcTimeline(voice);
  const speaking = (t: number) => lines.some((l) => t > l.at - 0.15 && t < l.at + l.dur - 0.2);
  return (
    <>
      <Series>
        {HC.shots.map((shot, i) => {
          const C = SCENES[shot.id];
          return (
            <Series.Sequence key={shot.id} durationInFrames={frames[i]}>
              {i === 0 ? (
                <C />
              ) : (
                <HexIris>
                  <C />
                </HexIris>
              )}
            </Series.Sequence>
          );
        })}
      </Series>
      {music && <Audio src={staticFile(music)} volume={(f) => (speaking(f / FPS) ? musicUnderVoice : musicAlone)} />}
      {lines.map((l) => (
        <Sequence key={l.id} from={Math.round(l.at * FPS)} durationInFrames={Math.ceil(l.dur * FPS) + 8}>
          <Audio src={staticFile(l.src)} volume={0.85} />
        </Sequence>
      ))}
    </>
  );
};
