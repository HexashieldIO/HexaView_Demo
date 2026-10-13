// Writes LinkedIn-ready .srt captions for a cut, using the same timing and caption cards as the video.
//   node scripts-srt.mjs [ava|gb] [master|cyberdockside] [outfile]
import fs from "node:fs";

const VOICE = process.argv[2] ?? "ava";
const VERSION = process.argv[3] ?? "master";
const OUT = process.argv[4] ?? `out/HexaView_${VOICE}_${VERSION}.srt`;
const DUR_KEY = { ava: "dur", gb: "durGb" }[VOICE];
const TL = JSON.parse(fs.readFileSync("src/timeline.json", "utf8"));
const SLOW_V = (TL.slowBy ?? {})[process.argv[3] ?? "master"] ?? TL.slow;
const VO = JSON.parse(fs.readFileSync("src/vo-lines.json", "utf8")).filter((l) => !l.only || l.only === VERSION);

const start = {};
let f = 0;
for (const sh of TL.shots.filter((s) => !s.only || s.only === VERSION)) {
  start[sh.id] = f / TL.fps;
  const need = Math.max(0, ...VO.filter((l) => l.scene === sh.id).map((l) => l.offset + l[DUR_KEY] + (sh.tail ?? TL.tail)));
  f += Math.round((sh.s * SLOW_V + Math.max(sh.hold, need - sh.s * SLOW_V)) * TL.fps);
}

// Same chunking as captionChunks() in src/timeline.ts.
const chunks = (text, at, dur) => {
  const out = [];
  for (const s of text.split(/(?<=[.!?:])\s+/)) {
    const words = s.split(/\s+/);
    const per = Math.ceil(words.length / Math.ceil(words.length / 8));
    for (let i = 0; i < words.length; i += per) out.push(words.slice(i, i + per).join(" "));
  }
  const total = out.reduce((n, c) => n + c.length, 0);
  let t = at;
  return out.map((c) => {
    const d = (c.length / total) * dur;
    const r = { text: c, start: t, end: t + d };
    t += d;
    return r;
  });
};
const ts = (s) => {
  const ms = Math.round(s * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const cards = VO.flatMap((l) => chunks(l.text, start[l.scene] + l.offset, l[DUR_KEY]));
// Hold each card a beat longer, but never past the next one.
const endOf = (c, i) => Math.min(c.end + 0.15, cards[i + 1] ? cards[i + 1].start - 0.01 : c.end + 0.15);
fs.writeFileSync(OUT, cards.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(endOf(c, i))}\n${c.text}\n`).join("\n"));
console.log(OUT, cards.length, "captions");
