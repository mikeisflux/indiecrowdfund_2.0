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
      /safari-web-extension:\/\//,
      // Browser-injected scripts (Firefox reader mode, Brave's copy, etc.)
      /__firefox__/,
      /window\.__firefox__/,
      // iOS Safari / in-app browser userscripts run under a "user-script"
      // pseudo-URL. The Twitter/X in-app browser injects a layout shim
      // (updateGapFiller / updateFooterPositions) that throws ReferenceErrors
      // for its own undefined globals (CONFIG, etc.). Not our code.
      /user-script/,
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
      // React reconciliation vs page translator: when Chrome / Edge / Google
      // Translate / DeepL replaces text nodes with their wrapped versions,
      // React's virtual DOM no longer matches the real DOM. The next state
      // update calls insertBefore/removeChild against a node that's no
      // longer where React thinks it is and throws NotFoundError. Always
      // an extension or built-in translator interfering — never a bug in
      // our code. Edge 148's built-in translator is a known repeat
      // offender. Stack always lands deep in React's commit phase.
      /Failed to execute 'insertBefore' on 'Node'/,
      /Failed to execute 'removeChild' on 'Node'/,
      /NotFoundError.*The node (before which|to be removed)/,
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
      // Zotero Connector + similar research-tool extensions throw
      // "Failed to send message X to background page" when their
      // background service-worker dies and the content-script can't
      // reach it. Same root cause as the Firefox/Chrome ext noise
      // above (other people's code, not ours).
      /Zotero Connector/,
      /Failed to send message .* to background page/,
      // MetaMask + other crypto wallet extensions inject providers
      // that throw on every page load when the wallet is locked or
      // the user disabled it. Not our bug.
      /MetaMask/i,
      /Wallet not initialized/,
      // Microsoft Office / Outlook web add-in service throws
      // "Object Not Found Matching Id:N, MethodName:update, ParamCount:N"
      // as an unhandled rejection when the add-in loses its host context
      // (e.g. the user navigates away from the Outlook tab while a
      // background message-update call is in flight). The error originates
      // entirely inside Microsoft's office.js, not our code.
      /Object Not Found Matching Id:\d+, MethodName:/i,
      // DuckDuckGo Privacy Browser (UA contains "Ddg/") injects a
      // content script that talks to its background extension via
      // `runtime.sendMessage()`. When the iOS tab context becomes
      // invalid mid-navigation (page hidden, BFCache restore, app
      // backgrounded), their own script throws
      // "Invalid call to runtime.sendMessage(). Tab not found." as
      // an unhandled rejection. Not our code, not actionable, but
      // very loud on iPhone DDG sessions.
      /Invalid call to runtime\.sendMessage/i,
      /runtime\.sendMessage.*Tab not found/i,
      // Brave on iOS injects a reader-mode detector that touches
      // `n.standardSelectors`; when the page's DOM doesn't match its
      // expectations its own `n` is undefined and the script throws.
      // Same class as the __firefox__ Brave-injection noise above.
      /standardSelectors/,
      // Babel-compiled third-party libraries (extensions, in-app
      // browsers, ad SDKs) sometimes call their own classes as plain
      // functions and hit this Babel-generated guard. Never our code —
      // our bundles only contain working ES classes.
      /Cannot call a class as a function/,
      // Browser-native fetch / AbortSignal.timeout firing on flaky
      // user wifi or a backgrounded tab. Same class as AbortError +
      // "The operation was aborted" above — user-side, not actionable.
      /TimeoutError.*operation timed out/i,
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

    // Injected third-party scripts (in-app browser layout shims, iOS
    // userscripts, media-hooking Safari extensions) throw ReferenceErrors
    // for globals they expect but we never define — CONFIG, EmptyRanges,
    // and the like. A genuine error in our compiled app always has at
    // least one stack frame in our /_next/ bundle; an injected script's
    // stack never does. So a ReferenceError with no /_next/ frame is
    // third-party noise, not our bug.
    const isInjectedReferenceError = (message?: string, stack?: string): boolean => {
      if (!message) return false;
      const isReferenceError = /Can't find variable:|\bis not defined\b/.test(message);
      if (!isReferenceError) return false;
      return !stack || !stack.includes("/_next/");
    };

    const handleError = (event: ErrorEvent) => {
      if (!event.message) return;
      if (isBrowserNoise(event.message, event.error?.stack)) return;
      if (event.error?.name === "ChunkLoadError") return;
      if (isInjectedReferenceError(event.message, event.error?.stack)) return;
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
      if (isInjectedReferenceError(message, stack)) return;
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
        // Marketplace + per-project chargeback card POST: 400 means the
        // card was declined during vault add / validate, a billing field
        // was empty, or the name failed our validation. The edit page
        // surfaces the gateway / validation message as a toast and lets
        // the creator try a different card.
        requestUrl.includes("/api/creator/marketplace-chargeback-card") ||
        /\/api\/projects\/[^/]+\/chargeback-card$/.test(requestUrl) ||
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
        // /api/backer/marketplace-purchases/[id]/download 404 means
        // the book's pdfFileUrl is empty or the underlying R2 file is
        // missing — a data issue with that specific book, not a backend
        // regression. The Digital Library UI surfaces the failure to
        // the buyer; the admin still gets the row-level detail in
        // pm2 logs (the route logs the R2 key + directory listing).
        (response.status === 404 && /\/api\/backer\/marketplace-purchases\/[^/]+\/download/.test(requestUrl)) ||
        // /api/projects/vanity/[creator]/[slug] returns 404 for any
        // project that isn't LIVE / FUNDED / FAILED — by design, the
        // public view shouldn't expose drafts, pending review, or
        // cancelled campaigns. Creators previewing their own pre-launch
        // project on the public URL trigger this expected 404. Not
        // actionable.
        (response.status === 404 && /\/api\/projects\/vanity\/[^/]+\/[^/?]+/.test(requestUrl)) ||
        // /api/projects/slug/[slug] backs the project edit page. It returns
        // 404 for DRAFT/SUBMITTED projects when the requester isn't the
        // creator/admin/collaborator — which happens when a creator opens
        // their edit link in an in-app browser (Facebook, etc.) that didn't
        // carry over their session cookie. The 404 is the route correctly
        // protecting a private draft, not a backend bug.
        (response.status === 404 && /\/api\/projects\/slug\/[^/?]+(\?|$)/.test(requestUrl)) ||
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
        requestUrl.includes("/api/backer/dashboard") ||
        requestUrl.includes("/api/user/vanity-url") ||
        requestUrl.includes("/api/user/notifications") ||
        requestUrl.includes("/api/messages") ||
        requestUrl.includes("/api/creator/dashboard") ||
        requestUrl.includes("/api/creator/email/threads") ||
        // /api/collaborations is fired by the dashboard's
        // CollaborationsTab on mount. When a user lands on /dashboard
        // straight from /choose-role (signin / role selection flow),
        // the session cookie may not be fully hydrated by the time
        // the tab mounts, so the first fetch 401s. Self-healing on
        // next render. Not actionable.
        requestUrl.includes("/api/collaborations") ||
        // /api/chat/rooms/resolve is fired by the chat widget on every
        // project page so it can prefetch the room id when a logged-in
        // user clicks Message Creator. Visitors who aren't signed in
        // get 401 here by design; the widget falls back to a "sign in
        // to message" prompt. Not actionable.
        requestUrl.includes("/api/chat/rooms/resolve") ||
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
        // /api/user/notifications PATCH/DELETE 403 = CSRF cookie
        // expired between page load and the click that fired the
        // mark-as-read. The proxy now rolls the cookie forward on
        // every request (30d maxAge) but pre-existing tabs still
        // hold the old short-lived cookie. Self-healing on next
        // page load. Not actionable.
        requestUrl.includes("/api/user/notifications") ||
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
        requestUrl === "/api/upload" || requestUrl.endsWith("/api/upload") ||
        // Creator email compose 403: the sender doesn't have a LIVE
        // project or a project with prelaunchActive=true (or is a
        // collaborator without canManageCommunity). The compose form
        // surfaces the rejection inline as a toast — admin-logging
        // every "tried to email before launch" is noise, not a bug.
        requestUrl.includes("/api/creator/email/compose") ||
        // Chargeback-card 403: same CSRF-cookie-expired-on-stale-tab
        // class as /api/user/notifications above. The edit page surfaces
        // a toast and the next page load fixes it. Not actionable.
        /\/api\/projects\/[^/]+\/chargeback-card$/.test(requestUrl)
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
        (
          requestUrl.includes("/api/auth/recaptcha") ||
          // /api/auth/session is fired on every page load by NextAuth. A
          // 5xx here is the same transient pm2-reload / nginx-upstream
          // hiccup as /api/auth/recaptcha — the next page load self-heals
          // because the session cookie is still valid client-side.
          requestUrl.includes("/api/auth/session") ||
          // /api/support/chat calls Anthropic. Transient 5xx / 529
          // overload from upstream is out of our control; the chat
          // widget already shows a graceful fallback message and the
          // next user turn self-heals when Anthropic recovers.
          requestUrl.includes("/api/support/chat") ||
          isStatsPoller5xx ||
          isDashboardPoller5xx ||
          isProjectDetailPoller5xx
        );
      const isInternal = !requestUrl || requestUrl.includes("/api/error-report") || requestUrl.includes("_next/") || requestUrl.includes("_rsc") || isExpected400 || isExpected404 || isExpected401 || isExpected403 || isExpected5xx;
      // Page-route (non /api/*) fetches caught by this interceptor are
      // almost always Next.js RSC prefetches or navigation aborts —
      // hovering a <Link>, closing a tab mid-route-change, or following
      // a redirect chain that briefly tags as 4xx. Real page navigations
      // surface their own error UI (the not-found.tsx page) and we
      // can't do anything actionable with the noise. Only API
      // responses (which back data fetches) belong in admin logs.
      const isPageRouteFetch = !requestUrl.startsWith("/api/") && !requestUrl.startsWith("http");
      if (response.status >= 400 && !isInternal && !isPageRouteFetch) {
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
