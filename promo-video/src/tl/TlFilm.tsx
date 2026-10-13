import React from "react";
import { Sequence, Series, staticFile } from "remotion";
import { Audio } from "@remotion/media";
import { HexIris, loadBrandFonts } from "../theme";
import TLJ from "./tl.json";
import { TlClients, TlClientView, TlConsole, TlDeals, TlEndCard, TlIntro, TlModel, TlOnboarding, TlProblem, TlProvisioning, TlShift, TlSoc, TlWhiteLabel } from "./scenes";

// TeamLogic IT × HexaShield: MSP to MSSP through the HexaView Partner Console.
const SCENES: Record<string, React.FC> = {
  intro: TlIntro,
  shift: TlShift,
  problem: TlProblem,
  model: TlModel,
  console: TlConsole,
  clients: TlClients,
  provisioning: TlProvisioning,
  whitelabel: TlWhiteLabel,
  clientView: TlClientView,
  soc: TlSoc,
  deals: TlDeals,
  onboarding: TlOnboarding,
  endCard: TlEndCard,
};

type Line = (typeof TLJ.lines)[number] & { dur: number };

export const tlTimeline = () => {
  const lines = TLJ.lines as Line[];
  const frames = TLJ.shots.map((s) => {
    const need = Math.max(0, ...lines.filter((l) => l.scene === s.id).map((l) => l.offset + l.dur + TLJ.tail));
    return Math.round(Math.max(s.s, need) * TLJ.fps);
  });
  const start = frames.map((_, i) => frames.slice(0, i).reduce((a, b) => a + b, 0));
  const startOf = (id: string) => start[TLJ.shots.findIndex((s) => s.id === id)] / TLJ.fps;
  return { frames, total: frames.reduce((a, b) => a + b, 0), lines: lines.map((l) => ({ ...l, at: startOf(l.scene) + l.offset, src: `audio/tl-vo/${l.id}.mp3` })) };
};

export type TlProps = { music: string; musicUnderVoice: number; musicAlone: number };

export const TlFilm: React.FC<TlProps> = ({ music, musicUnderVoice, musicAlone }) => {
  loadBrandFonts();
  const { frames, lines } = tlTimeline();
  const speaking = (t: number) => lines.some((l) => t > l.at - 0.15 && t < l.at + l.dur - 0.2);
  return (
    <>
      <Series>
        {TLJ.shots.map((shot, i) => {
          const C = SCENES[shot.id];
          return (
            <Series.Sequence key={shot.id} durationInFrames={frames[i]}>
              {i === 0 ? <C /> : <HexIris><C /></HexIris>}
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
