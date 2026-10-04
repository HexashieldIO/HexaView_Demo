import { useSyncExternalStore } from 'react';
import type { CustomerProfile } from '../../../data/types';

// In-session Marketplace state: integrations installed and requested during the
// demo. Lives in memory only (a page reload resets the demo), scoped per
// customer profile at runtime so switching customer never leaks installs.

export interface InstallRecord {
  listingId: string;
  name: string;
  tenants: string[] | 'all';
  dataPlaneId: string;
  writeBack: boolean;
  at: number;
}
export interface RequestRecord {
  name: string;
  vendor: string;
  useCase: string;
  at: number;
}

const installs = new Map<string, InstallRecord[]>();
const requests = new Map<string, RequestRecord[]>();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const scope = (c: CustomerProfile) => String(c.id);
const NONE_I: InstallRecord[] = [];
const NONE_R: RequestRecord[] = [];

export function addInstall(c: CustomerProfile, rec: InstallRecord) {
  const k = scope(c);
  installs.set(k, [...(installs.get(k) ?? []).filter((x) => x.listingId !== rec.listingId), rec]);
  emit();
}
export function removeInstall(c: CustomerProfile, listingId: string) {
  const k = scope(c);
  installs.set(k, (installs.get(k) ?? []).filter((x) => x.listingId !== listingId));
  emit();
}
export function addRequest(c: CustomerProfile, rec: RequestRecord) {
  const k = scope(c);
  requests.set(k, [...(requests.get(k) ?? []), rec]);
  emit();
}

/** Re-renders the caller on any Marketplace change and returns this customer's session state. */
export function useMarketplace(c: CustomerProfile): { installs: InstallRecord[]; requests: RequestRecord[]; version: number } {
  const v = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
  return { installs: installs.get(scope(c)) ?? NONE_I, requests: requests.get(scope(c)) ?? NONE_R, version: v };
}
