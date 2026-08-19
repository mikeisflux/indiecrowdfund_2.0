/**
 * Web Storage that can't take a page down.
 *
 * `localStorage` / `sessionStorage` are not always usable, and they fail in
 * two different shapes depending on the browser:
 *
 *   - Safari Private Browsing and storage-quota situations let you read the
 *     object but THROW on write.
 *   - Android WebViews with storage disabled (and some embedded browsers)
 *     expose the property as `null`, so the failure is a TypeError on
 *     property access — "Cannot read properties of null (reading 'setItem')".
 *
 * The second shape is the one that bit us: code guarded with try/catch around
 * a read was fine, while an unguarded write in a click handler threw, aborted
 * the handler before its setState, and left the UI stuck — a dismiss button
 * that did nothing, tapped over and over.
 *
 * Every accessor here returns a value or swallows the failure. Storage is a
 * convenience; nothing user-facing should depend on it working.
 */

type StorageKind = "local" | "session";

function store(kind: StorageKind): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    // Property access itself can throw (some browsers throw a SecurityError
    // when cookies are blocked) and can also legitimately be null.
    const s = kind === "local" ? window.localStorage : window.sessionStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

export function readStorage(kind: StorageKind, key: string): string | null {
  try {
    return store(kind)?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** @returns whether the value was actually persisted. */
export function writeStorage(kind: StorageKind, key: string, value: string): boolean {
  try {
    const s = store(kind);
    if (!s) return false;
    s.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(kind: StorageKind, key: string): void {
  try {
    store(kind)?.removeItem(key);
  } catch {
    // Nothing to do — the value either isn't there or can't be reached.
  }
}
