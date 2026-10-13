// Generates the voiceover lines with a Microsoft neural voice (scratch-quality VO).
// Usage: node scripts-vo.mjs [voice] [folder] [rate] [pitch]
//   node scripts-vo.mjs                                  → Ava, public/audio/vo (master voice)
//   node scripts-vo.mjs en-GB-SoniaNeural vo-gb +0% -12Hz → British (deeper Sonia), public/audio/vo-gb
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "node:fs";
import path from "node:path";

const VOICE = process.argv[2] ?? "en-US-AvaMultilingualNeural";
const LINES = JSON.parse(fs.readFileSync("src/vo-lines.json", "utf8"));
const outDir = `public/audio/${process.argv[3] ?? "vo"}`;
fs.mkdirSync(outDir, { recursive: true });

for (const line of LINES) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(VOICE, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioFilePath } = await tts.toFile(outDir, line.text, { rate: line.rate ?? process.argv[4] ?? "+4%", ...(process.argv[5] ? { pitch: process.argv[5] } : {}) });
  const target = path.join(outDir, `${line.id}.mp3`);
  fs.renameSync(audioFilePath, target);
  console.log(target);
  tts.close();
}
