/**
 * Utility functions for escaping HTML content
 */

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
