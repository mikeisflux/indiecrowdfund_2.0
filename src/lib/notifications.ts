/**
 * Notifications Module
 *
 * This file maintains backwards compatibility by re-exporting all functions
 * from the refactored notifications module.
 *
 * The actual implementation has been split into the following modules:
 * - notifications/types.ts - Types and interfaces
 * - notifications/core.ts - Core notification functions
 * - notifications/email-templates.ts - Email template HTML generators
 * - notifications/project-notifications.ts - Project-related notifications
 * - notifications/pledge-notifications.ts - Pledge-related notifications
 * - notifications/marketplace-notifications.ts - Marketplace notifications
 * - notifications/social-notifications.ts - Social notifications
 * - notifications/index.ts - Main module exports
 */

export * from "./notifications/index";
