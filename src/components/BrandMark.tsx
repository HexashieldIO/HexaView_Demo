import type { CSSProperties } from 'react';
import { usePublishedBrand } from '../pages/whitelabel/brand';

/**
 * The console's top-left logo: a partner's published white-label brand when one
 * is live, otherwise the HexaView logo.
 */
export function BrandMark({ className = 'brand-logo', large = false }: { className?: string; large?: boolean }) {
  const b = usePublishedBrand();
  if (!b) return <img src="/brand/HexaView_logo_reverse.png" alt="HexaView" className={className} />;
  const h = large ? 52 : 38;
  return (
    <span className={`wl-mark ${large ? 'large' : ''}`} style={{ '--wl-primary': b.primary, '--wl-accent': b.accent } as CSSProperties}>
      <span className="wl-mark-row">
        {b.logoImage && b.logoShape === 'wide' ? (
          <img src={b.logoImage} alt={b.productName} style={{ height: h, maxWidth: large ? 280 : 200, objectFit: 'contain' }} />
        ) : (
          <>
            {b.logoImage ? (
              <img src={b.logoImage} alt="" style={{ width: h, height: h, objectFit: 'contain', borderRadius: 8 }} />
            ) : (
              <span className="wl-mono" style={{ width: h, height: h, fontSize: h * 0.36 }}>{b.logoText || b.productName.slice(0, 2).toUpperCase()}</span>
            )}
            <b className="wl-name" style={{ fontSize: large ? 24 : 17 }}>{b.productName}</b>
          </>
        )}
      </span>
      {b.poweredBy && <small className="wl-powered">Powered by HexaShield</small>}
    </span>
  );
}
