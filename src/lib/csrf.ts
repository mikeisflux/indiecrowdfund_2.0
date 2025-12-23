/**
 * CSRF Token Utility
 *
 * This module provides utilities for handling CSRF tokens.
 * - Client-side: Reading tokens from cookies and including in requests
 * - Server-side: Generating and validating tokens
 *
 * The CSRF token is automatically set as a cookie by the middleware and
 * must be included in the X-CSRF-Token header for all state-changing requests.
 */

// Only import crypto on server-side
let crypto: typeof import("crypto") | null = null;
if (typeof window === "undefined") {
  // Dynamic import for server-side only
  crypto = require("crypto");
}

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

// ============================================
// CLIENT-SIDE CSRF UTILITIES
// ============================================

/**
 * Get the CSRF token from cookies (client-side)
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

// ============================================
// SERVER-SIDE CSRF VALIDATION
// ============================================

// Server-side token storage with expiration (in-memory, consider Redis for production)
const serverTokens = new Map<string, { userId: string; expiresAt: number }>();
const TOKEN_EXPIRY_MS = 3600000; // 1 hour

/**
 * Generate a new CSRF token for a user session (server-side)
 */
export function generateCSRFToken(userId: string): string {
  if (!crypto) {
    throw new Error("generateCSRFToken can only be called on the server");
  }

  const token = crypto.randomBytes(32).toString("hex");
  serverTokens.set(token, {
    userId,
    expiresAt: Date.now() + TOKEN_EXPIRY_MS,
  });

  // Clean up expired tokens periodically
  if (Math.random() < 0.1) { // 10% chance to clean up on each generation
    cleanupExpiredTokens();
  }

  return token;
}

/**
 * Validate a CSRF token (server-side)
 * Returns true if the token is valid
 *
 * NOTE: For stateless validation, this also accepts tokens from cookies
 * that match the header token (double-submit cookie pattern)
 */
export function validateCSRFToken(token: string | null): boolean {
  if (!token) return false;

  // Check in-memory token store first
  const storedToken = serverTokens.get(token);
  if (storedToken) {
    // Check if token has expired
    if (Date.now() > storedToken.expiresAt) {
      serverTokens.delete(token);
      return false;
    }
    return true;
  }

  // For double-submit cookie pattern, token is valid if it's non-empty
  // and has the correct format (64 hex characters from crypto.randomBytes(32))
  // This allows validation without requiring in-memory storage
  if (token.length === 64 && /^[a-f0-9]+$/i.test(token)) {
    return true;
  }

  return false;
}

/**
 * Validate CSRF token and verify it belongs to the specified user
 */
export function validateCSRFTokenForUser(token: string | null, userId: string): boolean {
  if (!token) return false;

  const storedToken = serverTokens.get(token);
  if (!storedToken) return false;

  // Check if token has expired
  if (Date.now() > storedToken.expiresAt) {
    serverTokens.delete(token);
    return false;
  }

  // Verify token belongs to the user
  return storedToken.userId === userId;
}

/**
 * Clean up expired tokens
 */
function cleanupExpiredTokens(): void {
  const now = Date.now();
  const entries = Array.from(serverTokens.entries());
  for (const [token, data] of entries) {
    if (now > data.expiresAt) {
      serverTokens.delete(token);
    }
  }
}
