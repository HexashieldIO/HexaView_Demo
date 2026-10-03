import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { CustomerId, CustomerProfile, Persona } from '../data/types';
import { CUSTOMERS } from '../data/customers';

export type TimeRange = '24h' | '7d' | '30d' | '90d';
export type Theme = 'dark' | 'light';
export type AccountType = 'customer' | 'partner';

export interface Toast {
  id: number;
  text: string;
}

interface AppState {
  customerId: CustomerId;
  customer: CustomerProfile;
  setCustomerId: (id: CustomerId) => void;
  /** 'all' = group roll-up, otherwise a tenant id. */
  tenantId: string;
  setTenantId: (id: string) => void;
  persona: Persona;
  setPersona: (p: Persona) => void;
  timeRange: TimeRange;
  setTimeRange: (t: TimeRange) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  account: AccountType;
  setAccount: (a: AccountType) => void;
  toasts: Toast[];
  toast: (text: string) => void;
  /** Bumped by the refresh button so live tiles can re-roll. */
  tick: number;
  refresh: () => void;
}

const Ctx = createContext<AppState | null>(null);

function load<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(`hv.${key}`) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, v: string) {
  try {
    localStorage.setItem(`hv.${key}`, v);
  } catch {
    /* storage unavailable: preference simply is not remembered */
  }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [customerId, setCustomerIdRaw] = useState<CustomerId>(() => load('customer', 'maritime', ['maritime', 'finserv', 'media', 'healthcare', 'automotive'] as const));
  const [tenantId, setTenantId] = useState('all');
  const [persona, setPersonaRaw] = useState<Persona>(() => load('persona', 'executive', ['executive', 'analyst', 'grc', 'ot', 'admin'] as const));
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [theme, setThemeRaw] = useState<Theme>(() => load('theme', 'dark', ['dark', 'light'] as const));
  const [account, setAccount] = useState<AccountType>('customer');
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setCustomerId = useCallback((id: CustomerId) => {
    setCustomerIdRaw(id);
    setTenantId('all');
    save('customer', id);
  }, []);
  const setPersona = useCallback((p: Persona) => {
    setPersonaRaw(p);
    save('persona', p);
  }, []);
  const setTheme = useCallback((t: Theme) => {
    setThemeRaw(t);
    save('theme', t);
  }, []);
  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((ts) => [...ts, { id, text }]);
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), 4200);
  }, []);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const value = useMemo<AppState>(
    () => ({
      customerId, customer: CUSTOMERS[customerId], setCustomerId,
      tenantId, setTenantId, persona, setPersona, timeRange, setTimeRange,
      theme, setTheme, account, setAccount, toasts, toast, tick, refresh,
    }),
    [customerId, setCustomerId, tenantId, persona, setPersona, timeRange, theme, setTheme, account, toasts, toast, tick, refresh],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}

/** Days covered by the selected time range, for scaling counts. */
export function rangeDays(t: TimeRange): number {
  return t === '24h' ? 1 : t === '7d' ? 7 : t === '30d' ? 30 : 90;
}
export function rangeLabel(t: TimeRange): string {
  return t === '24h' ? 'Last 24 hours' : t === '7d' ? 'Last 7 days' : t === '30d' ? 'Last 30 days' : 'Last 90 days';
}
