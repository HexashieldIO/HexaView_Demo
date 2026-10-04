import type { CustomerId, CustomerProfile, Connector, Tenant } from '../types';
import { maritime } from './maritime';
import { finserv } from './finserv';
import { media } from './media';
import { healthcare } from './healthcare';
import { automotive } from './automotive';
import { insurance } from './insurance';
import { defence } from './defence';
import { pharma } from './pharma';
import { sghospital } from './sghospital';
import { studio } from './studio';

export const CUSTOMERS: Record<CustomerId, CustomerProfile> = { maritime, finserv, media, healthcare, automotive, insurance, defence, pharma, sghospital, studio };
export const CUSTOMER_LIST: CustomerProfile[] = [maritime, finserv, media, healthcare, automotive, insurance, defence, pharma, sghospital, studio];

/** Tenants in scope for the current tenant filter ('all' = group roll-up). */
export function scopedTenants(c: CustomerProfile, tenantId: string): Tenant[] {
  return tenantId === 'all' ? c.tenants : c.tenants.filter((t) => t.id === tenantId);
}

/** Connectors that serve the selected tenant (or every connector for the group). */
export function scopedConnectors(c: CustomerProfile, tenantId: string): Connector[] {
  if (tenantId === 'all') return c.connectors;
  return c.connectors.filter((k) => k.tenants === 'all' || k.tenants.includes(tenantId));
}

/**
 * Share of the group a tenant represents, used to scale counts when a single
 * tenant is selected so numbers stay plausible (criticality and headcount weighted).
 */
export function tenantShare(c: CustomerProfile, tenantId: string): number {
  if (tenantId === 'all') return 1;
  const total = c.tenants.reduce((s, t) => s + t.people, 0);
  const t = c.tenants.find((x) => x.id === tenantId);
  return t ? Math.max(0.08, t.people / total) : 1;
}

/** Scale an integer count by the tenant share, keeping at least `min`. */
export function scale(n: number, share: number, min = 0): number {
  return Math.max(min, Math.round(n * share));
}

/** Criticality-weighted group Resilience Index (LLD 7.7 roll-up). */
export function groupRI(c: CustomerProfile, tenantId = 'all'): number {
  const ts = scopedTenants(c, tenantId);
  const w = ts.reduce((s, t) => s + t.criticality, 0);
  return Math.round(ts.reduce((s, t) => s + t.ri * t.criticality, 0) / w);
}

export function isStale(k: Connector): boolean {
  return k.lastSyncMin > k.intervalMin * 2;
}

export function tenantName(c: CustomerProfile, tenantId: string): string {
  return tenantId === 'all' ? `${c.short} group` : c.tenants.find((t) => t.id === tenantId)?.short ?? tenantId;
}
