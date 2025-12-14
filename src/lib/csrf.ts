/**
 * CSRF Token Utility
 *
 * This module provides utilities for handling CSRF tokens in the frontend.
 * The CSRF token is automatically set as a cookie by the middleware and
 * must be included in the X-CSRF-Token header for all state-changing requests.
 */

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

/**
 * Get the CSRF token from cookies
 */
export function getCSRFToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie.split(";");
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split("=");
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(value);
    }
  }
  return null;
}

/**
 * Get headers object with CSRF token included
 */
export function getCSRFHeaders(): Record<string, string> {
  const token = getCSRFToken();
  if (!token) {
    return {};
  }
  return { [CSRF_HEADER_NAME]: token };
}

/**
 * Wrapper around fetch that automatically includes CSRF token
 * for POST, PUT, PATCH, DELETE requests
 */
export async function fetchWithCSRF(
  url: string | URL,
  options: RequestInit = {}
): Promise<Response> {
  const method = options.method?.toUpperCase() || "GET";
  const isStateChanging = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

  if (isStateChanging) {
    const csrfHeaders = getCSRFHeaders();
    options.headers = {
      ...options.headers,
      ...csrfHeaders,
    };
  }

  return fetch(url, options);
}

/**
 * Create a Headers object with CSRF token included
 * Useful when you need to pass Headers to fetch
 */
export function createHeadersWithCSRF(
  existingHeaders?: HeadersInit
): Headers {
  const headers = new Headers(existingHeaders);
  const token = getCSRFToken();

  if (token) {
    headers.set(CSRF_HEADER_NAME, token);
  }

  return headers;
}
