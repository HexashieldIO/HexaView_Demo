// Measures how long each voiceover line actually speaks (ignoring trailing silence) in each voice.
// Scene lengths are then worked out per voice in src/timeline.ts: each scene keeps its reading
// pause and grows only if its line needs more room.
import fs from "node:fs";
import { execSync } from "node:child_process";

const VOICES = { dur: "vo", durGb: "vo-gb" };

const speechEnd = (file) => {
  execSync(`npx remotion ffmpeg -v error -y -i ${file} -ac 1 -ar 8000 -c:a pcm_s16le out/_speech.wav`);
  const b = fs.readFileSync("out/_speech.wav");
  let o = 12;
  while (b.toString("ascii", o, o + 4) !== "data") o += 8 + b.readUInt32LE(o + 4);
  const d = b.subarray(o + 8);
  const n = d.length / 2;
  const win = 80;
  let last = 0;
  for (let i = 0; i + win <= n; i += win) {
    let s = 0;
    for (let k = 0; k < win; k++) {
      const v = d.readInt16LE((i + k) * 2) / 32768;
      s += v * v;
    }
    if (Math.sqrt(s / win) > 0.01) last = i + win;
  }
  fs.rmSync("out/_speech.wav");
  return +(last / 8000 + 0.1).toFixed(2);
};

const L = JSON.parse(fs.readFileSync("src/vo-lines.json", "utf8"));
for (const l of L) {
  for (const [key, dir] of Object.entries(VOICES)) {
    const f = `public/audio/${dir}/${l.id}.mp3`;
    if (fs.existsSync(f)) l[key] = speechEnd(f);
  }
}
fs.writeFileSync("src/vo-lines.json", JSON.stringify(L, null, 2) + "\n");
console.log(L.map((l) => `${l.id} ${l.dur}s / ${l.durGb}s`).join(" | "));
