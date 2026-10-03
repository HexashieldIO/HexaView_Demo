// Formatting helpers. Generated data stores times as "minutes ago" / "days ago"
// offsets so the demo always looks current, whenever it is shown.

export const NOW = new Date();

export function ago(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000);
}
export function daysAgo(days: number): Date {
  return ago(days * 1440);
}
export function daysAhead(days: number): Date {
  return ago(-days * 1440);
}

export function fmtNum(n: number, dp = 0): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp });
}

export function fmtCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(abs >= 1e10 ? 0 : 1)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(0)}k`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}k`;
  return fmtNum(n);
}

export function fmtMoney(n: number, currency = 'USD', compact = true): string {
  const sym = currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : '$';
  return compact ? `${n < 0 ? '-' : ''}${sym}${fmtCompact(Math.abs(n))}` : `${sym}${fmtNum(n)}`;
}

export function fmtPct(n: number, dp = 0): string {
  return `${n.toFixed(dp)}%`;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function fmtDateShort(d: Date): string {
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
export function fmtTime(d: Date): string {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}
export function fmtDateTime(d: Date): string {
  return `${fmtDateShort(d)} ${fmtTime(d)}`;
}
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** "4 min ago", "3 h ago", "2 d ago" from an offset in minutes. */
export function fmtAgo(minutes: number): string {
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h ago`;
  if (minutes < 60 * 24 * 60) return `${Math.round(minutes / 1440)} d ago`;
  return `${Math.round(minutes / 43200)} mo ago`;
}

/** Duration in minutes to "38 min", "5.2 h", "3 d". */
export function fmtDur(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  if (minutes < 1440) return `${(minutes / 60).toFixed(minutes < 600 ? 1 : 0)} h`;
  return `${(minutes / 1440).toFixed(minutes < 14400 ? 1 : 0)} d`;
}

/** Month labels for the last n months, oldest first, e.g. ["Nov", ... "Oct"]. */
export function monthLabels(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(NOW.getFullYear(), NOW.getMonth() - i, 1);
    out.push(d.toLocaleDateString('en-GB', { month: 'short' }));
  }
  return out;
}
/** Day labels for the last n days, oldest first, e.g. ["12 Sep", ...]. */
export function dayLabels(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(fmtDateShort(daysAgo(i)));
  return out;
}
/** Hour labels for the last n hours, oldest first ("07:00"). */
export function hourLabels(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = ago(i * 60);
    out.push(`${String(d.getHours()).padStart(2, '0')}:00`);
  }
  return out;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
export function sum(arr: number[]): number {
  return arr.reduce((s, n) => s + n, 0);
}
export function avg(arr: number[]): number {
  return arr.length ? sum(arr) / arr.length : 0;
}

export function plural(n: number, word: string, pluralWord = `${word}s`): string {
  return `${fmtNum(n)} ${n === 1 ? word : pluralWord}`;
}

export function scoreTone(score: number): string {
  if (score >= 85) return 'var(--good)';
  if (score >= 70) return 'var(--sev-medium)';
  return 'var(--bad)';
}
