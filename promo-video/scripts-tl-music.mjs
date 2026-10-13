// Generates a temporary music bed timed to the edit (public/audio/music.wav).
// It is a stand-in for a licensed track: same structure, so a real track can drop in later.
import fs from "node:fs";

const SR = 44100;
// Cues follow src/hc/hc.json: gentle tension through the problem, a lift at the funding
// "good news", a groove through the solution and a resolved chord on the co-branded end card.
const HC = JSON.parse(fs.readFileSync("src/tl/tl.json", "utf8"));
const HC_VOICE = process.argv[2] ?? "gb"; // node scripts-hc-music.mjs [gb|us]
const HC_KEY = "dur";
const PACE = 1;
const at = (t) => t * PACE;
const START = {};
{
  let f = 0;
  for (const sh of HC.shots) {
    START[sh.id] = f / HC.fps;
    const need = Math.max(0, ...HC.lines.filter((l) => l.scene === sh.id).map((l) => l.offset + l[HC_KEY] + HC.tail));
    f += Math.round(Math.max(sh.s, need) * HC.fps);
  }
  var DUR = f / HC.fps;
}
const BPM = 92;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const THUNK = START.model + 0.3; // "So here's the partnership": the turn
const GROOVE = [START.model + 1.2, START.endCard + 4.6];
const END_THUNK = START.endCard + 4.6; // the TeamLogic IT × HexaView lockup
const LIFT = START.shift;
const DIP = THUNK - 0.6;
const RISE = START.problem + 2;

const N = Math.ceil(SR * DUR);
const L = new Float32Array(N);
const R = new Float32Array(N);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const CHORDS = [
  [45, 52, 57, 60, 64], // Am
  [41, 48, 53, 57, 60], // F
  [36, 43, 48, 52, 55], // C
  [43, 50, 55, 59, 62], // G
];

const add = (i, l, r = l) => {
  if (i >= 0 && i < N) {
    L[i] += l;
    R[i] += r;
  }
};

let seed = 7;
const noise = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed / 2147483647) * 2 - 1;
};

// --- Pad: soft additive tones with slow chorus, chord per bar after the drop.
const chordAt = (t) => (t < GROOVE[0] ? CHORDS[0] : CHORDS[Math.floor((t - GROOVE[0]) / (BAR * 2)) % CHORDS.length]);
for (let i = 0; i < N; i++) {
  const t = i / SR;
  let level;
  if (t < LIFT) level = 0.09 + 0.07 * (t / LIFT);
  else if (t < DIP) level = 0.1 + 0.08 * ((t - LIFT) / (DIP - LIFT));
  // A breath, not a gap: the pad dips into the thunk and swells straight back.
  else if (t < THUNK) level = 0.18 - 0.04 * ((t - DIP) / (THUNK - DIP));
  else if (t < GROOVE[0]) level = 0.15 + 0.03 * ((t - THUNK) / (GROOVE[0] - THUNK));
  else if (t < GROOVE[1]) level = 0.11;
  else level = 0.16 * Math.min(1, (DUR - t) / 1.2);
  const chord = chordAt(t);
  let sl = 0;
  let sr = 0;
  chord.forEach((m, k) => {
    const f = midi(m + 12);
    const lfo = Math.sin(2 * Math.PI * (0.13 + k * 0.03) * t);
    const a = Math.sin(2 * Math.PI * f * 1.002 * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t);
    const b = Math.sin(2 * Math.PI * f * 0.998 * t) + 0.25 * Math.sin(2 * Math.PI * f * 2.003 * t);
    sl += a * (0.8 + 0.2 * lfo);
    sr += b * (0.8 - 0.2 * lfo);
  });
  add(i, (sl / chord.length) * level, (sr / chord.length) * level);
}

// --- Bell shimmer on the logo build and the end card.
const bell = (t0, m, amp) => {
  const f = midi(m);
  for (let j = 0; j < SR * 2.5; j++) {
    const t = j / SR;
    const env = Math.exp(-t * 2.2) * Math.min(1, t * 200);
    const s = (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2.76 * t) * Math.exp(-t * 4)) * env * amp;
    add(Math.floor((t0 + t) * SR), s * 0.9, s);
  }
};
[[0.3, 76], [0.9, 81], [1.5, 84], [2.3, 88], [3.0, 84]].forEach(([t, m]) => bell(at(t), m, 0.07));
[[0.5, 76], [0.9, 81], [1.3, 84], [1.9, 88]].forEach(([t, m]) => bell(END_THUNK + at(t), m, 0.06));

// --- Sub thunk: the mark landing, and the sonic logo at the end.
const thunk = (t0, amp) => {
  let phase = 0;
  for (let j = 0; j < SR * 1.8; j++) {
    const t = j / SR;
    const f = 38 + 50 * Math.exp(-t * 9);
    phase += (2 * Math.PI * f) / SR;
    const env = Math.exp(-t * 2.6) * Math.min(1, t * 400);
    const click = j < SR * 0.01 ? noise() * (1 - j / (SR * 0.01)) * 0.5 : 0;
    add(Math.floor((t0 + t) * SR), (Math.sin(phase) * env + click) * amp);
  }
};
thunk(at(1.25), 0.55);
thunk(THUNK, 0.6);
thunk(END_THUNK, 0.55);

// --- Tension: ticking pulse and a rising noise sweep before the cut to black.
for (let t0 = LIFT; t0 < THUNK; t0 += BEAT / 2) {
  const amp = 0.04 + 0.05 * ((t0 - LIFT) / (THUNK - LIFT));
  for (let j = 0; j < SR * 0.03; j++) add(Math.floor((t0 + j / SR) * SR), noise() * Math.exp(-j / (SR * 0.006)) * amp);
}
{
  let lp = 0;
  let phase = 0;
  for (let t = RISE; t < THUNK; t += 1 / SR) {
    const p = (t - RISE) / (THUNK - RISE);
    lp += (noise() - lp) * (0.02 + 0.3 * p);
    phase += (2 * Math.PI * (180 + 900 * p * p)) / SR;
    add(Math.floor(t * SR), (lp * 0.22 + Math.sin(phase) * 0.05) * p * p);
  }
}
// Shimmer riser out of the thunk into the groove.
{
  let phase = 0;
  for (let t = THUNK + 0.3; t < GROOVE[0]; t += 1 / SR) {
    const p = (t - THUNK - 0.3) / (GROOVE[0] - THUNK - 0.3);
    phase += (2 * Math.PI * (880 + 880 * p)) / SR;
    const s = Math.sin(phase) * Math.sin(phase * 1.5) * 0.05 * p;
    add(Math.floor(t * SR), s, s * 0.8);
  }
}

// --- Groove: kick, clap, hats and bass from the sign-in to the end card.
const kick = (t0, amp) => {
  let phase = 0;
  for (let j = 0; j < SR * 0.4; j++) {
    const t = j / SR;
    phase += (2 * Math.PI * (48 + 110 * Math.exp(-t * 30))) / SR;
    add(Math.floor((t0 + t) * SR), Math.sin(phase) * Math.exp(-t * 9) * amp);
  }
};
const clap = (t0, amp) => {
  let prev = 0;
  for (let j = 0; j < SR * 0.18; j++) {
    const n = noise();
    const hp = n - prev;
    prev = n;
    const t = j / SR;
    add(Math.floor((t0 + t) * SR), hp * Math.exp(-t * 22) * amp, hp * Math.exp(-t * 20) * amp);
  }
};
const hat = (t0, amp, pan) => {
  let prev = 0;
  for (let j = 0; j < SR * 0.05; j++) {
    const n = noise();
    const hp = n - prev;
    prev = n;
    const s = hp * Math.exp(-j / (SR * 0.012)) * amp;
    add(Math.floor((t0 + j / SR) * SR), s * (1 - pan), s * (1 + pan));
  }
};
const bass = (t0, m, amp) => {
  const f = midi(m);
  for (let j = 0; j < SR * BEAT * 0.48; j++) {
    const t = j / SR;
    const env = Math.min(1, t * 300) * Math.exp(-t * 5);
    const s = Math.tanh(1.6 * (Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t))) * env * amp;
    add(Math.floor((t0 + t) * SR), s);
  }
};
let beat = 0;
// A light groove picks up the moment the mark lands, then the full beat arrives at 0:16.
for (let t0 = THUNK + BEAT; t0 < GROOVE[0] - 0.01; t0 += BEAT, beat++) {
  kick(t0, 0.4);
  hat(t0 + BEAT / 2, 0.06, (beat % 2) * 0.3 - 0.15);
}
beat = 0;
for (let t0 = GROOVE[0]; t0 < GROOVE[1] - 0.01; t0 += BEAT, beat++) {
  const intro = Math.min(1, (t0 - GROOVE[0]) / (BAR * 2)); // the groove builds over two bars
  kick(t0, 0.55);
  if (beat % 4 === 1 || beat % 4 === 3) clap(t0, 0.12 * intro);
  hat(t0 + BEAT / 2, 0.07 * intro, (beat % 2) * 0.3 - 0.15);
  const root = chordAt(t0)[0] - 12;
  bass(t0, root, 0.18);
  bass(t0 + BEAT / 2, root + (beat % 4 === 3 ? 7 : 0), 0.12);
}

// --- Master: gentle fade at the very end, normalise to -2 dBFS, write 16-bit stereo WAV.
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const g = t > DUR - 0.6 ? (DUR - t) / 0.6 : 1;
  L[i] *= g;
  R[i] *= g;
}
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const gain = 0.79 / peak;
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 4, 4);
buf.write("WAVEfmt ", 8);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4);
}
fs.mkdirSync("public/audio", { recursive: true });
const OUT = "public/audio/music-tl.wav";
fs.writeFileSync(OUT, buf);
console.log(OUT, DUR.toFixed(2) + "s", (buf.length / 1e6).toFixed(1), "MB");
