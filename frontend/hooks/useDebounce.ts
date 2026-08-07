// ============================================================================
// FILE: frontend/hooks/useDebounce.ts
// Deskripsi: Custom React Hooks untuk Penghematan Performa Debouncing State & Callback.
//            Mencegah eksekusi panggilan API / pencarian berlebihan saat user mengetik cepat.
// ============================================================================

import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * Hook 1: `useDebounce<T>(value, delay)`
 * Junior Dev Notes: Menunda pembaruan nilai `value` selama `delay` milidetik.
 * Sangat berguna untuk input pencarian teks (search bar).
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    // 1. Set timer penundaan
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // 2. Reset timer jika nilai `value` berubah sebelum `delay` selesai
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * Hook 2: `useDebouncedCallback(callback, delay)`
 * Junior Dev Notes: Menunda pemanggilan sebuah fungsi `callback` agar tidak dipanggil berulang kali.
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): { debouncedFn: (...args: Parameters<T>) => void; isPending: boolean; cancel: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, setIsPending] = useState(false);

  // Fungsi debounced yang akan dipanggil oleh event handler
  const debouncedFn = useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      setIsPending(true);
      timerRef.current = setTimeout(() => {
        callback(...args);
        setIsPending(false);
        timerRef.current = null;
      }, delay);
    },
    [callback, delay]
  );

  // Fungsi pembatalan manual timer
  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setIsPending(false);
    }
  }, []);

  // Cleanup timer saat komponen di-unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { debouncedFn, isPending, cancel };
}
