# IndieCrowdfund — Information Security Policy

**Document version:** 1.0
**Effective date:** 2026-04-29
**Next scheduled review:** 2027-04-29
**Policy owner:** Director (Mike Wheeler)
**Applies to:** All employees, contractors, and third-party service providers with access to IndieCrowdfund systems, data, or operations.

---

## 1. Purpose

This policy establishes IndieCrowdfund's overall approach to information security and protection of cardholder data (CHD) for compliance with PCI DSS v4.0 (SAQ A scope). It defines the security objectives, roles, and operational practices that govern how we handle authentication credentials, customer data, payment information, and the systems that process them.

## 2. Scope

This policy applies to:

- All IndieCrowdfund production systems (application servers, databases, backups, logs).
- All staging, development, and infrastructure-as-code environments.
- All personnel — full-time, part-time, contracted, or volunteer — who hold credentials to any IndieCrowdfund system.
- All third-party service providers (TPSPs) listed in Section 9 that store, process, transmit, or could affect the security of IndieCrowdfund cardholder data.

Cardholder data (PAN, full track data, CVV, PIN/PIN block) is **out of scope** for IndieCrowdfund's environment. All cardholder data capture is performed via PaymentCloud's Collect.js iframe (a PCI DSS-validated tokenization solution); PAN is transmitted directly from the cardholder's browser to PaymentCloud's PCI Level 1 certified gateway and never enters any IndieCrowdfund system.

## 3. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| Policy Owner | Director (Mike Wheeler). Approves this policy, ensures it is reviewed at least annually, commissions remediation when gaps are identified. |
| Site Reliability / Operations | Day-to-day enforcement of access control, deployment, monitoring, log review, and incident response. |
| All personnel | Read this policy on onboarding and after every revision. Use only assigned credentials. Report suspected security incidents to the Policy Owner immediately. |
| Third-party service providers | Maintain their own PCI DSS / SOC 2 compliance. Notify IndieCrowdfund of any incident affecting our data within 24 hours per contractual obligations. |

## 4. Acceptable Use

- Production credentials are used only for production work. Personal accounts, side projects, and unrelated services do not share credentials with IndieCrowdfund.
- Production access is granted on a least-privilege basis. Database superuser, server root, and platform admin accounts are reserved for the Policy Owner and Site Reliability personnel.
- All administrative access requires multi-factor authentication (MFA) where the underlying system supports it (GitHub, Cloudflare, PaymentCloud merchant portal, hosting provider).
- Personnel must not export, copy, screenshot, or share customer PII or payment metadata outside official IndieCrowdfund systems.
- Personnel must lock their workstation when unattended.

## 5. Authentication and Access Control

- Passwords for IndieCrowdfund accounts must be at least 12 characters, unique, and stored only in a reputable password manager.
- MFA is required for: GitHub repository, Cloudflare DNS/R2, PaymentCloud merchant portal, the production server SSH (key-based authentication only — no passwords).
- Accounts are deactivated within 24 hours of personnel departure, role change, or contract end.
- Service accounts (database, third-party API keys) are stored encrypted at rest in `PlatformSettings` via the application's `vault.ts` helper, with a fallback to plaintext only for legacy values pending migration.
- Production credentials are rotated when a person with access leaves, when a credential is suspected of compromise, and at minimum once every 12 months for shared service accounts.

## 6. Data Classification and Handling

| Data type | Stored in IndieCrowdfund systems? | Handling |
|---|---|---|
| Cardholder data (PAN, full track, CVV) | **Never** | Captured in PaymentCloud iframes only; flows browser → PaymentCloud directly. |
| NMI tokens (`customer_vault_id`, `nmiTransactionId`, `nmiInitialTransactionId`) | Yes, in `Pledge` and `MarketplacePurchase` tables | Not classified as cardholder data under PCI DSS. Encrypted in transit (TLS) and at rest by host. |
| Card brand, last 4 digits, expiration month/year | Yes | Display-only metadata, not classified as cardholder data. |
| Backer/creator PII (name, email, address) | Yes | TLS in transit. Soft-deleted via `deletedAt`. Access restricted to authenticated user, project owner (limited fields), and SUPER_ADMIN role. |
| Authentication secrets (API keys, JWT secrets, NMI security key) | Yes, encrypted | `vault.ts` AES-GCM with a key sourced from `VAULT_KEY` environment variable. |
| Operational logs | Yes (`/var/log/pm2/`) | Persistent across deploys, log-rotated, contain no PAN or CVV. Retained for incident-response window. |

## 7. Cryptography

- TLS 1.2 or higher is required for all external connections. Cloudflare terminates TLS at the edge; the origin enforces HTTPS-only via `Strict-Transport-Security`.
- Passwords are hashed with bcrypt (cost ≥ 10) — never reversible.
- Application secrets are encrypted with AES-256-GCM; the master key is held in `VAULT_KEY` and is never committed to source control.
- `VAULT_KEY` is rotated when an employee or contractor with access to the production environment departs.

## 8. Change Management

- All production code changes go through GitHub pull requests with at least one review (self-merge is permitted only for time-critical hot-fixes by the Policy Owner; such fixes are documented in the commit message).
- Deploys run via `build-and-swap.sh` which performs type-check, route-tree pre-flight validation, atomic build swap, and post-deploy health check with auto-rollback if PM2 workers crash-loop.
- Database schema changes are applied via Prisma migrations only; no manual `ALTER TABLE` in production.
- Failed deploys auto-rollback within 15 seconds; PM2 caps restart loops at 10 attempts to prevent resource exhaustion.

## 9. Third-Party Service Providers

IndieCrowdfund relies on the following PCI DSS-validated and otherwise compliant third parties. Each maintains their own compliance posture; we monitor their status and require contractual incident notification.

| Provider | Service | Compliance | Scope of CHD |
|---|---|---|---|
| PaymentCloud (NMI white-label) | Card capture (Collect.js), tokenization, Customer Vault, settlement | PCI DSS Level 1 | Full PAN handling — replaces our scope |
| DivinityCoin | NSFW-permissive backup processor | PCI DSS validated | Full PAN handling on DC-routed campaigns |
| PayPal | Backup processor | PCI DSS Level 1 | Full PAN handling on PP-routed campaigns |
| Whop | Backup processor | PCI DSS validated | Full PAN handling on Whop-routed campaigns |
| Cloudflare | DNS, edge cache, TLS, R2 object storage | SOC 2 Type II, ISO 27001, PCI DSS Level 1 | None (R2 stores project images, no CHD) |
| Hosting provider | Compute and storage for application and database | SOC 2 Type II | None (no CHD ever resides here) |
| GitHub | Source control | SOC 2 Type II | None (no CHD in source code) |

A current list of these providers, their compliance evidence, and contact information is maintained by the Policy Owner.

## 10. Security Awareness

- All personnel review this policy on onboarding and after every revision.
- The Policy Owner sends an annual reminder summarizing recent threats relevant to the platform (phishing, credential stuffing, supply-chain attacks, NMI-specific risks like skimming kits and chargeback fraud).
- Personnel are expected to report suspected phishing attempts, leaked credentials, or unusual system behavior to the Policy Owner immediately.

## 11. Incident Response

If a suspected security incident occurs (data breach, credential compromise, unauthorized access, suspicious payment activity, vendor breach affecting our data):

1. **Contain.** Revoke compromised credentials, rotate keys, isolate affected systems.
2. **Assess.** Determine scope of impact: which data, which users, which time window, which systems.
3. **Notify.**
   - PaymentCloud and any other affected processor — within 24 hours if cardholder data could be affected.
   - Affected users — without unreasonable delay, per applicable breach notification laws (GDPR, US state laws).
   - Card networks (Visa, Mastercard, etc.) — through PaymentCloud's incident process if a CHD breach is confirmed.
4. **Remediate.** Patch the root cause, deploy fixes, validate via deploy health checks, document the incident.
5. **Review.** Post-incident review within 7 days. Update this policy or related procedures if the incident reveals a gap.

## 12. Annual Review

The Policy Owner reviews this policy at least once every 12 months and after any material change to the platform's architecture, processors, or compliance scope. Reviews update the `Document version` and `Effective date` fields above. The previous version is preserved in git history.

## 13. Enforcement

Violations of this policy may result in revocation of system access, contract termination, and — where applicable — referral to law enforcement. Non-compliance with PCI DSS requirements specifically may also result in fines from card networks or termination of our merchant accounts.

---

**Acknowledgement:** All personnel with production access must read and acknowledge this policy on hire and after each revision. Acknowledgement is recorded by the Policy Owner.
