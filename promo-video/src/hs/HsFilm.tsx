import React from "react";
import { Sequence, Series, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { HexIris, loadBrandFonts } from "../theme";
import TLJ from "./hs.json";
import { HsAuthorise, HsGuardrails, HsNoWayIn, HsRetest, HsEndCard, HsExposure, HsIntro, HsLive, HsPrice, HsRemediate, HsReport, HsRewind, HsScope, HsStudio, HsVisualise } from "./scenes";

// HexaStrike AI penetration testing: a HexaShield production.
const SCENES: Record<string, React.FC> = {
  studio: HsStudio,
  exposure: HsExposure,
  rewind: HsRewind,
  intro: HsIntro,
  visualise: HsVisualise,
  remediate: HsRemediate,
  guardrails: HsGuardrails,
  scope: HsScope,
  price: HsPrice,
  authorise: HsAuthorise,
  live: HsLive,
  report: HsReport,
  retest: HsRetest,
  noWayIn: HsNoWayIn,
  endCard: HsEndCard,
};
// Hard cuts where the story turns; hex iris everywhere else.
const HARD_CUT = new Set(["studio", "exposure", "rewind", "intro"]);

type Line = (typeof TLJ.lines)[number] & { dur: number };

export const hsTimeline = () => {
  const lines = TLJ.lines as Line[];
  const frames = TLJ.shots.map((s) => {
    const need = Math.max(0, ...lines.filter((l) => l.scene === s.id).map((l) => l.offset + l.dur + TLJ.tail));
    return Math.round(Math.max(s.s, need) * TLJ.fps);
  });
  const start = frames.map((_, i) => frames.slice(0, i).reduce((a, b) => a + b, 0));
  const startOf = (id: string) => start[TLJ.shots.findIndex((s) => s.id === id)] / TLJ.fps;
  return { frames, total: frames.reduce((a, b) => a + b, 0), lines: lines.map((l) => ({ ...l, at: startOf(l.scene) + l.offset, src: `audio/hs-vo/${l.id}.mp3` })) };
};

export type HsProps = { music: string; musicUnderVoice: number; musicAlone: number };

export const HsFilm: React.FC<HsProps> = ({ music, musicUnderVoice, musicAlone }) => {
  loadBrandFonts();
  const { frames, lines } = hsTimeline();
  const speaking = (t: number) => lines.some((l) => t > l.at - 0.15 && t < l.at + l.dur - 0.2);
  return (
    <>
      <Series>
        {TLJ.shots.map((shot, i) => {
          const C = SCENES[shot.id];
          return (
            <Series.Sequence key={shot.id} durationInFrames={frames[i]}>
              {HARD_CUT.has(shot.id) ? <C /> : <HexIris><C /></HexIris>}
            </Series.Sequence>
          );
        })}
      </Series>
      {music && <Audio src={staticFile(music)} volume={(f) => (speaking(f / TLJ.fps) ? musicUnderVoice : musicAlone)} />}
      {lines.map((l) => (
        <Sequence key={l.id} from={Math.round(l.at * TLJ.fps)} durationInFrames={Math.ceil(l.dur * TLJ.fps) + 8}>
          <Audio src={staticFile(l.src)} volume={0.85} />
        </Sequence>
      ))}
    </>
  );
};
