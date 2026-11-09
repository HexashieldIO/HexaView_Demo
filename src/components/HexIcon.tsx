import { BadgeCheck, BadgeDollarSign, FileBarChart2, GraduationCap, Handshake, Hexagon, MessagesSquare, Milestone, Network, LayoutDashboard, Palette, Presentation, Receipt, RefreshCcwDot, Settings2, ShieldCheck, Siren, type LucideIcon } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { ModuleDef } from '../modules/registry';

const GLYPHS: Record<string, LucideIcon> = { BadgeCheck, BadgeDollarSign, FileBarChart2, GraduationCap, Handshake, LayoutDashboard, MessagesSquare, Milestone, Network, Palette, Presentation, Receipt, RefreshCcwDot, Settings2, ShieldCheck, Siren };

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

/**
 * Module icon as a HexaEngine "orb": the hex logo with a slowly turning dashed
 * ring and a sweeping outer arc, both in the module colour.
 */
export function HexOrb({ mod, size = 44, bob = false }: { mod: Pick<ModuleDef, 'brandIcon' | 'glyph' | 'tone' | 'product'>; size?: number; bob?: boolean }) {
  return (
    <span className="orb" style={{ width: size, height: size, '--c': mod.tone } as CSSProperties}>
      {bob ? <span className="hv-hexbob" style={{ display: 'grid', position: 'relative', zIndex: 1 }}><HexIcon mod={mod} size={size} /></span> : <HexIcon mod={mod} size={size} />}
      <i aria-hidden />
      <i className="o2" aria-hidden />
    </span>
  );
}
