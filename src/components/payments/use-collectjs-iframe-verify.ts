"use client";

import { useEffect, useRef, useState } from "react";

// Shared verifier for any component that hosts a Collect.js inline
// card form. After scriptReady flips true and the caller has called
// CollectJS.configure(...), this hook waits 1.5s and checks whether
// an <iframe> attached to the ccnumber placeholder div.
//
// Why: when window.CollectJS persists from a prior SPA-route mount
// (pledge form, marketplace purchase form, etc.) the next configure()
// call sometimes silently fails to attach iframes to new selectors —
// the user sees the form chrome but no card-number input.
//
// On first failed attach: tear down `<script#nmi-collectjs>` +
// window.CollectJS and reset scriptReady=false. The caller's
// script-loader effect re-runs and forces a fresh init.
//
// On second failed attach: set loadFailed=true so the caller can
// render a user-visible error ("Card form failed to load. Please
// refresh the page or contact support."). This catches genuine
// failures (CSP blocking, network, browser iframe sandbox quirks)
// instead of leaving the user with an empty bordered box.
//
// Returns:
//   loadFailed: boolean — set to true after two failed attach
//                          attempts; clears whenever an iframe is
//                          observed in the placeholder.
//   resetFailure(): manually clear loadFailed (for retry buttons).
export function useCollectJsIframeVerify({
  scriptReady,
  ccnumberId,
  setScriptReady,
}: {
  scriptReady: boolean;
  ccnumberId: string;
  setScriptReady: (v: boolean) => void;
}): { loadFailed: boolean; resetFailure: () => void } {
  const [loadFailed, setLoadFailed] = useState(false);
  const attemptCountRef = useRef(0);

  useEffect(() => {
    if (!scriptReady) return;
    const verifyTimer = setTimeout(() => {
      const ccDiv = document.getElementById(ccnumberId);
      if (!ccDiv) return;
      if (ccDiv.querySelector("iframe")) {
        // Iframes attached — reset state.
        attemptCountRef.current = 0;
        setLoadFailed(false);
        return;
      }
      if (attemptCountRef.current >= 1) {
        // Second failed attach — surface visible error.
        setLoadFailed(true);
        return;
      }
      // First failed attach — tear down and force reload.
      const existing = document.querySelector<HTMLScriptElement>("script#nmi-collectjs");
      if (existing) existing.remove();
      (window as unknown as { CollectJS?: unknown }).CollectJS = undefined;
      attemptCountRef.current += 1;
      setScriptReady(false);
    }, 1500);
    return () => clearTimeout(verifyTimer);
  }, [scriptReady, ccnumberId, setScriptReady]);

  return {
    loadFailed,
    resetFailure: () => {
      attemptCountRef.current = 0;
      setLoadFailed(false);
    },
  };
}
