import { NextResponse } from "next/server";

/**
 * Standardized API error responses with consistent shape.
 */
export function apiError(
  message: string,
  status: number,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    {
      error: message,
      status,
      ...(details && { details }),
    },
    { status }
  );
}

export function apiBadRequest(message = "Bad request", details?: Record<string, unknown>) {
  return apiError(message, 400, details);
}

export function apiUnauthorized(message = "Unauthorized") {
  return apiError(message, 401);
}

export function apiForbidden(message = "Forbidden") {
  return apiError(message, 403);
}

export function apiNotFound(message = "Not found") {
  return apiError(message, 404);
}

export function apiConflict(message = "Conflict", details?: Record<string, unknown>) {
  return apiError(message, 409, details);
}

export function apiServerError(message = "Internal server error") {
  return apiError(message, 500);
}
