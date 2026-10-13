import TIMELINE from "./timeline.json";
import VO from "./vo-lines.json";

// One timeline drives the picture, the voiceover and (via scripts-music.mjs) the music.
export const SLOW = TIMELINE.slow;
export const FPS = TIMELINE.fps;

/** Voice tracks: the master read and the British read, each in its own folder. */
export const VOICES = {
  ava: { dir: "audio/vo", durKey: "dur" },
  gb: { dir: "audio/vo-gb", durKey: "durGb" },
} as const;
export type Voice = keyof typeof VOICES;

type Shot = { id: string; s: number; hold: number; tail?: number; only?: string };
type Line = (typeof VO)[number] & { only?: string; durGb?: number };

/** A cut can run slower than the master (timeline.json "slowBy"), and has its own scenes ("only"). */
export const slowFor = (version: string) => ((TIMELINE as { slowBy?: Record<string, number> }).slowBy ?? {})[version] ?? SLOW;

/** Scene lengths for one voice and version: authored time stretched by the cut's pace, plus a reading hold that grows if a line needs it. */
export const buildTimeline = (voice: Voice, version: string) => {
  const v = VOICES[voice];
  const slow = slowFor(version);
  const shots = (TIMELINE.shots as Shot[]).filter((s) => !s.only || s.only === version);
  const lines = (VO as Line[]).filter((l) => (!l.only || l.only === version) && shots.some((s) => s.id === l.scene));
  const lineDur = (l: Line) => (l as Record<string, unknown>)[v.durKey] as number;
  const shotFrames = shots.map((s) => {
    const need = Math.max(0, ...lines.filter((l) => l.scene === s.id).map((l) => l.offset + lineDur(l) + (s.tail ?? TIMELINE.tail)));
    const hold = Math.max(s.hold, need - s.s * slow);
    return Math.round((s.s * slow + hold) * FPS);
  });
  const shotStart = shotFrames.map((_, i) => shotFrames.slice(0, i).reduce((a, b) => a + b, 0));
  const total = shotFrames.reduce((a, b) => a + b, 0);
  const startOf = (id: string) => shotStart[shots.findIndex((s) => s.id === id)] / FPS;
  return {
    shots,
    slow,
    shotFrames,
    total,
    // Built by: node scripts-music.mjs <voice> <version>
    music: `audio/music-${voice}-${version}.wav`,
    lines: lines.map((l) => ({ id: l.id, text: l.text, at: startOf(l.scene) + l.offset, dur: lineDur(l), src: `${v.dir}/${l.id}.mp3` })),
  };
};

/** Splits a spoken line into short caption cards, timed in proportion to their length. */
export const captionChunks = (line: { text: string; at: number; dur: number }) => {
  const sentences = line.text.split(/(?<=[.!?:])\s+/);
  const chunks: string[] = [];
  for (const s of sentences) {
    const words = s.split(/\s+/);
    const parts = Math.ceil(words.length / 8);
    const per = Math.ceil(words.length / parts);
    for (let i = 0; i < words.length; i += per) chunks.push(words.slice(i, i + per).join(" "));
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  let t0 = line.at;
  return chunks.map((c) => {
    const d = (c.length / total) * line.dur;
    const out = { text: c, start: t0, end: t0 + d };
    t0 += d;
    return out;
  });
};
