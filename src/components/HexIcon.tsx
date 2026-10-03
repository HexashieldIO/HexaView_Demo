import { BadgeCheck, BadgeDollarSign, FileBarChart2, GraduationCap, Handshake, Hexagon, MessagesSquare, Network, LayoutDashboard, Palette, Presentation, Receipt, RefreshCcwDot, Settings2, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { ModuleDef } from '../modules/registry';

const GLYPHS: Record<string, LucideIcon> = { BadgeCheck, BadgeDollarSign, FileBarChart2, GraduationCap, Handshake, LayoutDashboard, MessagesSquare, Network, Palette, Presentation, Receipt, RefreshCcwDot, Settings2, ShieldCheck };

/**
 * Module icon. Platform modules use their official hex icon from /brand; the
 * new modules get the same rounded-hex treatment drawn in their accent colour,
 * so the rail reads as one family.
 */
export function HexIcon({ mod, size = 22 }: { mod: Pick<ModuleDef, 'brandIcon' | 'glyph' | 'tone' | 'product'>; size?: number }) {
  if (mod.brandIcon) return <img src={`/brand/${mod.brandIcon}`} width={size} height={size} alt="" aria-hidden />;
  const Glyph = (mod.glyph && GLYPHS[mod.glyph]) || Hexagon;
  return (
    <svg width={size} height={size} viewBox="0 0 120 120" aria-hidden>
      <path d="M60 8 L105 34 L105 86 L60 112 L15 86 L15 34 Z" fill={mod.tone} stroke={mod.tone} strokeWidth={11} strokeLinejoin="round" />
      <Glyph x={33} y={33} width={54} height={54} color="#fff" strokeWidth={2.4} />
    </svg>
  );
}
