/**
 * Bcrypt cost factor for password hashing.
 * Value of 12 provides good security while maintaining reasonable performance.
 * Increasing this value makes hashing slower (more secure but impacts login time).
 * OWASP recommends a minimum of 10, and 12 is commonly used for production.
 */
export const BCRYPT_COST = 12;
