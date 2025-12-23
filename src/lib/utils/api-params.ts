/**
 * Utility functions for safely parsing API parameters
 * and escaping HTML content
 */

/**
 * Safely parse an integer from a string with validation
 * Returns the parsed value clamped between min and max, or the default if invalid
 */
export function safeParseInt(
  value: string | null,
  defaultValue: number,
  options?: { min?: number; max?: number }
): number {
  const parsed = parseInt(value || String(defaultValue), 10);
  if (isNaN(parsed)) {
    return defaultValue;
  }
  const min = options?.min ?? 1;
  const max = options?.max ?? Number.MAX_SAFE_INTEGER;
  return Math.max(min, Math.min(max, parsed));
}

/**
 * Safely parse pagination parameters
 */
export function parsePaginationParams(searchParams: URLSearchParams, defaults?: {
  page?: number;
  limit?: number;
  maxLimit?: number;
}): { page: number; limit: number; skip: number } {
  const page = safeParseInt(searchParams.get("page"), defaults?.page ?? 1, { min: 1 });
  const limit = safeParseInt(
    searchParams.get("limit"),
    defaults?.limit ?? 20,
    { min: 1, max: defaults?.maxLimit ?? 100 }
  );
  return { page, limit, skip: (page - 1) * limit };
}

/**
 * Validate sort field against a whitelist
 */
export function validateSortField(
  requestedField: string | null,
  allowedFields: string[],
  defaultField: string = "createdAt"
): string {
  if (!requestedField) return defaultField;
  return allowedFields.includes(requestedField) ? requestedField : defaultField;
}

/**
 * Validate sort order
 */
export function validateSortOrder(order: string | null): "asc" | "desc" {
  return order === "asc" ? "asc" : "desc";
}

/**
 * Escape HTML entities to prevent XSS
 */
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Escape HTML for use in email templates
 * Also handles newlines for proper display
 */
export function escapeHtmlForEmail(unsafe: string): string {
  return escapeHtml(unsafe).replace(/\n/g, "<br>");
}
