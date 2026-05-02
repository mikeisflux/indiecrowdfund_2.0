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
      // Facebook in-app browser autofill bridge — their injected JS
      // (setContactAutofillValuesFromBridge) sometimes hits an undefined
      // entry while reading `value`, throws inside their own code. Not ours.
      /setContactAutofillValuesFromBridge/,
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
      // Generic NetworkError fetch rejections — usually a user with flaky
      // wifi or a VPN drop in the middle of a CDN/poll request. Not our
      // bug, and we already retry where it matters.
      /NetworkError when attempting to fetch resource/,
      /TypeError: Failed to fetch/,
      /TypeError: NetworkError/,
      /Load failed/,
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

    // Intercept fetch to report HTTP 4xx/5xx errors to admin error logs.
    // Facebook's in-app browser (FB_IAB) makes window.fetch non-writable
    // to prevent monkey-patching, so guard the assignment — if it
    // throws, we just skip the fetch interception (network errors will
    // still surface through normal handlers, just not auto-reported).
    const originalFetch = window.fetch;
    let fetchPatched = false;
    const patchedFetch = async function (this: unknown, ...args: Parameters<typeof window.fetch>) {
      let response: Response;
      try {
        response = await originalFetch.apply(window, args);
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
      // 400s from user-input validation endpoints — the UI already surfaces
      // the error as a toast, so admin-logging them is pure duplication.
      // Stats poller is read-only, polled every few seconds from project
      // detail / prelaunch / dashboard. Transient 4xx/5xx (bot probes
      // malforming the URL, upstream saturation during attack bursts,
      // pm2 reload timing) is not actionable — the UI just shows stale
      // numbers for one poll cycle and self-heals.
      const isStatsPollerPath =
        /\/api\/projects\/(vanity\/[^/]+\/[^/]+|[^/]+)\/stats$/.test(requestUrl);
      const isExpected400 = response.status === 400 && (
        requestUrl.includes("/api/user/verify-email") ||
        requestUrl.includes("/api/user/profile") ||
        requestUrl.includes("/api/user/settings") ||
        (requestUrl.includes("/api/surveys/") && requestUrl.includes("/respond")) ||
        // Project submit returns 400 with `validationErrors: string[]` when
        // the creator's draft is missing required fields (title length,
        // image, rewards, chargeback card, etc.). The UI surfaces those
        // back to the creator inline — admin-logging them is duplicate
        // noise from normal user-input validation.
        /\/api\/projects\/[^/]+\/submit$/.test(requestUrl) ||
        // Creator marketplace files: DELETE returns 400 with
        // "Cannot delete file that is in use by a book" when the
        // creator tries to remove a PDF that's still referenced by an
        // active book record. The edit UI surfaces the message inline;
        // admin-logging it is the same kind of user-input noise.
        requestUrl.includes("/api/creator/marketplace/files") ||
        // PaymentCloud confirm-nmi: 400 means the card was declined,
        // the pledge has already moved on (back/forward retry hits an
        // already-completed/cancelled pledge), or the card form was
        // submitted with stale state. The pledge UI surfaces the gateway
        // error message ("Card was declined", "Insufficient funds", etc.)
        // inline as a toast and lets the user try a different card.
        // Admin-logging every decline is noise — real backend regressions
        // here surface as 5xx, not 4xx.
        /\/api\/pledges\/[^/]+\/confirm-nmi$/.test(requestUrl) ||
        /\/api\/marketplace\/purchase\/[^/]+\/confirm-nmi$/.test(requestUrl) ||
        isStatsPollerPath
      );
      // Bot-probe 404s on well-known paths that we don't serve (ads.txt,
      // llms.txt, /.well-known/*, etc.) — WebPageTest, Pingdom, ad network
      // scanners, and FedCM/Privacy Sandbox feature detection all probe
      // these routinely.
      const isBotProbe404 = response.status === 404 &&
        IGNORED_404_PATH_PATTERNS.some((p) => p.test(requestUrl));
      const isExpected404 =
        (response.status === 404 && requestUrl.includes("/api/surveys/") && requestUrl.includes("/respond")) ||
        isBotProbe404;
      // 401s from authed-only endpoints fired by client-side useEffects before the
      // session handshake completes (or after a silent session expiry on long-lived
      // tabs) are expected and self-healing — the page retries once hydrated or
      // bounces to login. Not actionable, just admin-log noise.
      // The edit page fans out multiple sub-resource fetches in parallel; suppress
      // any 401 on /api/projects/{id}/<sub-resource> since they all share the same
      // pre-hydration timing issue.
      const isEditPageSubResource401 =
        response.status === 401 && /\/api\/projects\/[^/]+\/[^/?]+/.test(requestUrl);
      const isExpected401 = response.status === 401 && (
        requestUrl.includes("/api/user/following") ||
        requestUrl.includes("/api/backer/following") ||
        requestUrl.includes("/api/user/vanity-url") ||
        requestUrl.includes("/api/user/notifications") ||
        requestUrl.includes("/api/messages") ||
        requestUrl.includes("/api/creator/dashboard") ||
        requestUrl.includes("/api/creator/email/threads") ||
        isEditPageSubResource401
      );
      // These endpoints never return 403 themselves — a 403 means the bot blocker blocked the IP
      // digital-files/stream 403 = access denied for thumbnail (shows fallback icon, not a crash)
      const isExpected403 = response.status === 403 && (
        requestUrl.includes("/collaborators/me") ||
        requestUrl.includes("/api/backer/digital-files/stream") ||
        (requestUrl.includes("/api/projects/") && requestUrl.endsWith("/stats")) ||
        requestUrl.includes("/api/auth/session") ||
        requestUrl.includes("/api/auth/recaptcha") ||
        (requestUrl.includes("/api/projects/") && requestUrl.endsWith("/comments")) ||
        // Survey respond 403: user logged into a different account than
        // the one that owns the pledge (or pledge is not COMPLETED).
        // Server behavior is correct — the UI surfaces a helpful message.
        // Not an actionable backend error.
        (requestUrl.includes("/api/surveys/") && requestUrl.includes("/respond")) ||
        // Upload 403 fires when the logged-in user isn't the project's
        // creator, an accepted collaborator-with-edit, or an admin
        // (e.g. landed on someone else's edit URL). The server log
        // already records userId/role/projectId for diagnosis; the UI
        // surfaces the rejection as a toast. Not a backend regression.
        requestUrl === "/api/upload" || requestUrl.endsWith("/api/upload")
      );
      // /api/auth/recaptcha 5xx is transient (nginx upstream briefly down during pm2 reload);
      // the client retries with backoff and falls back to disabled, so failures here are
      // deploy-window noise rather than actionable errors.
      //
      // Project stats endpoint is a client-side poller for live funding
      // numbers. Under a scraper attack (see Bot Blocker rate-limit bans
      // for >120 req/min on this path) or a pm2 reload, nginx 504s before
      // the worker answers. The UI just shows slightly stale numbers for
      // one poll cycle and self-heals. Observed 120 events in 40 minutes
      // from a single attack burst — pure log noise.
      const isStatsPoller5xx = response.status >= 500 && response.status < 600 &&
        isStatsPollerPath;
      // Dashboard-mount background pollers (notification bell, email
      // thread counter). These fire on every dashboard load and every
      // few seconds while the page is open. A 5xx during an attack
      // saturation burst or a pm2 reload is transient — the next poll
      // self-heals the UI. The attack window on 2026-04-24 spammed 50+
      // of these in a few seconds before the bot blocker's rate-limit
      // ban caught up; filtering them out keeps Sentinel focused on
      // real regressions.
      const isDashboardPoller5xx = response.status >= 500 && response.status < 600 &&
        (
          requestUrl.includes("/api/user/notifications") ||
          requestUrl.includes("/api/creator/email/threads") ||
          requestUrl.includes("/api/creator/dashboard") ||
          requestUrl.includes("/api/user/following") ||
          requestUrl.includes("/api/messages")
        );
      // Project detail page background fetches: similar projects + comments.
      // Both are read-only, fired on mount, and self-heal on next page load.
      // 5xx during a pm2 reload, scraper attack burst (rate limiter trips
      // 502/503), or transient DB hiccup is expected — the UI degrades to
      // empty similar-projects rail / empty comments list rather than crash.
      // Filtering these matches the same logic we already apply to the stats
      // poller and dashboard pollers above.
      const isProjectDetailPoller5xx = response.status >= 500 && response.status < 600 &&
        (
          requestUrl.includes("/api/projects/similar") ||
          (requestUrl.includes("/api/projects/") && requestUrl.includes("/comments"))
        );
      const isExpected5xx = response.status >= 500 && response.status < 600 &&
        (requestUrl.includes("/api/auth/recaptcha") || isStatsPoller5xx || isDashboardPoller5xx || isProjectDetailPoller5xx);
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

    try {
      window.fetch = patchedFetch;
      fetchPatched = true;
    } catch {
      // Some embedded browsers (Facebook IAB on Android, certain
      // hardened WebViews) define window.fetch as a non-writable
      // property — assigning throws TypeError. We can't intercept
      // fetch errors there; rely on the standard error/rejection
      // handlers below for diagnostics.
    }

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleRejection);
      if (fetchPatched) {
        try {
          window.fetch = originalFetch;
        } catch {
          // Same defense — restore is also forbidden in the same envs.
        }
      }
    };
  }, []);

  return null;
}
