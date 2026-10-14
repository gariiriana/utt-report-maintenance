export type AppUpdatePhase = 'ready' | 'waiting' | 'saving' | 'updating' | 'error';
type UpdateSnapshot = { required: boolean; phase: AppUpdatePhase; error: string | null };
let snapshot: UpdateSnapshot = { required: false, phase: 'ready', error: null };
let applyUpdate: (() => Promise<void>) | null = null;
let running: Promise<void> | null = null;
const listeners = new Set<() => void>();
const drafts = new Map<string, () => Promise<void>>();
const blockers = new Set<symbol>();
const idleListeners = new Set<() => void>();

const publish = (phase: AppUpdatePhase, error: string | null = null) => {
  snapshot = { required: true, phase, error };
  listeners.forEach(listener => listener());
};

export const getAppUpdateSnapshot = () => snapshot;
export const subscribeAppUpdate = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export function requireAppUpdate(action: () => Promise<void>) {
  applyUpdate = action;
  if (!snapshot.required) publish('ready');
}

export function registerUpdateDraft(key: string, save: () => Promise<void>) {
  drafts.set(key, save);
  return () => { if (drafts.get(key) === save) drafts.delete(key); };
}

export function blockAppUpdate() {
  const id = Symbol('active-work');
  blockers.add(id);
  return () => {
    blockers.delete(id);
    if (!blockers.size) idleListeners.forEach(listener => listener());
  };
}

async function waitForActiveWork() {
  if (!blockers.size) return;
  publish('waiting');
  await new Promise<void>(resolve => {
    const idle = () => { idleListeners.delete(idle); resolve(); };
    idleListeners.add(idle);
  });
}

export function performAppUpdate(): Promise<void> {
  if (running) return running;
  if (!snapshot.required || !applyUpdate || snapshot.phase === 'updating') return Promise.resolve();
  running = (async () => {
    try {
      while (true) {
        await waitForActiveWork();
        publish('saving');
        // Finish every transaction before activating a worker or reloading.
        const results = await Promise.allSettled([...drafts.values()].map(save => Promise.resolve().then(save)));
        if (results.some(result => result.status === 'rejected')) {
          throw new Error('Draft belum berhasil disimpan. Periksa ruang penyimpanan perangkat, lalu coba lagi.');
        }
        // Capture fresh drafts if a background job started during the transaction.
        if (blockers.size) continue;
        publish('updating');
        await applyUpdate!();
        break;
      }
    } catch (error) {
      publish('error', error instanceof Error ? error.message : 'Pembaruan gagal. Silakan coba lagi.');
    } finally {
      running = null;
    }
  })();
  return running;
}
