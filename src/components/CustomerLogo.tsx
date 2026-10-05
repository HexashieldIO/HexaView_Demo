import type { CSSProperties } from 'react';
import { CUSTOMERS } from '../data/customers';

/**
 * A demo customer's logo mark (public/brand/customers/<id>.svg). Falls back to the
 * coloured initials tile for companies without one (e.g. partner portfolio names).
 */
export function CustomerLogo({ c, size = 34, radius, className, style }: {
  c: { id: string; initials: string; colour: string; name?: string };
  size?: number;
  radius?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const r = radius ?? Math.round(size * 0.24);
  if (c.id in CUSTOMERS) {
    return (
      <img
        src={`/brand/customers/${c.id}.svg`}
        alt={c.name ? `${c.name} logo` : ''}
        width={size}
        height={size}
        className={className}
        style={{ width: size, height: size, borderRadius: r, flexShrink: 0, display: 'block', ...style }}
      />
    );
  }
  return (
    <span className={className} style={{ width: size, height: size, borderRadius: r, flexShrink: 0, display: 'grid', placeItems: 'center', background: c.colour, color: '#fff', fontWeight: 800, fontSize: Math.round(size * 0.38), lineHeight: 1, ...style }}>
      {c.initials}
    </span>
  );
}
