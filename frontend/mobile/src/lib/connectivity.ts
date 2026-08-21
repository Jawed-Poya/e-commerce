export type ConnectivityStatus = 'checking' | 'online' | 'offline';
export type ConnectivityReason = 'network' | 'server' | null;

export type ConnectivitySnapshot = {
  status: ConnectivityStatus;
  reason: ConnectivityReason;
  changedAt: number;
};

let snapshot: ConnectivitySnapshot = {
  status: 'checking',
  reason: null,
  changedAt: Date.now(),
};
const listeners = new Set<() => void>();

function publish(next: Omit<ConnectivitySnapshot, 'changedAt'>) {
  if (snapshot.status === next.status && snapshot.reason === next.reason) return;
  snapshot = { ...next, changedAt: Date.now() };
  listeners.forEach((listener) => listener());
}

export function reportApiAvailable() {
  publish({ status: 'online', reason: null });
}

export function reportApiUnavailable(reason: Exclude<ConnectivityReason, null>) {
  publish({ status: 'offline', reason });
}

export function subscribeConnectivity(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getConnectivitySnapshot() {
  return snapshot;
}
