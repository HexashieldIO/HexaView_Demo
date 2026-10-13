// Audio mastering for a finished render: two-pass EBU R128 loudness normalisation to the social
// standard (-14 LUFS integrated, -2 dBTP true-peak ceiling, leaving headroom for AAC), then AAC and a faststart MP4.
// The video stream is copied untouched.
//   node scripts-master.mjs <raw.mp4> <final.mp4>
import { spawnSync } from "node:child_process";
import fs from "node:fs";

const [IN, OUT] = process.argv.slice(2);
if (!IN || !OUT) throw new Error("usage: node scripts-master.mjs <raw.mp4> <final.mp4>");

const TARGET = { I: -14, TP: -2, LRA: 11 };
// Runs Remotion's bundled ffmpeg and returns its log (loudnorm writes its JSON report there).
const ffmpeg = (args) => {
  const r = spawnSync("npx", ["remotion", "ffmpeg", "-hide_banner", ...args], { shell: true, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(r.stderr || r.stdout);
  return (r.stderr || "") + (r.stdout || "");
};
const report = (log) => JSON.parse(log.slice(log.lastIndexOf("{"), log.lastIndexOf("}") + 1));
const measure = (file, filter) => report(ffmpeg(["-i", `"${file}"`, "-vn", "-af", `"${filter}"`, "-f", "null", "-"]));

const { I, TP, LRA } = TARGET;
const m = measure(IN, `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`);
const pass2 = `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true:print_format=json`;

const isVideo = IN.toLowerCase().endsWith(".mp4");
ffmpeg(["-y", "-i", `"${IN}"`, ...(isVideo ? ["-map", "0:v:0", "-map", "0:a:0", "-c:v", "copy"] : ["-vn"]), "-af", `"${pass2},aresample=48000"`, "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", ...(isVideo ? ["-movflags", "+faststart"] : []), `"${OUT}"`]);

const r = measure(OUT, `loudnorm=I=${I}:TP=${TP}:LRA=${LRA}:print_format=json`);
console.log(`${OUT}\n  before: ${m.input_i} LUFS, true peak ${m.input_tp} dBTP\n  after:  ${r.input_i} LUFS, true peak ${r.input_tp} dBTP`);
if (fs.statSync(OUT).size < 2e5) throw new Error("output looks empty");
