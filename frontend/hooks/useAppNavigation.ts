import { useCallback, useEffect, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react';
import {
  navigationSnapshot, pathParts, readFolderPath, readNavigationValue, setMenuPath,
  subscribeNavigation, updateNavigation, writeFolderPath, writeNavigationValue,
} from '@/utils/appNavigation';

const MENU_PATHS: Record<string, string> = {
  admin: 'dashboard', notifications: 'notifikasi', report: 'buat-laporan',
  documents: 'management-file', files: 'management-file', management_files: 'management-file',
  arsip_dokumen: 'arsip-dokumen', delete_requests: 'pengajuan-hapus',
  abnormal_findings: 'temuan-abnormal', manual_abnormal: 'input-abnormal-manual',
  absen_tbm: 'absen-tbm', tbm: 'absen-tbm', absen_induction: 'absen-induction', induction: 'absen-induction',
  ptw: 'ptw', corrective: 'corrective-maintenance', corrective_archive: 'arsip-standby',
  hse_archive: 'arsip-k3-hse', finding_archive: 'arsip-temuan', pir: 'report-pir',
  pm_schedule: 'pm-schedule', monthly_report: 'monthly-report', sop_eop: 'sop-eop',
  mop_bilingual: 'bilingual-mop', boq: 'master-asset-boq', berita_acara: 'ba-report',
  inspection: 'inspeksi-hse', findings: 'input-temuan-k3', findings_archive: 'arsip-temuan-hse',
  iso: 'dokumen-divisi', workflow: 'mop-workflow', monitoring: 'monitoring',
  summary: 'ringkasan-progres', input: 'input-progres',
};

export function useMenuNavigation<T extends string>(fallback: T, allowed: readonly string[]): [T, Dispatch<SetStateAction<T>>] {
  const href = useSyncExternalStore(subscribeNavigation, navigationSnapshot);
  const segment = pathParts(new URL(href))[0];
  const active = (allowed.find(id => (MENU_PATHS[id] || id) === segment) || fallback) as T;
  const allowedKey = allowed.join('|');

  useEffect(() => {
    if (!allowed.some(id => (MENU_PATHS[id] || id) === segment)) {
      updateNavigation(url => setMenuPath(url, MENU_PATHS[fallback] || fallback), true);
    }
  }, [segment, fallback, allowedKey]);

  const setActive = useCallback<Dispatch<SetStateAction<T>>>(value => {
    // Voice-command listeners may retain this callback from the initial render.
    // Read the current (possibly batched) URL instead of a captured active tab.
    updateNavigation(url => {
      const ids = allowedKey.split('|');
      const current = (ids.find(id => (MENU_PATHS[id] || id) === pathParts(url)[0]) || fallback) as T;
      const next = typeof value === 'function' ? value(current) : value;
      if (!ids.includes(next) || next === current) return;
      setMenuPath(url, MENU_PATHS[next] || next);
    });
  }, [fallback, allowedKey]);
  return [active, setActive];
}

export function useNavigationState<T extends string | number | boolean | null>(
  key: string, fallback: T, allowed?: readonly T[],
): [T, Dispatch<SetStateAction<T>>] {
  const href = useSyncExternalStore(subscribeNavigation, navigationSnapshot);
  const url = new URL(href);
  const owner = pathParts(url)[0];
  const value = readNavigationValue(url, key, fallback, allowed);
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(next => {
    updateNavigation(draft => {
      const previous = readNavigationValue(draft, key, fallback, allowed);
      writeNavigationValue(draft, key, typeof next === 'function' ? next(previous) : next, fallback);
    }, false, owner);
  }, [key, fallback, owner, allowed?.join('|')]);
  return [value, setValue];
}

export function useFolderNavigation(index: number, labels: readonly string[]): [string | null, Dispatch<SetStateAction<string | null>>] {
  const href = useSyncExternalStore(subscribeNavigation, navigationSnapshot);
  const url = new URL(href);
  const owner = pathParts(url)[0];
  const value = readFolderPath(index, labels, url);
  const setValue = useCallback<Dispatch<SetStateAction<string | null>>>(next => {
    updateNavigation(draft => {
      const previous = readFolderPath(index, labels, draft);
      writeFolderPath(draft, index, typeof next === 'function' ? next(previous) : next, labels);
    }, false, owner);
  }, [index, owner, labels]);
  return [value, setValue];
}
