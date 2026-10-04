import type { BaseCustomerId, CustomerId } from './types';
import { CUSTOMERS } from './customers';

/**
 * A per-customer data table. The five original customers must all have an
 * entry; customers added later may have their own entry and otherwise read
 * their template customer's entry (CustomerProfile.dataKey) via forCustomer.
 */
export type CustomerMap<T> = Record<BaseCustomerId, T> & Partial<Record<Exclude<CustomerId, BaseCustomerId>, T>>;

/** Anything that identifies a customer and its template (a CustomerProfile). */
export interface CustomerRef {
  id: CustomerId;
  dataKey: BaseCustomerId;
}

/**
 * Look a customer up in a per-customer table: its own entry if it has one,
 * otherwise its template customer's entry.
 */
export function forCustomer<T>(map: CustomerMap<T>, c: CustomerRef): T;
export function forCustomer<T>(map: Partial<Record<CustomerId, T>>, c: CustomerRef): T | undefined;
export function forCustomer<T>(map: Partial<Record<CustomerId, T>>, c: CustomerRef): T | undefined {
  return map[c.id] ?? map[c.dataKey];
}

/** Same as forCustomer when only the customer id is to hand. */
export function forCustomerId<T>(map: CustomerMap<T>, id: CustomerId): T;
export function forCustomerId<T>(map: Partial<Record<CustomerId, T>>, id: CustomerId): T | undefined;
export function forCustomerId<T>(map: Partial<Record<CustomerId, T>>, id: CustomerId): T | undefined {
  return map[id] ?? map[CUSTOMERS[id]?.dataKey ?? (id as BaseCustomerId)];
}

/** The template (original) customer id a customer's module data is read from. */
export function dataKeyOf(id: CustomerId): BaseCustomerId {
  return CUSTOMERS[id]?.dataKey ?? (id as BaseCustomerId);
}

/* ---------------------------------------------------------------------
   Template-entity resolution. Template module data names the template
   customer's own connectors, frameworks, tenants and vendors by id; when a
   newer customer lacks that exact entity, resolve the nearest equivalent so
   citations and drill-downs still point at something real.
   --------------------------------------------------------------------- */
type Profile = (typeof CUSTOMERS)[CustomerId];

export function connectorFor(c: Profile, id: string): Profile['connectors'][number] {
  const own = c.connectors.find((k) => k.id === id);
  if (own) return own;
  const tpl = CUSTOMERS[c.dataKey].connectors.find((k) => k.id === id);
  return (tpl && c.connectors.find((k) => k.category === tpl.category)) ?? c.connectors[0];
}

export function frameworkFor(c: Profile, id: string): Profile['frameworks'][number] {
  const own = c.frameworks.find((f) => f.id === id);
  if (own) return own;
  const tpl = CUSTOMERS[c.dataKey].frameworks.find((f) => f.id === id);
  return (tpl && c.frameworks.find((f) => f.short === tpl.short || f.kind === tpl.kind)) ?? c.frameworks[0];
}

export function tenantFor(c: Profile, id: string): Profile['tenants'][number] {
  const own = c.tenants.find((t) => t.id === id);
  if (own) return own;
  const i = CUSTOMERS[c.dataKey].tenants.findIndex((t) => t.id === id);
  return c.tenants[Math.max(0, i) % c.tenants.length];
}

export function thirdPartyFor(c: Profile, namePrefix: string): Profile['thirdParties'][number] {
  return c.thirdParties.find((v) => v.name.startsWith(namePrefix)) ?? c.thirdParties[0];
}
