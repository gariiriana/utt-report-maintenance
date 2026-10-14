// One history entry per interaction, including handlers that update several fields.
// The URL is the source of truth; popstate never writes a new history entry.
export const NAVIGATION_EVENT = 'dwimitra:navigation';
const QUERY_PREFIX = 'nav.';
let pending: { url: URL; replace: boolean } | null = null;
const listeners = new Set<() => void>();

export function pathParts(url = new URL(window.location.href)): string[] {
  return url.pathname.split('/').filter(Boolean).map(part => {
    try { return decodeURIComponent(part); } catch { return part; }
  });
}

function notifyNavigation() {
  window.dispatchEvent(new Event(NAVIGATION_EVENT));
}

export function flushNavigation() {
  const next = pending;
  pending = null;
  if (!next || next.url.href === window.location.href) return;
  // Keep the PWA sentinel only on its own entry, never copy it into real routes.
  const { dwimitraBackGuard: guard, dwimitraBackBoundary: boundary, ...state } = window.history.state || {};
  const nextState = {
    ...state, dwimitraNavigation: true,
    dwimitraNavigationIndex: (state.dwimitraNavigationIndex || 0) + (next.replace ? 0 : 1),
    ...(next.replace && guard ? { dwimitraBackGuard: true } : {}),
    ...(next.replace && boundary ? { dwimitraBackBoundary: true } : {}),
  };
  if (next.replace) window.history.replaceState(nextState, '', next.url);
  else window.history.pushState(nextState, '', next.url);
  notifyNavigation();
}

export function updateNavigation(change: (url: URL) => void, replace = false, owner?: string) {
  // Animated outgoing pages must not change the destination page's URL.
  if (owner !== undefined && pathParts()[0] !== owner) return;
  if (!pending) {
    pending = { url: new URL(window.location.href), replace };
    queueMicrotask(flushNavigation);
  } else if (!replace) {
    pending.replace = false;
  }
  change(pending.url);
}

function emitNavigation() { listeners.forEach(listener => listener()); }
function onPopState() { pending = null; emitNavigation(); }

export function subscribeNavigation(listener: () => void): () => void {
  if (listeners.size === 0) {
    window.addEventListener('popstate', onPopState);
    window.addEventListener(NAVIGATION_EVENT, emitNavigation);
  }
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener('popstate', onPopState);
      window.removeEventListener(NAVIGATION_EVENT, emitNavigation);
    }
  };
}

export const navigationSnapshot = () => window.location.href;

export function setMenuPath(url: URL, segment: string) {
  url.pathname = `/${segment}`;
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith(QUERY_PREFIX)) url.searchParams.delete(key);
  }
  url.hash = '';
}

export function readNavigationValue<T extends string | number | boolean | null>(
  url: URL, key: string, fallback: T, allowed?: readonly T[],
): T {
  const raw = url.searchParams.get(QUERY_PREFIX + key);
  if (raw === null) return fallback;
  let value: string | number | boolean = raw;
  if (typeof fallback === 'number' || allowed?.some(item => typeof item === 'number')) {
    if (!raw.trim() || !Number.isFinite(Number(raw))) return fallback;
    value = Number(raw);
  } else if (typeof fallback === 'boolean') {
    if (raw !== 'true' && raw !== 'false') return fallback;
    value = raw === 'true';
  }
  return allowed && !allowed.includes(value as T) ? fallback : value as T;
}

export function writeNavigationValue(url: URL, key: string, value: string | number | boolean | null, fallback: string | number | boolean | null = null) {
  if (value === null || value === fallback) url.searchParams.delete(QUERY_PREFIX + key);
  else url.searchParams.set(QUERY_PREFIX + key, String(value));
}

export function readFolderPath(index: number, labels: readonly string[], url = new URL(window.location.href)): string | null {
  const part = pathParts(url)[index];
  if (!part) return null;
  return labels.find(label => folderSegment(label) === part) || part;
}

export function folderSegment(label: string): string {
  // Known labels have readable slugs. Other folder names are encoded losslessly.
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function writeFolderPath(url: URL, index: number, value: string | null, labels: readonly string[]) {
  const parts = pathParts(url);
  const segment = value === null ? null : labels.includes(value) ? folderSegment(value) : value;
  if ((parts[index] || null) === segment) return;
  parts.splice(index);
  if (segment !== null && parts.length === index) parts.push(segment);
  url.pathname = '/' + parts.map(encodeURIComponent).join('/');
}
