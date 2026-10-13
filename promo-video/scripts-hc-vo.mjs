// Voiceover for the TAFA × HexaShield Singapore healthcare film (src/hc/hc.json).
// Generates every line, then measures where the speech actually ends and stores it as `dur`.
//   node scripts-hc-vo.mjs [voice] [rate] [pitch] [folder] [durKey]
//   British (default): en-GB-SoniaNeural +6% -12Hz hc-vo dur
//   American:          en-US-AvaMultilingualNeural +4% +0Hz hc-vo-us durUs
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const VOICE = process.argv[2] ?? "en-GB-SoniaNeural";
const RATE = process.argv[3] ?? "+0%";
const PITCH = process.argv[4] ?? "-12Hz";
const FILE = "src/hc/hc.json";
const OUT = `public/audio/${process.argv[5] ?? "hc-vo"}`;
const KEY = process.argv[6] ?? "dur";
const HC = JSON.parse(fs.readFileSync(FILE, "utf8"));
fs.mkdirSync(OUT, { recursive: true });

const speechEnd = (file) => {
  execSync(`npx remotion ffmpeg -v error -y -i ${file} -ac 1 -ar 8000 -c:a pcm_s16le out/_speech.wav`);
  const b = fs.readFileSync("out/_speech.wav");
  let o = 12;
  while (b.toString("ascii", o, o + 4) !== "data") o += 8 + b.readUInt32LE(o + 4);
  const d = b.subarray(o + 8);
  const n = d.length / 2;
  let last = 0;
  for (let i = 0; i + 80 <= n; i += 80) {
    let s = 0;
    for (let k = 0; k < 80; k++) {
      const v = d.readInt16LE((i + k) * 2) / 32768;
      s += v * v;
    }
    if (Math.sqrt(s / 80) > 0.01) last = i + 80;
  }
  fs.rmSync("out/_speech.wav");
  return +(last / 8000 + 0.1).toFixed(2);
};

for (const line of HC.lines) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioFilePath } = await tts.toFile(OUT, line.text, { rate: line.rate ?? RATE, pitch: PITCH });
  const target = path.join(OUT, `${line.id}.mp3`);
  fs.renameSync(audioFilePath, target);
  tts.close();
  line[KEY] = speechEnd(target.replace(/\\/g, "/"));
}
fs.writeFileSync(FILE, JSON.stringify(HC, null, 2) + "\n");

// Report scene lengths: each scene grows only if its line needs more room.
let total = 0;
for (const sh of HC.shots) {
  const need = Math.max(0, ...HC.lines.filter((l) => l.scene === sh.id).map((l) => l.offset + l[KEY] + HC.tail));
  const len = Math.max(sh.s, need);
  total += Math.round(len * HC.fps);
  console.log(`${sh.id.padEnd(12)} ${len.toFixed(1).padStart(5)}s  ${HC.lines.filter((l) => l.scene === sh.id).map((l) => `${l.id} ${l[KEY]}s`).join(", ")}`);
}
console.log(`total ${(total / HC.fps).toFixed(1)}s`);
