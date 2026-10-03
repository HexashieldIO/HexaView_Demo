import type { CSSProperties } from 'react';
import { KeyRound, Lock } from 'lucide-react';
import { CAP_LIST, type PartnerClient } from '../../data/modules/partner';
import { serviceName, type Brand } from './brand';
import '../partner/partner.css';

const FONT: Record<Brand['font'], string> = { Inter: 'var(--font-ui)', 'Space Grotesk': 'var(--font-display)', System: 'system-ui, -apple-system, Segoe UI, sans-serif' };

export function BrandMark({ brand, size = 26 }: { brand: Brand; size?: number }) {
  if (brand.logoImage) {
    return <img src={brand.logoImage} alt="" style={{ height: size, width: brand.logoShape === 'wide' ? size * 3.2 : size, objectFit: 'contain', borderRadius: 6 }} />;
  }
  return (
    <span className="pt-pv-mark" style={{ width: brand.logoShape === 'wide' ? 'auto' : size, padding: brand.logoShape === 'wide' ? '0 8px' : 0, height: size, borderRadius: brand.logoShape === 'wide' ? 6 : size * 0.28, background: brand.primary, fontSize: size * 0.42 }}>
      {brand.logoShape === 'wide' ? brand.productName : brand.logoText}
    </span>
  );
}

/** Mini HexaView shell drawn in the partner's brand. */
export function BrandPreview({ brand, client, tab = 0 }: { brand: Brand; client: PartnerClient; tab?: number }) {
  const dark = brand.mode === 'dark';
  const bg = dark ? '#070d1e' : '#f3f5f9';
  const card = dark ? '#0b1122' : '#ffffff';
  const line = dark ? '#1b2440' : '#e5e9f1';
  const text = dark ? '#eaf0fb' : '#17203a';
  const muted = dark ? '#8593b4' : '#8b94a8';
  const navItems = ['Command Centre', ...CAP_LIST.map((c) => serviceName(c.product, brand)), 'Reports'];
  const locked = new Set(CAP_LIST.filter((c) => client.modules[c.id] === 'Off').map((c) => serviceName(c.product, brand)));
  const bars = client.riTrend.slice(-8);
  const bmin = Math.min(...bars) - 5;
  const bmax = Math.max(...bars);
  return (
    <div className="pt-preview" style={{ background: bg, color: text, fontFamily: FONT[brand.font] }}>
      <div className="pt-pv-side" style={{ background: brand.sidebar }}>
        <div className="pt-pv-logo">
          <BrandMark brand={brand} />
          {brand.logoShape === 'square' && <b style={{ color: '#fff', fontSize: 12.5, lineHeight: 1.15 }}>{brand.productName}</b>}
        </div>
        <div style={{ fontSize: 8.5, letterSpacing: '.1em', color: 'rgba(255,255,255,.45)', padding: '0 8px 4px' }}>{client.short.toUpperCase()}</div>
        {navItems.map((n, i) => (
          <div key={n} className="pt-pv-nav" style={{ background: i === 0 ? `color-mix(in srgb, ${brand.primary} 28%, transparent)` : undefined, color: i === 0 ? '#fff' : locked.has(n) ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.72)' }}>
            <i style={{ background: i === 0 ? brand.primary : i <= CAP_LIST.length ? CAP_LIST[i - 1]?.tone ?? brand.accent : brand.accent, opacity: locked.has(n) ? 0.35 : 1 }} />
            <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n}</span>
            {locked.has(n) && <Lock size={10} />}
          </div>
        ))}
        <div style={{ flex: 1 }} />
        {brand.poweredBy && <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,.4)', padding: '0 8px' }}>Powered by HexaShield</div>}
      </div>
      <div className="pt-pv-main">
        <div className="pt-pv-top" style={{ borderColor: line, background: card }}>
          <b style={{ fontSize: 12.5 }}>Command Centre</b>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 9.5, color: muted, border: `1px solid ${line}`, borderRadius: 6, padding: '2px 7px' }}>{brand.domain}</span>
          <span style={{ width: 20, height: 20, borderRadius: '50%', background: brand.accent, display: 'grid', placeItems: 'center', fontSize: 8.5, color: '#111', fontWeight: 700 }}>{client.initials}</span>
        </div>
        <div className="pt-pv-tabs" style={{ borderColor: line, background: card }}>
          {['Overview', 'Incidents', 'Compliance', 'Reports'].map((t, i) => (
            <span key={t} style={{ color: i === tab ? brand.primary : muted, borderColor: i === tab ? brand.primary : 'transparent', fontWeight: i === tab ? 700 : 500 }}>{t}</span>
          ))}
        </div>
        <div className="pt-pv-body">
          <div className="pt-pv-kpis" style={{ borderColor: line, background: card }}>
            {[
              ['Resilience', client.ri],
              ['Open incidents', client.openIncidents],
              ['Integrations', `${client.healthyIntegrations}/${client.integrations}`],
              ['Critical', client.critical],
            ].map(([l, v], i) => (
              <div key={String(l)} style={{ borderColor: line }}>
                <small style={{ color: muted }}>{l}</small>
                <b style={{ color: i === 0 ? brand.primary : i === 3 && Number(v) > 0 ? '#e5533d' : text }}>{v}</b>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 10 }}>
            <div className="pt-pv-card" style={{ borderColor: line, background: card }}>
              <b style={{ fontSize: 11 }}>Resilience Index, 8 months</b>
              <svg viewBox="0 0 160 60" style={{ width: '100%', height: 70, marginTop: 6 }} aria-hidden>
                {bars.map((b, i) => {
                  const h = ((b - bmin) / Math.max(1, bmax - bmin)) * 48 + 6;
                  return <rect key={i} x={i * 20 + 3} y={60 - h} width={14} height={h} rx={2} fill={brand.primary} opacity={0.45 + (i / bars.length) * 0.55} />;
                })}
              </svg>
            </div>
            <div className="pt-pv-card" style={{ borderColor: line, background: card }}>
              <b style={{ fontSize: 11 }}>Needs attention</b>
              <div style={{ fontSize: 10, color: muted, marginTop: 6, lineHeight: 1.45 }}>{client.topAction.slice(0, 96)}{client.topAction.length > 96 ? '…' : ''}</div>
              <span style={{ display: 'inline-block', marginTop: 8, background: brand.primary, color: '#fff', borderRadius: 6, padding: '3px 9px', fontSize: 10, fontWeight: 700 }}>Review</span>
            </div>
          </div>
        </div>
        <div className="pt-pv-foot" style={{ color: muted }}>{brand.supportEmail}</div>
      </div>
    </div>
  );
}

/** Client sign-in page in the partner's brand. */
export function LoginPreview({ brand, sso }: { brand: Brand; sso: string[] }) {
  const art: CSSProperties =
    brand.loginArt === 'gradient'
      ? { background: `linear-gradient(135deg, ${brand.sidebar} 0%, ${brand.primary} 120%)` }
      : brand.loginArt === 'grid'
        ? { background: `${brand.sidebar}`, backgroundImage: `linear-gradient(${brand.primary}33 1px, transparent 1px), linear-gradient(90deg, ${brand.primary}33 1px, transparent 1px)`, backgroundSize: '22px 22px' }
        : { background: brand.sidebar };
  return (
    <div className="pt-login" style={{ fontFamily: FONT[brand.font] }}>
      <div className="pt-login-art" style={art}>
        <div className="row" style={{ gap: 8 }}>
          <BrandMark brand={brand} size={28} />
          {brand.logoShape === 'square' && <b style={{ fontSize: 14 }}>{brand.productName}</b>}
        </div>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, lineHeight: 1.15 }}>{brand.loginHeadline}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 8, maxWidth: 260 }}>{brand.loginSub}</div>
        </div>
        <div style={{ fontSize: 10, opacity: 0.6 }}>{brand.domain}{brand.poweredBy ? ' · Powered by HexaShield' : ''}</div>
      </div>
      <div className="pt-login-form">
        <b style={{ fontSize: 16 }}>Sign in</b>
        <span style={{ fontSize: 11.5, color: '#8b94a8' }}>Use your organisation account</span>
        {sso.map((s) => (
          <div key={s} className="pt-fake-sso"><KeyRound size={13} /> Continue with {s}</div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10.5, color: '#8b94a8' }}><span style={{ flex: 1, height: 1, background: '#e5e9f1' }} />or<span style={{ flex: 1, height: 1, background: '#e5e9f1' }} /></div>
        <div className="pt-fake-input">name@company.com</div>
        <div className="pt-fake-btn" style={{ background: brand.primary }}>Continue</div>
        <span style={{ fontSize: 10, color: '#8b94a8', textAlign: 'center' }}>Help: {brand.supportEmail}</span>
      </div>
    </div>
  );
}
