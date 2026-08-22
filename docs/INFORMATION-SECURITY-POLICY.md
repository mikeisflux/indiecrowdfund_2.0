# IndieCrowdfund — Information Security Policy

**Document version:** 1.2
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

IndieCrowdfund relies on the following PCI DSS-validated and otherwise compliant third parties. Each maintains their own compliance posture; we monitor their status and require contractual incident notification. The use of a PCI DSS compliant TPSP does not transfer IndieCrowdfund's own PCI DSS responsibilities to that provider — it only narrows the scope of what IndieCrowdfund must directly control.

### 9.1 TPSP Register (PCI DSS Requirement 12.8.1)

| Provider | Service | Compliance | Scope of CHD |
|---|---|---|---|
| PaymentCloud (NMI white-label) | Card capture (Collect.js), tokenization, Customer Vault, settlement | PCI DSS Level 1 | Full PAN handling — replaces our scope |
| DivinityCoin | NSFW-permissive backup processor | PCI DSS validated | Full PAN handling on DC-routed campaigns |
| PayPal | Withdrawn as a processor; still services pre-withdrawal transactions (capture, refunds, disputes, webhooks) | PCI DSS Level 1 | Full PAN handling on campaigns routed to PP before withdrawal |
| Whop | Backup processor | PCI DSS validated | Full PAN handling on Whop-routed campaigns |
| Cloudflare | DNS, edge cache, TLS, R2 object storage | SOC 2 Type II, ISO 27001, PCI DSS Level 1 | None (R2 stores project images, no CHD) |
| Hosting provider | Compute and storage for application and database | SOC 2 Type II | None (no CHD ever resides here) |
| GitHub | Source control | SOC 2 Type II | None (no CHD in source code) |

A current list of these providers, their compliance evidence (AOC / SOC reports / TOS attestations), and primary contact information is maintained by the Policy Owner.

### 9.2 Written Agreements (PCI DSS Requirement 12.8.2)

IndieCrowdfund has a written agreement in place with each TPSP listed above. Each agreement (whether a custom contract or the provider's standard Terms of Service) includes the provider's acknowledgement that they are responsible for the security of cardholder data they possess, store, process, transmit on IndieCrowdfund's behalf, or could otherwise affect.

| Provider | Form of agreement | Where the PCI/security clause lives |
|---|---|---|
| PaymentCloud | Merchant Processing Agreement | Acquirer/processor agreement; PCI compliance clause + AOC delivered annually |
| DivinityCoin | Service Agreement | Vendor contract; PCI/security responsibilities clause |
| PayPal | Standard Merchant Agreement + Acceptable Use Policy | PayPal's published merchant TOS includes its PCI obligations. Retained while pre-withdrawal transactions remain refundable or disputable |
| Whop | Whop Creator Agreement | Whop's TOS includes payment-data security obligations |
| Cloudflare | Self-Serve Subscription Agreement / Enterprise MSA | Cloudflare's DPA + security addendum + published SOC 2 / ISO 27001 reports |
| Hosting provider | Standard hosting agreement | Provider's TOS + DPA |
| GitHub | GitHub Customer Agreement / DPA | GitHub's published security and DPA terms |

### 9.3 TPSP Onboarding and Due Diligence (PCI DSS Requirement 12.8.3)

Before engaging any new TPSP that will store, process, or transmit cardholder data, or that could otherwise affect the security of cardholder data, the Policy Owner performs the following due diligence:

1. Confirm the provider holds applicable compliance attestations (PCI DSS AOC / SOC 2 Type II / ISO 27001) and request a current copy.
2. Review the provider's incident-notification SLA (must be ≤ 24 hours for breaches affecting our data).
3. Confirm a written agreement is in place that captures their PCI/security responsibilities (Section 9.2).
4. Confirm the data flow with the new provider — what data they receive, retain, and for how long.
5. Document the result in this register (Section 9.1) and assign a responsibility line in the matrix (Section 9.5).
6. Provision access on a least-privilege basis.

### 9.4 Ongoing TPSP Monitoring (PCI DSS Requirement 12.8.4)

At least once every 12 months — and concurrent with the annual policy review (Section 12) — the Policy Owner verifies the compliance status of every TPSP listed above:

- Request a current AOC / SOC 2 / ISO 27001 report and confirm the date is within the past 12 months.
- Verify the provider has not had a publicly disclosed breach affecting our data.
- Re-confirm the responsibility matrix (Section 9.5) is still accurate after any service or contract change.
- Update Section 9.1 if a provider has been added, removed, or had a material service change.

If a TPSP fails to provide current compliance evidence, the Policy Owner either obtains a written remediation plan from the provider or migrates off that provider before the next assessment.

### 9.5 PCI DSS Responsibility Matrix (PCI DSS Requirement 12.8.5)

This matrix documents which PCI DSS requirements are managed by IndieCrowdfund directly, which are inherited from a TPSP, and which are shared. Inheritance from PaymentCloud (and the other processors for their respective campaigns) is the basis for IndieCrowdfund's SAQ A scope.

| PCI DSS Requirement (v4.0, abbreviated) | IndieCrowdfund | PaymentCloud (or routed processor) | Cloudflare | Hosting / GitHub |
|---|---|---|---|---|
| 1 — Network security controls | — | ✓ (CDE perimeter) | ✓ (edge WAF, DDoS) | ✓ (host firewall) |
| 2 — Secure configuration | — | ✓ | — | ✓ |
| 3 — Protect stored account data | N/A | ✓ (vault, tokenization) | — | — |
| 4 — Protect CHD in transit | N/A | ✓ | ✓ (TLS 1.2+ at edge) | — |
| 5 — Anti-malware | — | ✓ | — | ✓ |
| 6 — Develop / maintain secure systems | Shared (our app, dependencies, deploy pipeline) | ✓ (their gateway code) | — | ✓ (host patching) |
| 7 — Restrict access by need-to-know | ✓ (our app + admin access) | ✓ (their systems) | — | ✓ (host access) |
| 8 — Identify and authenticate users | ✓ (our app users + admin) | ✓ (their systems) | — | ✓ |
| 9 — Restrict physical access to CHD | N/A | ✓ | ✓ (data centers) | ✓ (data centers) |
| 10 — Log and monitor | Shared (app + PM2 logs) | ✓ (gateway logs) | ✓ (edge logs) | ✓ (host logs) |
| 11 — Test security of systems / networks | Shared (TLS scans on our domain via Cloudflare/SSL Labs) | ✓ (full ASV scans) | ✓ | ✓ |
| 12 — Maintain an information security policy | ✓ (this document) | ✓ (their own policy) | ✓ | ✓ |

**N/A** = scope removed because PAN never enters our environment.
**✓** = the named party owns that requirement for its share of the joint environment.

The Policy Owner reviews and updates this matrix during the annual TPSP review (Section 9.4) and whenever a TPSP is added, removed, or materially changes its services.

## 10. Security Awareness

- All personnel review this policy on onboarding and after every revision.
- The Policy Owner sends an annual reminder summarizing recent threats relevant to the platform (phishing, credential stuffing, supply-chain attacks, NMI-specific risks like skimming kits and chargeback fraud).
- Personnel are expected to report suspected phishing attempts, leaked credentials, or unusual system behavior to the Policy Owner immediately.

## 11. Incident Response Plan

This is IndieCrowdfund's documented Incident Response Plan, ready to be activated in the event of a suspected or confirmed security incident. It is reviewed at least annually as part of Section 12 and after every actual incident.

### 11.1 Roles, Responsibilities, and Communication

| Role | Held by | Responsibility during an incident |
|---|---|---|
| Incident Commander | Director (Mike Wheeler) | Final authority on response decisions, external comms approval, post-incident review owner. |
| Technical Lead | Site Reliability personnel | Containment, log collection, forensic preservation, root-cause investigation, deploy of fixes. |
| Communications Lead | Director (Mike Wheeler) by default; may delegate | User-facing notifications, regulator/processor notifications, status page updates. |
| Legal Liaison | Director, with outside counsel as needed | Determines breach-notification obligations under applicable laws. |

**Internal escalation:** the first responder pages the Director by phone (number maintained in the off-platform contact list). If unreachable within 15 minutes, escalate to backup contact. All discussion of an active incident moves to a private channel established for that incident; no incident specifics are posted in shared chat tools.

**External contacts maintained off-platform** (in case core systems are unavailable):
- PaymentCloud / NMI gateway support — phone + email
- DivinityCoin, PayPal, Whop processor support contacts
- Cloudflare emergency support
- Hosting provider emergency support
- Outside legal counsel
- Cyber-insurance carrier claim line (if applicable)

### 11.2 Incident Categorization and Containment

Different incident types trigger different containment paths. The Technical Lead picks the matching playbook on first response:

| Incident type | Immediate containment |
|---|---|
| Stolen / leaked credential (staff or service) | Revoke the credential. Rotate any keys it could have touched (`VAULT_KEY`, NMI security key, processor API keys, DB password). Force re-auth on related sessions. |
| Suspicious admin activity | Disable the admin account. Pull `pm2 logs` + DB audit trail for the affected window. Preserve logs to a separate location before any restart. |
| Application vulnerability under active exploitation | Block the offending request pattern at Cloudflare (WAF rule). Take affected route offline if necessary. Deploy fix via `build-and-swap.sh`; rollback path is built in. |
| Suspected card data exposure on our systems | Treat as P0. Snapshot affected systems for forensics before remediation. Notify PaymentCloud within 24 hours. **Note:** by design IndieCrowdfund does not store PAN — discovery of PAN on our systems is itself the indicator of a serious deviation from our architecture and triggers full P0 response. |
| TPSP breach affecting our data (e.g. PaymentCloud, Cloudflare, hosting) | Confirm scope with the TPSP. Determine whether tokens, customer PII, or session data are affected. Trigger user-notification and regulator-notification paths as relevant. |
| DDoS / availability incident | Engage Cloudflare protection (Under Attack mode if needed). No CHD impact expected — focus is service restoration per business continuity plan (Section 11.4). |
| Insider threat / lost laptop with cached production access | Revoke that person's credentials immediately. Rotate `VAULT_KEY` and processor API keys. Audit recent activity from that account. |
| Suspicious payment activity (high chargeback rate, fraud spike) | Lock affected creator's payouts. Engage PaymentCloud's risk team. Increase fraud-rule sensitivity at the gateway. |

### 11.3 Notification Decision Tree

After containment, in parallel with investigation, the Communications Lead works the following decision tree:

1. **Was cardholder data potentially exposed (PAN, full track, CVV)?**
   - Yes → Notify the affected payment processor (PaymentCloud, etc.) within 24 hours per the merchant agreement. PaymentCloud handles onward notification to Visa / Mastercard / Discover / Amex per their incident response procedures.
   - No → Skip to step 2.

2. **Was non-CHD personal data potentially exposed (names, emails, addresses, hashed passwords, NMI tokens)?**
   - Yes → Engage Legal Liaison to determine notification obligations. At minimum:
     - **GDPR** (EU/UK residents): notify the relevant supervisory authority within 72 hours and affected data subjects without undue delay if there is a high risk to them.
     - **US state breach laws** (CCPA/CPRA in California, NY SHIELD Act, plus the other 48 state laws): notify affected residents per each state's specific timeline, typically within 30–60 days of discovery.
     - **Other jurisdictions**: review per-jurisdiction obligations (PIPEDA Canada, LGPD Brazil, PDPA Singapore, etc.).
   - No → No external user/regulator notification required, but proceed with internal documentation.

3. **Was the incident reportable to a regulator regardless of CHD/PII status?**
   - PCI DSS service providers we depend on may have contractual reporting obligations to us — but as a SAQ A merchant, IndieCrowdfund's primary regulator-facing duty runs through the payment brands via PaymentCloud.

### 11.4 Business Continuity and Recovery

| Asset | Recovery approach | Recovery objective |
|---|---|---|
| Production application (Next.js + PM2 cluster) | `build-and-swap.sh` keeps the previous build as `.next-backup-<timestamp>`; rollback is a single move-and-reload. PM2 cluster mode (4 workers) survives single-worker crashes. | RTO: 5 minutes for a known-good rollback. |
| Database (PostgreSQL) | Hosting-provider point-in-time recovery (PITR) plus daily logical backups stored off the production host. | RTO: ≤ 4 hours. RPO: ≤ 1 hour via PITR. |
| DNS / TLS edge | Cloudflare; failover handled by Cloudflare's anycast network. Origin can be repointed to a backup host if needed. | RTO: < 15 minutes for DNS change. |
| Source code | GitHub primary; local clones held by Director and any active contributors act as ad-hoc mirrors. | RTO: immediate (clone available locally). |
| Object storage (Cloudflare R2) | Cloudflare's durability guarantees. Critical assets (project images) regenerable from creator uploads. | RPO: per Cloudflare R2 SLA. |
| Source-of-truth payment data | PaymentCloud's vault is authoritative for tokenized cards; their reporting is authoritative for transaction history. We can rebuild our pledge-status state from PaymentCloud's records via the Query API if our DB is lost. | RTO: 24 hours for full reconciliation. |

If the production application is unavailable, the public site shows a Cloudflare-served maintenance page. Pledges in flight at the time of an outage are marked PENDING; the cron-driven reconciliation on next boot resolves them via PaymentCloud's transaction history.

### 11.5 Data Backup Processes

- **Application database:** the hosting provider performs continuous PITR (write-ahead log shipping). Daily logical backups (`pg_dump`) are written to encrypted off-host storage. Backups are retained for 30 days minimum.
- **Encryption keys:** `VAULT_KEY` and other master secrets are kept in the Director's password manager (with a sealed copy in a fireproof location). These are NOT backed up to the application's database backups.
- **Source code:** GitHub remote + local clones.
- **Logs:** PM2 persistent logs at `/var/log/pm2/` survive PM2 reloads, deploys, and reboots; rotated monthly via `pm2-logrotate`.
- **Backup integrity:** the Policy Owner verifies backup integrity by performing a test restore at least once every 12 months.

### 11.6 Critical System Components

The plan covers all critical components in IndieCrowdfund's operating environment:

- Application servers (Next.js + PM2)
- Application database (PostgreSQL)
- Vault / secrets storage (`vault.ts` + `VAULT_KEY`)
- Cloudflare edge (DNS, WAF, R2 object storage)
- Source-control system (GitHub)
- All TPSPs listed in Section 9.1

### 11.7 Payment Brand Incident Response Procedures

PaymentCloud, as our acquirer and gateway, is the channel through which payment-brand incident response procedures (Visa CISP, Mastercard SDP, Discover DISC, Amex DSOP) are activated. In the event of a confirmed CHD compromise:

1. IndieCrowdfund notifies PaymentCloud within 24 hours.
2. PaymentCloud invokes the appropriate brand-specific Incident Response procedure on our behalf.
3. IndieCrowdfund cooperates fully with any forensic investigator (PFI) engaged by the brands and provides logs, code, and access as requested.
4. Brand-specific reporting deadlines, fines, and remediation timelines are tracked by the Director with input from outside counsel.

A current copy of PaymentCloud's incident-reporting contact information is maintained in the off-platform contact list (Section 11.1).

### 11.8 Standard Response Workflow

For any incident, the steps below are executed in order (steps 2–4 may overlap):

1. **Contain.** Revoke compromised credentials, rotate keys, isolate affected systems per the matching row in Section 11.2.
2. **Assess.** Determine scope of impact: which data, which users, which time window, which systems. Preserve evidence (logs, snapshots, memory dumps if needed) before remediation.
3. **Notify.** Run the decision tree in Section 11.3.
4. **Remediate.** Patch the root cause, deploy fixes via `build-and-swap.sh`, validate via deploy health checks, document the change.
5. **Review.** Post-incident review within 7 days of resolution. Identify root cause, contributing factors, and policy or procedure updates needed. Update this plan accordingly.

### 11.9 Plan Activation, Testing, and Maintenance

- This plan is "ready to be activated" — there are no preconditions or sign-offs needed before initiating containment.
- The plan is tested at least once every 12 months via a tabletop walkthrough (the Director walks through one of the categorized incident types in Section 11.2 end-to-end and validates that contacts, runbooks, and recovery objectives are still accurate).
- After every real incident or annual tabletop, the plan is updated to reflect any gaps discovered.

## 12. Annual Review

The Policy Owner reviews this policy at least once every 12 months and after any material change to the platform's architecture, processors, or compliance scope. Reviews update the `Document version` and `Effective date` fields above. The previous version is preserved in git history.

## 13. Enforcement

Violations of this policy may result in revocation of system access, contract termination, and — where applicable — referral to law enforcement. Non-compliance with PCI DSS requirements specifically may also result in fines from card networks or termination of our merchant accounts.

---

**Acknowledgement:** All personnel with production access must read and acknowledge this policy on hire and after each revision. Acknowledgement is recorded by the Policy Owner.
