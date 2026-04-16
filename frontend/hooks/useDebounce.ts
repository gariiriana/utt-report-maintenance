import { useEffect, useRef, useCallback, useState } from 'react';

/**
 * useDebounce — debounces a value update.
 * Use this when you want to delay reacting to a fast-changing value.
 *
 * @example
 * const debouncedSearch = useDebounce(searchTerm, 500);
 * useEffect(() => { fetchResults(debouncedSearch); }, [debouncedSearch]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * useDebouncedCallback — debounces a callback function.
 * Use this when you want to prevent a function from firing too rapidly
 * (e.g., API calls triggered by button clicks or input changes).
 *
 * @param callback - The function to debounce
 * @param delay    - Milliseconds to wait after the last call before firing
 *
 * @example
 * const debouncedFetch = useDebouncedCallback(() => fetchLocation(), 800);
 * <button onClick={debouncedFetch}>Refresh Lokasi</button>
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): { debouncedFn: (...args: Parameters<T>) => void; isPending: boolean; cancel: () => void } {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, setIsPending] = useState(false);

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

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      setIsPending(false);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { debouncedFn, isPending, cancel };
}
