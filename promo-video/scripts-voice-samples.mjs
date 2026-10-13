// Renders one script line in several voices so the narrator can be chosen by ear.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "node:fs";
import path from "node:path";

const LINE = "Integrated, not assembled. Plug in the security tooling you already own, across cloud, on-prem and OT. One source of truth, in real time.";
const VOICES = ["en-US-AvaMultilingualNeural", "en-US-EmmaMultilingualNeural", "en-GB-LibbyNeural", "en-IE-EmilyNeural", "en-AU-NatashaNeural", "en-GB-SoniaNeural"];
const outDir = "out/voice-samples";
fs.mkdirSync(outDir, { recursive: true });
for (const [i, v] of VOICES.entries()) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(v, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioFilePath } = await tts.toFile(outDir, LINE);
  const target = path.join(outDir, `${i + 1}-${v.replace("Neural", "")}.mp3`);
  fs.renameSync(audioFilePath, target);
  console.log(target);
  tts.close();
}
