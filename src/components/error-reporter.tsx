"use client";

import { useEffect } from "react";

/**
 * Client-side error reporter that catches unhandled errors,
 * promise rejections, and HTTP error responses (4xx/5xx),
 * and sends them to /api/error-report.
 *
 * Mount once in the root layout.
 */
export function ErrorReporter() {
  useEffect(() => {
    // Suppress ALL error reporting from automated monitoring bots.
    // These agents probe dozens of optional paths per run (ads.txt,
    // sellers.json, /.well-known/*, llms.txt, dsrdelete.json, etc.)
    // and generate massive noise in Sentinel that drowns out real
    // user errors. Nothing a monitoring bot reports is actionable.
    const ua = navigator.userAgent || "";
    const MONITORING_BOT_UA_PATTERNS = [
      /PTST\//i,              // WebPageTest
      /WebPageTest/i,
      /Pingdom/i,
      /StatusCake/i,
      /UptimeRobot/i,
      /GTmetrix/i,
      /Site24x7/i,
      /AhrefsBot/i,
      /SemrushBot/i,
      /Dotcom-Monitor/i,
      /New ?Relic/i,
      /DataDog/i,
      /Datadog/i,
      /Sucuri/i,
    ];
    if (MONITORING_BOT_UA_PATTERNS.some((p) => p.test(ua))) {
      return; // No listeners mounted at all
    }

    const reportError = (message: string, stack?: string, metadata?: Record<string, unknown>) => {
      fetch("/api/error-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          stack,
          url: window.location.href,
          metadata: {
            source: "window-error-listener",
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            ...metadata,
          },
        }),
      }).catch(() => {
        // Silently fail — don't cause more errors
      });
    };

    // Patterns that indicate browser/extension/third-party noise, not our code
    const BROWSER_NOISE_PATTERNS = [
      // Generic cross-origin error with no useful info
      /^Script error\.?$/,
      // Chunk load failures — stale cached page after deploy; global-error.tsx auto-reloads
      /Loading chunk/,
      /ChunkLoadError/,
      // Browser extensions
      /moz-extension:\/\//,
      /chrome-extension:\/\//,
      /safari-extension:\/\//,
      // Browser-injected scripts (Firefox reader mode, Brave's copy, etc.)
      /__firefox__/,
      /window\.__firefox__/,
      // Facebook in-app browser WebView lifecycle errors
      /Java object is gone/,
      /Error invoking postMessage/,
      // Facebook in-app browser stripping iOS WebKit bridge from injected scripts
      /window\.webkit\.messageHandlers/,
      /webkit\.messageHandlers/,
      // Browser feature detection noise
      /Permission denied to access property/,
      /cross-origin object/,
      // ResizeObserver loop limit — benign browser warning, not a real error
      /ResizeObserver loop/,
      // Network aborts from users navigating away
      /The operation was aborted/,
      /AbortError/,
      // iOS Safari privacy-mode quota errors
      /QuotaExceededError/,
      // Google reCAPTCHA widget timeouts — their service, not ours
      /reCAPTCHA Timeout/,
      /grecaptcha.*timeout/i,
      // TipTap/ProseMirror NoModificationAllowedError — contentEditable
      // interference from browser extensions (Grammarly, LanguageTool, etc.)
      /NoModificationAllowedError/,
    ];

    // Paths that automated scanners / ad networks / browser feature-detection
    // routinely probe that we don't serve. Bot-probe 404s on these paths
    // are expected and should never be logged as errors.
    const IGNORED_404_PATH_PATTERNS = [
      // Catch-all for /.well-known/* — RFC 8615 reserved path that is
      // ONLY hit by automation (FedCM, Privacy Sandbox, Apple App Site
      // Association, Android Asset Links, Fediverse WebFinger, ACME,
      // security.txt, GPC, change-password, etc.). Real users never
      // navigate to /.well-known/anything. 404s here are always bot probes.
      /\/\.well-known\//,
      // IAB / programmatic ads (WebPageTest, Pingdom, ad network probes)
      /\/ads\.txt$/,
      /\/sellers\.json$/,
      /\/app-ads\.txt$/,
      // LLM / AI crawler directives
      /\/llms\.txt$/,
      /\/llms-full\.txt$/,
      // Apple / Android app deep-link / wallet probes
      /\/apple-app-site-association$/,
      // Random bot-scan targets at the site root
      /\/humans\.txt$/,
      /\/crossdomain\.xml$/,
      /\/clientaccesspolicy\.xml$/,
      /\/browserconfig\.xml$/,
      /\/manifest\.json$/,
      /\/site\.webmanifest$/,
      /\/gpc\.json$/,
    ];

    const isBrowserNoise = (message?: string, stack?: string): boolean => {
      const text = `${message || ""} ${stack || ""}`;
      return BROWSER_NOISE_PATTERNS.some((pattern) => pattern.test(text));
    };

    const handleError = (event: ErrorEvent) => {
      if (!event.message) return;
      if (isBrowserNoise(event.message, event.error?.stack)) return;
      if (event.error?.name === "ChunkLoadError") return;
      reportError(
        event.message || "Unhandled error",
        event.error?.stack
      );
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      const error = event.reason;
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      if (isBrowserNoise(message, stack)) return;
      if (error instanceof Error && error.name === "ChunkLoadError") return;
      reportError(`Unhandled Promise Rejection: ${message}`, stack);
    };

    // Intercept fetch to report HTTP 4xx/5xx errors to admin error logs
    const originalFetch = window.fetch;
    window.fetch = async function (...args: Parameters<typeof window.fetch>) {
      let response: Response;
      try {
        response = await originalFetch.apply(this, args);
      } catch (err) {
        // Network failures, AbortErrors, etc. — let them propagate naturally
        // but don't report them (the caller's catch handler should deal with these)
        throw err;
      }

      // Report 4xx/5xx errors (but skip the error-report endpoint itself to avoid loops)
      const input = args[0];
      const requestUrl =
        typeof input === "string" ? input
        : input instanceof URL ? input.href
        : input instanceof Request ? input.url
        // Fallback: duck-type check for Request-like objects (cross-realm instanceof can fail)
        : (typeof input === "object" && input !== null && "url" in input && typeof (input as Record<string, unknown>).url === "string")
          ? (input as Record<string, unknown>).url as string
        : "";
      // Skip: error-report endpoint (avoid loops), Next.js internal requests, empty/unresolvable URLs,
      // expected 400s from token-based flows (verify-email), 404s from surveys without a survey record,
      // and 401s from user-specific endpoints hit by unauthenticated visitors
      const isExpected400 = response.status === 400 && requestUrl.includes("/api/user/verify-email");
      // Bot-probe 404s on well-known paths that we don't serve (ads.txt,
      // llms.txt, /.well-known/*, etc.) — WebPageTest, Pingdom, ad network
      // scanners, and FedCM/Privacy Sandbox feature detection all probe
      // these routinely.
      const isBotProbe404 = response.status === 404 &&
        IGNORED_404_PATH_PATTERNS.some((p) => p.test(requestUrl));
      const isExpected404 =
        (response.status === 404 && requestUrl.includes("/api/surveys/") && requestUrl.includes("/respond")) ||
        isBotProbe404;
      const isExpected401 = response.status === 401 && requestUrl.includes("/api/user/following");
      // These endpoints never return 403 themselves — a 403 means the bot blocker blocked the IP
      // digital-files/stream 403 = access denied for thumbnail (shows fallback icon, not a crash)
      const isExpected403 = response.status === 403 && (
        requestUrl.includes("/collaborators/me") ||
        requestUrl.includes("/api/backer/digital-files/stream") ||
        (requestUrl.includes("/api/projects/") && requestUrl.endsWith("/stats")) ||
        requestUrl.includes("/api/auth/session") ||
        (requestUrl.includes("/api/projects/") && requestUrl.endsWith("/comments"))
      );
      // /api/auth/recaptcha 5xx is transient (nginx upstream briefly down during pm2 reload);
      // the client retries with backoff and falls back to disabled, so failures here are
      // deploy-window noise rather than actionable errors.
      const isExpected5xx = response.status >= 500 && response.status < 600 &&
        requestUrl.includes("/api/auth/recaptcha");
      const isInternal = !requestUrl || requestUrl.includes("/api/error-report") || requestUrl.includes("_next/") || requestUrl.includes("_rsc") || isExpected400 || isExpected404 || isExpected401 || isExpected403 || isExpected5xx;
      if (response.status >= 400 && !isInternal) {
        reportError(
          `HTTP ${response.status} ${response.statusText}: ${requestUrl}`,
          undefined,
          {
            source: "fetch-error-interceptor",
            statusCode: response.status,
            requestUrl,
            referrer: document.referrer || undefined,
          }
        );
      }

      return response;
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      window.fetch = originalFetch;
    };
  }, []);

  return null;
}
