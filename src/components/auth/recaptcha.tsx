"use client";

import { useEffect, useRef, useCallback } from "react";
import Script from "next/script";

interface RecaptchaProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: () => void;
  onLoad?: () => void;
}

declare global {
  interface Window {
    grecaptcha: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark";
          size?: "normal" | "compact";
        }
      ) => number;
      reset: (widgetId?: number) => void;
      getResponse: (widgetId?: number) => string;
    };
    onRecaptchaLoad?: () => void;
  }
}

export function Recaptcha({ siteKey, onVerify, onExpire, onError, onLoad }: RecaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<number | null>(null);
  const isRenderedRef = useRef(false);

  const renderRecaptcha = useCallback(() => {
    if (
      !containerRef.current ||
      isRenderedRef.current ||
      !window.grecaptcha
    ) {
      return;
    }

    try {
      widgetIdRef.current = window.grecaptcha.render(containerRef.current, {
        sitekey: siteKey,
        callback: onVerify,
        "expired-callback": onExpire,
        "error-callback": onError,
        theme: "light",
        size: "normal",
      });
      isRenderedRef.current = true;
      // Notify parent that reCAPTCHA loaded successfully
      onLoad?.();
    } catch (error) {
      // Widget might already be rendered
      console.warn("[reCAPTCHA] Render error:", error);
    }
  }, [siteKey, onVerify, onExpire, onError, onLoad]);

  useEffect(() => {
    // Set up the callback for when the script loads
    window.onRecaptchaLoad = renderRecaptcha;

    // If grecaptcha is already loaded, render immediately
    if (window.grecaptcha) {
      renderRecaptcha();
    }

    return () => {
      window.onRecaptchaLoad = undefined;
    };
  }, [renderRecaptcha]);

  return (
    <>
      <Script
        src={`https://www.google.com/recaptcha/api.js?onload=onRecaptchaLoad&render=explicit`}
        strategy="lazyOnload"
      />
      <div ref={containerRef} className="flex justify-center" />
    </>
  );
}

/**
 * Hook to check if reCAPTCHA is enabled
 */
export function useRecaptchaEnabled(): boolean {
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  return !!siteKey;
}

/**
 * Get the reCAPTCHA site key
 */
export function getRecaptchaSiteKey(): string | null {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || null;
}
