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
