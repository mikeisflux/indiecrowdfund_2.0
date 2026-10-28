/**
 * Structured Logger
 * Replaces console.log/error with structured JSON logging via Pino.
 * Falls back to a lightweight implementation when pino is not installed.
 *
 * Usage:
 *   import { logger } from "@/lib/logger";
 *   logger.info({ userId, action: "pledge_created" }, "Pledge created successfully");
 *   logger.error({ err, pledgeId }, "Payment failed");
 */

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

interface LogFn {
  (obj: Record<string, unknown>, msg?: string): void;
  (msg: string): void;
}

interface Logger {
  trace: LogFn;
  debug: LogFn;
  info: LogFn;
  warn: LogFn;
  error: LogFn;
  fatal: LogFn;
  child: (bindings: Record<string, unknown>) => Logger;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) || (process.env.NODE_ENV === "production" ? "info" : "debug");
const currentLevelNum = LOG_LEVELS[currentLevel] || 30;

// Every logger.error / logger.fatal on the server also lands in the
// error tracker (Admin → Error Logs). Until now only console.error and
// client reports got there; every API route that caught its failure,
// logged it here and answered 500 left the tracker with nothing but the
// browser's "HTTP 500" and no server-side cause. Fire-and-forget, Node
// runtime only (the edge bundle must not pull in Prisma), and the
// tracker's own rate limit keeps a storm from flooding the table.
type TrackerModule = typeof import("@/lib/error-tracker");
let trackerPromise: Promise<TrackerModule | null> | null = null;
function loadTracker(): Promise<TrackerModule | null> {
  if (!trackerPromise) {
    // Same rule as instrumentation.ts: the import lives inside a branch
    // that is a build-time constant per runtime, so the edge and browser
    // bundles never pull in Prisma.
    if (process.env.NEXT_RUNTIME === "nodejs") {
      trackerPromise = import("@/lib/error-tracker").catch(() => null);
    } else {
      trackerPromise = Promise.resolve(null);
    }
  }
  return trackerPromise;
}

function forwardToErrorTracker(entry: Record<string, unknown>, level: LogLevel): void {
  try {
    if (typeof window !== "undefined") return;
    // The tracker logs its own failures through console.error, never
    // through this logger, so there is no loop; still, never forward the
    // error-report mirror line (it was captured as a CLIENT error already).
    if (entry.module === "error-report") return;
    const moduleName = typeof entry.module === "string" ? entry.module : undefined;
    const msg = typeof entry.msg === "string" && entry.msg ? entry.msg : "Server error";
    const errField = entry.err as { message?: string; name?: string; stack?: string } | string | undefined;
    const errMessage = typeof errField === "string" ? errField : errField?.message;
    const combined = errMessage && !msg.includes(errMessage) ? `${msg} ${errMessage}`.trim() : msg;
    const error = new Error(combined.slice(0, 1000));
    if (errField && typeof errField === "object" && typeof errField.stack === "string") error.stack = errField.stack;
    if (errField && typeof errField === "object" && typeof errField.name === "string") error.name = errField.name;
    const { time: _t, level: _l, service: _s, msg: _m, err: _e, module: _mod, ...rest } = entry;
    void _t; void _l; void _s; void _m; void _e; void _mod;
    const source = moduleName?.startsWith("cron") ? "CRON" : moduleName?.includes("webhook") ? "API" : "SERVER";
    loadTracker()
      .then((tracker) =>
        tracker?.captureError({
          error,
          level: level === "fatal" ? "FATAL" : "ERROR",
          source,
          endpoint: moduleName,
          metadata: Object.keys(rest).length > 0 ? JSON.parse(JSON.stringify(rest)) : undefined,
        })
      )
      .catch(() => {});
  } catch {
    // Logging must never throw.
  }
}

function createLogger(bindings: Record<string, unknown> = {}): Logger {
  function makeLogFn(level: LogLevel): LogFn {
    const levelNum = LOG_LEVELS[level];

    return function logFn(...args: unknown[]): void {
      if (levelNum < currentLevelNum) return;

      let obj: Record<string, unknown> = {};
      let msg = "";

      if (typeof args[0] === "string") {
        msg = args[0];
      } else if (typeof args[0] === "object" && args[0] !== null) {
        obj = args[0] as Record<string, unknown>;
        msg = (args[1] as string) || "";
      }

      const entry: Record<string, unknown> = {
        level,
        time: new Date().toISOString(),
        ...bindings,
        ...obj,
        msg,
      };

      // Serialize error objects
      if (entry.err instanceof Error) {
        entry.err = {
          message: entry.err.message,
          name: entry.err.name,
          stack: entry.err.stack,
        };
      }

      const output = JSON.stringify(entry);

      if (levelNum >= LOG_LEVELS.error) {
        process.stderr.write(output + "\n");
        forwardToErrorTracker(entry, level);
      } else {
        process.stdout.write(output + "\n");
      }
    } as LogFn;
  }

  return {
    trace: makeLogFn("trace"),
    debug: makeLogFn("debug"),
    info: makeLogFn("info"),
    warn: makeLogFn("warn"),
    error: makeLogFn("error"),
    fatal: makeLogFn("fatal"),
    child(childBindings: Record<string, unknown>): Logger {
      return createLogger({ ...bindings, ...childBindings });
    },
  };
}

export const logger = createLogger({ service: "indiecrowdfund" });

export type { Logger };
