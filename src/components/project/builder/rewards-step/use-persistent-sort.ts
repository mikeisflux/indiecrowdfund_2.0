"use client";

import { useState, useEffect, useCallback } from "react";

// The sort picker on the Items / Reward tiers / Add-ons tabs was plain
// component state, so it snapped back to "Manual order" every time the tab
// unmounted — switching tabs, saving, or navigating away and back. Persist the
// creator's choice so it stays put.
//
// Storage is best-effort: reading localStorage throws outright when storage is
// blocked (Safari private mode, embedded webviews), so every access is guarded
// and simply falls back to in-memory state.
export function usePersistentSort<T extends string>(
  storageKey: string,
  fallback: T,
  isValid: (value: string) => value is T
): [T, (value: T) => void] {
  // Always start from the fallback so server and client render the same thing;
  // the stored value is applied after mount to avoid a hydration mismatch.
  const [sort, setSortState] = useState<T>(fallback);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (stored && isValid(stored)) setSortState(stored);
    } catch {
      // Storage unavailable — keep the default.
    }
    // isValid is a stable type guard defined at module scope in callers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const setSort = useCallback(
    (value: T) => {
      setSortState(value);
      try {
        window.localStorage.setItem(storageKey, value);
      } catch {
        // Storage unavailable — the choice still applies for this session.
      }
    },
    [storageKey]
  );

  return [sort, setSort];
}
