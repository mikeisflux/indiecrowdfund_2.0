# Security Overview

This document provides a high-level overview of security implementations in IndieCrowdfund.

## Authentication

### Session Management
- Token-based sessions with secure, HttpOnly cookies
- 30-day session expiration with auto-extension at 50% lifetime
- Cryptographically random token generation using `crypto.getRandomValues`
- SameSite=Lax cookie policy to prevent CSRF via cookies

### Password Security
- Bcrypt hashing with 12 salt rounds
- Minimum 8-character password requirement
- Secure password reset flow with one-time tokens (1-hour expiry)

### Multi-Factor Authentication Support
- Email verification required for new accounts
- ID verification integration (Shufti Pro) for creator identity

### OAuth Integration
- Support for YouTube, Facebook, Twitter, Instagram
- PKCE flow for Twitter OAuth
- State parameter validation for CSRF protection

## Authorization

### Role-Based Access Control
- User roles: `USER`, `ADMIN`, `SUPER_ADMIN`
- Middleware-level route protection for `/dashboard`, `/admin`, `/api/admin`
- Admin routes require explicit role verification

### Resource-Level Authorization
- Project editing restricted to creators and authorized collaborators
- Pledge management restricted to pledge owners
- Retailer access requires approval status verification

## CSRF Protection

- Double-submit cookie pattern implementation
- 32-byte random token generation
- Token validation on all state-changing requests (POST, PUT, PATCH, DELETE)
- Exemptions for webhooks and external service callbacks

## Rate Limiting

### Login Protection
- 5 failed attempts within 5 minutes triggers temporary lockout
- Extended lockout (1 hour) after 3 consecutive lockout periods
- IP-based request limiting (100 requests/minute)

### Password Reset
- 3 reset requests allowed per 15-minute window
- Prevents abuse of password reset emails

## Input Validation & Sanitization

### Validation
- Zod schema validation for all user inputs
- Email format validation with regex
- URL validation to prevent open redirects

### Sanitization
- DOMPurify-based HTML sanitization
- Whitelist approach for allowed HTML tags and attributes
- Email-specific sanitization removes tracking pixels and unsafe content

## XSS Prevention

- Content Security Policy (CSP) headers
- HTML sanitization on all user-generated content
- X-XSS-Protection header enabled
- X-Content-Type-Options: nosniff

## SQL Injection Prevention

- Prisma ORM with parameterized queries
- No raw SQL queries in the codebase
- Database credentials stored in environment variables only

## Secure Headers

All responses include:
- `Content-Security-Policy` - Restricts resource loading
- `X-Frame-Options: SAMEORIGIN` - Prevents clickjacking
- `X-Content-Type-Options: nosniff` - Prevents MIME sniffing
- `X-XSS-Protection: 1; mode=block` - Browser XSS filter
- `Referrer-Policy: strict-origin-when-cross-origin`

## API Security

### API Key Management
- Environment-prefixed keys (sk_live_, sk_test_, sk_stag_)
- SHA256 hashing for stored API keys
- Masked display in admin interfaces
- Admin-only key management

### Webhook Security
- HMAC-SHA256 signature verification for Stripe webhooks
- Signature verification for ID verification callbacks
- Request body validation against signed payload

## File Upload Security

- Path traversal prevention with directory containment checks
- MIME type whitelist: JPEG, PNG, GIF, WebP, SVG, MP4, WebM, PDF
- File extension validation
- Immutable caching for uploaded assets

## Payment Security (Stripe)

- Webhook signature verification using Stripe SDK
- Environment-based key detection (test vs. live)
- HTTPS enforcement for production
- PCI compliance through Stripe's hosted fields

## Data Encryption

### Sensitive Data
- AES-256-GCM encryption for bank account information
- PBKDF2 key derivation (100,000 iterations)
- Authenticated encryption prevents tampering

### Secrets Management
- All secrets stored in environment variables
- Production validation for required secrets
- Secure fallbacks where appropriate

## Email Security

- Signed unsubscribe tokens (HMAC-SHA256)
- Email verification tokens with 24-hour expiry
- Rate limiting on verification/reset emails
- Tracking pixel removal for privacy

## Environment-Specific Security

### Development
- Relaxed CSP (allows unsafe-eval for hot reload)
- HTTP allowed for local development

### Production
- Strict CSP enforcement
- HTTPS required
- Required secret validation
- Enhanced logging for security events

## Security Monitoring

- Failed login attempt logging with IP addresses
- Rate limit violation tracking
- Session validation errors logged
- Webhook signature failures logged

## Reporting Security Issues

If you discover a security vulnerability, please report it responsibly by contacting the development team directly. Do not create public issues for security vulnerabilities.
