// Deterministic pseudo-random helpers so every customer's dummy data is stable
// between reloads, yet different per customer, tenant and module.

export type Rng = {
  (): number;
  int: (min: number, max: number) => number;
  float: (min: number, max: number, dp?: number) => number;
  pick: <T>(arr: readonly T[]) => T;
  pickN: <T>(arr: readonly T[], n: number) => T[];
  weighted: <T>(items: readonly (readonly [T, number])[]) => T;
  chance: (p: number) => boolean;
  shuffle: <T>(arr: readonly T[]) => T[];
  series: (n: number, base: number, jitter: number, drift?: number, min?: number, max?: number) => number[];
  id: (prefix: string, digits?: number) => string;
  hex: (len: number) => string;
};

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rng(seed: string): Rng {
  let a = hashString(seed) || 1;
  const next = (() => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }) as Rng;

  next.int = (min, max) => Math.floor(next() * (max - min + 1)) + min;
  next.float = (min, max, dp = 1) => {
    const f = 10 ** dp;
    return Math.round((next() * (max - min) + min) * f) / f;
  };
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.shuffle = (arr) => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  };
  next.pickN = (arr, n) => next.shuffle(arr).slice(0, Math.min(n, arr.length));
  next.weighted = (items) => {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = next() * total;
    for (const [v, w] of items) {
      r -= w;
      if (r <= 0) return v;
    }
    return items[items.length - 1][0];
  };
  next.chance = (p) => next() < p;
  next.series = (n, base, jitter, drift = 0, min = -Infinity, max = Infinity) => {
    const out: number[] = [];
    let v = base;
    for (let i = 0; i < n; i++) {
      v = v + drift + (next() - 0.5) * 2 * jitter;
      v = Math.max(min, Math.min(max, v));
      out.push(Math.round(v * 10) / 10);
    }
    return out;
  };
  next.id = (prefix, digits = 4) => `${prefix}-${String(next.int(1, 10 ** digits - 1)).padStart(digits, '0')}`;
  next.hex = (len) => Array.from({ length: len }, () => Math.floor(next() * 16).toString(16)).join('');
  return next;
}
