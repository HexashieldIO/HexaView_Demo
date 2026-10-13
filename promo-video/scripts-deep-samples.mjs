// Deeper British female options: the same line in each voice at lowered pitch, to choose by ear.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import fs from "node:fs";
import path from "node:path";

const LINE = "One platform. Every function. Full control. A live, explainable Resilience Index, built from all of your security tooling.";
const OPTIONS = [
  ["A-Sonia-natural", "en-GB-SoniaNeural", "+0%", "+0Hz"],
  ["B-Sonia-deeper", "en-GB-SoniaNeural", "+0%", "-12Hz"],
  ["C-Sonia-deepest", "en-GB-SoniaNeural", "-3%", "-22Hz"],
  ["D-Libby-deeper", "en-GB-LibbyNeural", "+6%", "-14Hz"],
  ["E-Libby-deepest", "en-GB-LibbyNeural", "+4%", "-24Hz"],
];
const outDir = "out/deeper-british-samples";
fs.mkdirSync(outDir, { recursive: true });
for (const [name, voice, rate, pitch] of OPTIONS) {
  const tts = new MsEdgeTTS();
  await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
  const { audioFilePath } = await tts.toFile(outDir, LINE, { rate, pitch });
  fs.renameSync(audioFilePath, path.join(outDir, `${name}.mp3`));
  console.log(name);
  tts.close();
}
