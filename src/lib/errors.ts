import { PrismaClientKnownRequestError, PrismaClientInitializationError } from "@prisma/client";

// Structured error formatting for logger.error({ err: formatError(e) }, "...").
//
// The previous pattern across ~338 catch blocks was
// `logger.error({ err: String(error) }, ...)`, which collapses every
// error into a one-line string. That stripped the Prisma error code
// (P2002, P2025, etc.) and the `meta` object — both of which are
// usually the only diagnostic that identifies which column / unique
// constraint / enum value caused the failure. The prelaunch reject
// 500 (commit fe4d6d3f) sat undiagnosed precisely because a
// PrismaClientValidationError got stringified to a generic "Invalid
// `prisma.projectReview.create()` invocation" message with no
// breadcrumb identifying that `previousStatus` had been handed a
// PrelaunchStatus value instead of a ProjectStatus value.
//
// formatError preserves that detail. Callers stay drop-in:
//   logger.error({ err: formatError(error) }, "Error doing X");
//
// Only PrismaClientKnownRequestError and PrismaClientInitializationError
// are exposed as runtime values from @prisma/client in this version, so
// the other Prisma error subclasses (Validation, Unknown, RustPanic) are
// detected by constructor name — safe because Prisma's error class names
// are stable across releases.
export function formatError(error: unknown): Record<string, unknown> {
  if (error instanceof PrismaClientKnownRequestError) {
    return {
      kind: "PrismaKnownRequestError",
      code: error.code,
      meta: error.meta,
      message: error.message,
      clientVersion: error.clientVersion,
    };
  }
  if (error instanceof PrismaClientInitializationError) {
    return {
      kind: "PrismaInitializationError",
      message: error.message,
      clientVersion: error.clientVersion,
    };
  }
  if (error instanceof Error) {
    const name = error.constructor.name;
    if (name === "PrismaClientValidationError"
        || name === "PrismaClientUnknownRequestError"
        || name === "PrismaClientRustPanicError") {
      return {
        kind: name,
        message: error.message,
      };
    }
    return {
      kind: name,
      message: error.message,
      stack: error.stack,
    };
  }
  return { kind: "Unknown", value: String(error) };
}
