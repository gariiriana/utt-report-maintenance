import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/AuthContext';
import { blockAppUpdate, registerUpdateDraft } from '@/utils/appUpdate';
import { draftStorage } from '@/utils/draftStorage';
import { mergeRecovery, preserveDraftAssets, recoveryKey, validRecovery } from '@/utils/updateRecovery';

let tabId: string | null = null;
function getTabId() {
  if (tabId) return tabId;
  const storageKey = 'dwimitra_update_tab';
  // Failure is intentionally propagated: updating without a recoverable key is unsafe.
  tabId = sessionStorage.getItem(storageKey) || crypto.randomUUID();
  sessionStorage.setItem(storageKey, tabId);
  return tabId;
}

export function useAppUpdateBlocker(busy: boolean) {
  useLayoutEffect(() => busy ? blockAppUpdate() : undefined, [busy]);
}

/** One-shot, per-user/per-tab recovery; normal autosave behavior stays unchanged. */
export function useAppUpdateDraft<T extends object>(
  form: string, data: T, restore: (data: T) => void | Promise<void>, ready = true,
) {
  const { user } = useAuth();
  const latest = useRef({ data, restore });
  useLayoutEffect(() => { latest.current = { data, restore }; });
  const [restoring, setRestoring] = useState(true);
  const uid = user?.uid;
  const pathname = window.location.pathname;

  useEffect(() => {
    if (!uid) { setRestoring(false); return; }
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      try {
        const key = recoveryKey(getTabId(), uid, pathname, form);
        const saved = await draftStorage.get(key);
        if (cancelled) return;
        if (validRecovery<T>(saved)) {
          await latest.current.restore(mergeRecovery(latest.current.data, saved.value));
          await draftStorage.remove(key);
        }
      } catch (error) {
        console.error('[AppUpdate] Failed to restore draft:', error);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, [uid, pathname, form, ready]);

  useLayoutEffect(() => {
    if (!uid || !ready || restoring) return;
    // Resolve storage access on click so a disabled sessionStorage cannot crash the form.
    return registerUpdateDraft(`${uid}:${pathname}:${form}`, async () => {
      const key = recoveryKey(getTabId(), uid, pathname, form);
      const value = await preserveDraftAssets(latest.current.data);
      await draftStorage.set(key, { version: 1, savedAt: Date.now(), value });
    });
  }, [uid, pathname, form, ready, restoring]);
  useAppUpdateBlocker(Boolean(uid) && (restoring || !ready));
  return restoring;
}
