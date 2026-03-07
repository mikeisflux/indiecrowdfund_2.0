import { getCSRFToken } from "@/lib/csrf";

/**
 * CSRF-aware fetch wrapper for API calls.
 * Automatically includes CSRF token header on mutating requests (POST, PUT, PATCH, DELETE).
 * Also sets Content-Type to application/json when a body object is provided.
 *
 * @param url - The API URL
 * @param options - Standard fetch options (with optional json body shortcut)
 * @returns Promise<Response>
 */
export async function apiFetch(
  url: string,
  options?: RequestInit & { json?: unknown }
): Promise<Response> {
  const headers = new Headers(options?.headers);
  const method = (options?.method || "GET").toUpperCase();

  // Auto-include CSRF token on mutating methods
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrfToken = getCSRFToken();
    if (csrfToken) {
      headers.set("x-csrf-token", csrfToken);
    }
  }

  let body = options?.body;

  // Handle json shortcut
  if (options && "json" in options && options.json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.json);
  } else if (body && typeof body === "string" && !headers.has("Content-Type")) {
    // If body is a string (likely JSON), set content-type
    headers.set("Content-Type", "application/json");
  }

  return fetch(url, {
    ...options,
    method,
    headers,
    body,
  });
}

/**
 * Fetch with automatic retry for transient network failures
 *
 * Retries on network errors (DNS failures, connection timeouts, etc.)
 * Does NOT retry on HTTP errors (4xx, 5xx) - those are returned normally
 *
 * @param url - The URL to fetch
 * @param options - Standard fetch options
 * @param maxRetries - Maximum number of retry attempts (default: 3)
 * @param baseDelay - Base delay in ms for exponential backoff (default: 1000)
 * @returns Promise<Response>
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Only retry on network errors, not after successful HTTP responses
      if (attempt < maxRetries - 1) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

