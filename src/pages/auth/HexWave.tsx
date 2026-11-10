import { useEffect, useRef, useState, type CSSProperties } from 'react';

/**
 * The hand-off from sign-in into HexaView: a honeycomb fills the screen and two
 * waves of light ripple out from the centre while the welcome card draws in;
 * then the honeycomb closes over the screen in the app's navy and the app opens
 * underneath. Canvas-drawn so hundreds of hexagons stay smooth.
 */
export const HEX_WAVE_MS = 2600;

const NAVY = [7, 14, 43] as const;

function hexToRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [47, 191, 160];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function HexWave({ name, org, index, accent = '#2fbfa0', accent2 = '#21b5ea' }: {
  name: string;
  org: string;
  index: number;
  accent?: string;
  accent2?: string;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const cv = canvas.current;
    const ctx = cv?.getContext('2d');
    if (!cv || !ctx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = window.innerWidth, H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.scale(dpr, dpr);

    // Pointy-top honeycomb covering the screen.
    const r = Math.max(18, Math.min(30, Math.round(Math.min(W, H) / 28)));
    const hw = Math.sqrt(3) * r, vh = 1.5 * r;
    const cx = W / 2, cy = H / 2;
    const maxD = Math.hypot(cx, cy) + r * 2;
    const cells: { x: number; y: number; d: number; j: number }[] = [];
    for (let row = -1, y = -r; y < H + r * 2; row++, y += vh) {
      const off = row % 2 ? hw / 2 : 0;
      for (let x = -hw + off; x < W + hw; x += hw) {
        // A little jitter so the wave front looks organic rather than a perfect circle.
        cells.push({ x, y, d: Math.hypot(x - cx, y - cy) / maxD, j: (Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1 * 0.04 });
      }
    }
    const A = hexToRgb(accent), B = hexToRgb(accent2);
    const path = (x: number, y: number, s: number) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 180 * (60 * i - 30);
        const px = x + s * Math.cos(a), py = y + s * Math.sin(a);
        if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
      }
      ctx.closePath();
    };
    const band = (front: number, d: number, width: number) => {
      const k = (d - front) / width;
      return Math.exp(-k * k);
    };

    const t0 = performance.now();
    let raf = 0, timer = 0;
    const frame = () => {
      const t = (performance.now() - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      // Ground: the sign-in navy deepening towards the app's.
      ctx.fillStyle = `rgba(${NAVY[0]},${NAVY[1]},${NAVY[2]},${Math.min(0.92, 0.55 + t * 0.4)})`;
      ctx.fillRect(0, 0, W, H);

      const w1 = t * 0.62 - 0.05;            // first wave
      const w2 = (t - 0.42) * 0.62 - 0.05;   // second, softer wave
      const cover = (t - 1.75) * 1.5;        // honeycomb closing over the screen, centre outwards
      for (const c of cells) {
        const d = c.d + c.j;
        const i1 = band(w1, d, 0.07);
        const i2 = t > 0.42 ? band(w2, d, 0.06) * 0.55 : 0;
        const lit = Math.min(1, i1 + i2);
        const reached = Math.max(0, Math.min(1, (w1 - d) * 3));   // cells the first wave has passed
        const closed = cover > 0 ? Math.max(0, Math.min(1, (cover - d) * 6)) : 0;
        const mix = Math.min(1, d * 1.3);
        const R = A[0] + (B[0] - A[0]) * mix, G = A[1] + (B[1] - A[1]) * mix, Bl = A[2] + (B[2] - A[2]) * mix;

        const s = r * (0.9 + lit * 0.12);
        path(c.x, c.y, s - 1.5);
        if (closed > 0) {
          ctx.fillStyle = `rgba(${NAVY[0]},${NAVY[1]},${NAVY[2]},${closed})`;
          ctx.fill();
        }
        if (lit > 0.02) {
          ctx.fillStyle = `rgba(${R | 0},${G | 0},${Bl | 0},${lit * 0.32 * (1 - closed)})`;
          ctx.fill();
        }
        const edge = 0.05 + reached * 0.07 + lit * 0.75 + (closed > 0 && closed < 1 ? 0.6 : 0);
        ctx.strokeStyle = `rgba(${R | 0},${G | 0},${Bl | 0},${Math.min(1, edge) * (1 - closed * 0.85)})`;
        ctx.lineWidth = lit > 0.3 ? 1.6 : 1;
        ctx.stroke();
      }
      if (t * 1000 < HEX_WAVE_MS + 200) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    // Fallback in case rAF is throttled (hidden tab): keep the count-up honest.
    const started = performance.now();
    timer = window.setInterval(() => {
      const p = Math.min(1, (performance.now() - started - 500) / 900);
      setCount(Math.round(index * Math.max(0, 1 - Math.pow(1 - Math.max(0, p), 3))));
      if (p >= 1) window.clearInterval(timer);
    }, 30);
    return () => { cancelAnimationFrame(raf); window.clearInterval(timer); };
  }, [accent, accent2, index]);

  const first = name.split(' ')[0];
  return (
    <div className="hw" aria-live="polite" style={{ '--hw-a': accent, '--hw-b': accent2 } as CSSProperties}>
      <canvas ref={canvas} className="hw-canvas" aria-hidden />
      <div className="hw-card">
        <svg viewBox="0 0 120 120" width="112" height="112" className="hw-hex" aria-hidden>
          <defs>
            <linearGradient id="hw-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#7ff0d6" /><stop offset=".55" stopColor={accent} /><stop offset="1" stopColor={accent2} /></linearGradient>
          </defs>
          <path d="M60 6 L106.8 33 L106.8 87 L60 114 L13.2 87 L13.2 33 Z" fill="rgba(7,14,43,.75)" stroke="url(#hw-g)" strokeWidth="5" strokeLinejoin="round" className="hw-path" />
          <text x="60" y="58" textAnchor="middle" className="hw-num">{count}</text>
          <text x="60" y="78" textAnchor="middle" className="hw-lbl">INDEX</text>
        </svg>
        <div className="hw-txt">
          <small>Signed in · secure session</small>
          <b>Welcome back, {first}</b>
          <span>Opening {org}'s trust console</span>
        </div>
      </div>
    </div>
  );
}
