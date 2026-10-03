import { useSyncExternalStore } from 'react';

// Read / dismissed notification ids, shared by the bell and the Notification
// Centre page, remembered per browser (best effort).
const KEY = 'hv.notif.read';
let read: Set<string> = new Set();
try {
  read = new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]') as string[]);
} catch {
  read = new Set();
}
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version++;
  try {
    localStorage.setItem(KEY, JSON.stringify([...read]));
  } catch {
    /* storage unavailable: read state lasts for this session only */
  }
  listeners.forEach((l) => l());
}

export function markRead(ids: string | string[]) {
  for (const id of Array.isArray(ids) ? ids : [ids]) read.add(id);
  emit();
}
export function markUnread(id: string) {
  read.delete(id);
  emit();
}
export function isRead(id: string): boolean {
  return read.has(id);
}

/** Re-renders the caller whenever read state changes. */
export function useNotifRead(): number {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => version,
  );
}
