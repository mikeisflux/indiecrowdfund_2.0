# IndieCrowdfund — AML / CTF and Sanctions Compliance Policy

**Document Version:** 1.0
**Date:** March 13, 2026
**Platform:** IndieCrowdfund (indiecrowdfund.com)
**Entity:** IndieCrowdfund, Inc.
**Jurisdiction:** State of Indiana, United States
**Payment Processor:** Stripe (Stripe Connect Express)
**Compliance Contact:** trust@indiecrowdfund.com

---

## Table of Contents

1. Purpose and Scope
2. Regulatory Context
3. Campaign and Creator Verification
4. Risk Rating Framework
5. Sanctions Screening
6. Transaction Monitoring Controls
7. AI-Powered Fraud Detection and Content Moderation
8. Suspicious Activity Detection and Reporting
9. Prohibited Activities and Content
10. Enforcement Actions
11. Record Keeping and Audit Trail
12. Employee Training
13. Independent Review
14. Payment Collection and Disbursement
15. Campaign Transparency to Donors
16. Prohibited Jurisdictions Controls
17. Contact Information

---

## 1. Purpose and Scope

This policy establishes IndieCrowdfund's program for preventing money laundering, terrorist financing, fraud, and sanctions violations on our crowdfunding platform. It applies to all users of the platform, including campaign creators (fund recipients), backers (donors), and platform administrators.

IndieCrowdfund operates as a technology platform that facilitates crowdfunding transactions through Stripe Connect. Stripe holds all applicable money transmitter licenses. IndieCrowdfund is not a bank, money services business, or registered financial institution. However, we maintain robust compliance controls to ensure the integrity of transactions processed through our platform.

This policy covers:
- All crowdfunding campaigns hosted on IndieCrowdfund
- All creator accounts and Stripe Connect Express connected accounts
- All backer transactions (pledges, purchases)
- Digital marketplace transactions
- All platform administrative actions

---

## 2. Regulatory Context

IndieCrowdfund is not currently regulated by a competent financial authority in any jurisdiction. Stripe, as our payment processor and the holder of money transmitter licenses, bears primary regulatory obligations for payment processing. IndieCrowdfund maintains its own compliance program as a responsible platform operator and as required by Stripe's terms of service.

We are in the process of engaging Capital Compliance Experts to conduct our first annual independent review of this compliance program, with the intention of establishing annual independent reviews going forward.

---

## 3. Campaign and Creator Verification

### 3.1 Information Collected

IndieCrowdfund collects the following information on all campaign organizers:

**Identity Documentation (Required for New Creators):**
- Valid government-issued photo ID (driver's license, passport, or state ID)
- Legitimate business filing from the creator's state Secretary of State office (LLC articles of organization, business registration certificate, or DBA filing)

**Account Information (Required for All Creators):**
- Full legal name
- Email address (verified)
- Physical location and timezone
- Contact information
- Social media account links
- Creator biography and professional background
- Project type declaration (individual or business/nonprofit)

**Payment Verification (Required — Outsourced to Stripe):**
- Stripe Connect Express onboarding, which includes:
  - SSN or Tax ID verification
  - US bank account verification
  - Government ID verification
  - Address verification
  - OFAC and international sanctions list screening

### 3.2 Verification Process

Our verification process is multi-layered and conducted before any campaign is approved to go live:

**Step 1: Identity Verification**
New creators submit government-issued photo ID and Secretary of State business filings. These are reviewed by our admin team for authenticity, consistency with account information, and validity (not expired, legible).

**Step 2: Social Media and Online Presence Audit**
All social media accounts linked to the creator profile are logged and verified by our team. We check for:
- Account authenticity and age
- Consistency with creator identity
- Active presence and engagement history
- Professional reputation

**Step 3: Cross-Platform Campaign Audit**
Our team searches other crowdfunding platforms — including Kickstarter, Indiegogo, GoFundMe, and others — to review the creator's previous campaign history. We examine:
- Campaign descriptions and delivery promises
- Backer reviews, comments, and public feedback
- Fulfillment track record and delivery timelines
- Any disputes, complaints, or fraud allegations

**Step 4: Fulfillment History Validation**
We contact creators directly when discrepancies or concerns are identified during our cross-platform review. Creators are asked to explain any issues and provide evidence of resolution.

**Step 5: Payment Account Verification (Stripe)**
Creators must complete Stripe Connect Express onboarding, which performs automated identity verification, SSN validation, US bank account verification, and sanctions screening.

**Step 6: Admin Review and Approval**
Every campaign goes through a mandatory admin review workflow:
- **DRAFT** — Creator builds campaign
- **SUBMITTED** — Creator submits for review
- **APPROVED / REJECTED / REQUESTED_CHANGES** — Admin reviews and decides
- **LIVE** — Only approved campaigns can accept pledges

All review decisions are recorded with reviewer identity, timestamp, action taken, notes, internal notes, and rejection reasons where applicable.

### 3.3 Automatic Disqualification Rules

Creators are automatically disqualified from launching on IndieCrowdfund if:

1. They have **three (3) or more unfulfilled campaigns** on any crowdfunding platform
2. They have **any campaign that is more than one (1) year past its stated delivery date**, regardless of current fulfillment status

These rules apply to campaigns across all crowdfunding platforms, not just IndieCrowdfund. There are no exceptions.

### 3.4 Returning Creator Verification

Returning creators with previously verified accounts may be exempt from re-submitting identity documents. However, each new campaign still goes through the full admin review process, and cross-platform audits are conducted for every submission.

### 3.5 Documentation and Record Retention

All verification findings, correspondence, review decisions, and supporting documentation are retained internally for compliance and audit purposes. This includes:
- Copies of submitted identity documents
- Social media audit findings
- Cross-platform campaign research results
- Admin review records with notes and decisions
- All communication with creators regarding verification

---

## 4. Risk Rating Framework

### 4.1 Campaign Risk Assessment

Every campaign submitted to IndieCrowdfund is assessed for risk through both automated and manual processes:

**AI Fraud Analysis (Automated):**
Our AI-powered fraud detection system (powered by Anthropic Claude) analyzes every project submission and produces:
- **Fraud Score:** 0–100 scale (higher = more likely fraud)
- **Risk Factors:** Itemized list with severity ratings (low / medium / high)
- **Recommendation:** `approve`, `manual_review`, or `reject`
- **Explanation:** Detailed assessment narrative

**AI Content Moderation (Automated):**
A separate AI moderation pass evaluates content and produces:
- **Risk Level:** `low`, `medium`, `high`, or `critical`
- **Policy Flags:** Specific violations identified
- **Suggested Action:** `approve`, `review`, or `reject`
- **Confidence Score:** 0.0–1.0

**Content Risk Flags (Database-Level):**
Projects carry persistent risk flags:
- `hasAdultContent` — Declares adult/explicit content
- `hasRiskyContent` — Flagged as potentially risky
- `promoContentSfw` — Confirms promotional materials are safe for work

These flags determine payment processor eligibility (NSFW projects cannot use Stripe) and trigger enhanced review requirements.

### 4.2 Risk Categories

| Risk Level | Criteria | Action |
|-----------|----------|--------|
| **Low** | AI fraud score 0–25, no policy flags, verified creator with clean history | Standard admin review |
| **Medium** | AI fraud score 26–50, minor flags, new creator, or AI moderation error | Enhanced admin review with additional scrutiny |
| **High** | AI fraud score 51–75, multiple flags, adult content, or creator history concerns | Mandatory senior admin review, may require additional documentation |
| **Critical** | AI fraud score 76–100, policy violations detected, suspected fraud or impersonation | Automatic hold, requires super admin review, may be rejected outright |

### 4.3 Ongoing Monitoring

Risk assessment does not end at campaign approval. Ongoing monitoring includes:
- Stripe Radar real-time fraud scoring on every transaction
- Payment failure pattern tracking (repeated failures may indicate stolen cards)
- Bot detection and suspicious activity monitoring
- Backer reports and community flagging
- Admin ability to revoke approval, pause, or cancel campaigns at any stage

---

## 5. Sanctions Screening

### 5.1 Lists Screened

All donors, campaigns, and campaign-affiliated individuals are screened against the following sanctions lists:

- **OFAC SDN List** (US Office of Foreign Assets Control — Specially Designated Nationals)
- **UN Sanctions List**
- **UK HM Treasury Sanctions List**
- **EU Sanctions List**
- **Australian Consolidated List**

### 5.2 Screening Frequency

Screening is **continuous**:
- **At onboarding:** Stripe performs initial sanctions screening during Connect Express account creation
- **Ongoing:** Stripe continuously monitors all connected accounts for changes in sanctions status
- **At transaction time:** Stripe screens card-issuer country and cardholder details on every payment

### 5.3 Screening Method

Sanctions screening is **automated** and **outsourced to Stripe**:
- Stripe performs automated screening against all listed sanctions databases as part of its Connect platform
- Stripe automatically declines transactions from cards issued in comprehensively sanctioned countries
- Stripe provides ongoing monitoring alerts for connected account status changes

### 5.4 Platform-Level Controls

In addition to Stripe's automated screening, IndieCrowdfund maintains structural controls:
- **US-only creator accounts:** Stripe Connect Express accounts are hardcoded to `country: "US"` — only US-based individuals can receive fund disbursements
- **USD-only transactions:** All payments are denominated in US Dollars
- **Mandatory admin review:** Every campaign is reviewed before going live, providing a human checkpoint for jurisdictional concerns
- **Identity verification:** Government-issued photo ID and Secretary of State business filings verify creator identity and US presence

---

## 6. Transaction Monitoring Controls

### 6.1 Payment Event Monitoring

All Stripe payment events are monitored in real time via webhook handlers:

| Event | Monitoring Action |
|-------|------------------|
| `payment_intent.succeeded` | Verify pledge status, update stats atomically, send confirmation |
| `payment_intent.payment_failed` | Log failure reason, schedule retry, notify backer |
| `setup_intent.succeeded` | Save payment method, update pledge, check funding status |
| `account.updated` | Monitor creator Stripe Connect onboarding status changes |
| `checkout.session.completed` | Process marketplace purchases |

**Anti-duplication controls:**
- Idempotency checks via `ProcessedWebhookEvent` table — duplicate events are rejected
- Atomic stat updates using mutex flags to prevent double-counting
- Status verification before processing — already-completed pledges are skipped

### 6.2 Payment Failure Tracking and Retry

Failed payments are tracked systematically:
- **Max retries:** 3 attempts per pledge
- **Retry interval:** 3 days between attempts
- **Idempotency keys:** Unique keys per pledge per retry prevent duplicate charges
- **Failure logging:** Failure reasons stored on every pledge for pattern analysis
- **Escalation:** After 3 failures, pledge marked FAILED and backer notified

### 6.3 Scheduled Monitoring Jobs

| Job | Purpose | Frequency |
|-----|---------|-----------|
| Process Funded Campaigns | Charge pending pledges when campaigns reach goal | Every 5 minutes |
| Payment Retries | Retry failed charges | Hourly |
| Process Failed Campaigns | Handle expired/failed campaigns | Daily |
| Cleanup Pledges | Clean up orphaned records | Daily |

All cron jobs are authenticated via `CRON_SECRET` and managed through the admin dashboard.

---

## 7. AI-Powered Fraud Detection and Content Moderation

### 7.1 Fraud Analysis

Our AI fraud detection system checks for:

1. Unrealistic promises or guarantees
2. Claims of "guaranteed returns" or "no risk"
3. Vague or copied descriptions
4. Unrealistic timelines
5. Goal amounts that don't match project scope
6. New creators with ambitious claims and no track record
7. Rewards that seem too good to be true
8. Missing or vague risk disclosures
9. Cryptocurrency/NFT projects with investment language
10. Impersonation of known brands or creators

**Fail-safe:** If AI analysis encounters an error, the project is automatically flagged for manual review. The system never auto-approves when analysis fails.

### 7.2 Content Moderation

AI content moderation enforces platform policies:

1. No illegal products or services
2. No weapons, drugs, or dangerous items
3. No adult content without proper declaration
4. No hate speech or discrimination
5. No misleading claims or false advertising
6. No pyramid schemes or investment scams
7. No unauthorized reselling
8. AI-generated content must be disclosed
9. No charity projects (platform is for creative/product projects)
10. Must have tangible deliverables

### 7.3 Safety Review

A third AI analysis checks project readiness:
- Clear goals and deliverables
- Realistic timelines
- Adequate risk disclosure
- No harmful elements
- Professional presentation

---

## 8. Suspicious Activity Detection and Reporting

### 8.1 Automated Bot Detection

A real-time bot detection system monitors all incoming requests:
- **Threshold:** 3 violations within 1 hour triggers automatic IP block
- **Block duration:** 24 hours
- **Detection methods:** Shannon entropy analysis, pattern matching, vowel ratio analysis, repeated pattern detection, server action ID validation
- **Firewall integration:** Blocked IPs are synced to iptables for network-level blocking

### 8.2 Rate Limiting

| Flow | Max Attempts | Window | Lockout |
|------|-------------|--------|---------|
| Login (per IP) | 5 | 5 minutes | 5 minutes |
| Login (per account) | 5 | 5 minutes | 5 min, escalates to 1 hour |
| Registration (per IP) | 5 | 1 hour | 1 hour |
| Password Reset | 3 | 15 minutes | 15 minutes |

### 8.3 reCAPTCHA Protection

Google reCAPTCHA v2 protects registration, login, and password reset forms. The system fails closed — errors result in request denial.

### 8.4 Reporting

Suspicious activity identified through any channel (automated systems, admin review, backer reports) is:
- Logged in the suspicious activity database with full metadata
- Escalated to admin team for review
- Actioned through account locking, banning, or campaign removal as appropriate
- Documented in the audit trail

---

## 9. Prohibited Activities and Content

Users of IndieCrowdfund may not:
- Break any laws while using the platform
- Launch fraudulent or misleading campaigns
- Abuse, harass, or impersonate others
- Use the platform to launder money or engage in financial misconduct
- Upload malware, attempt hacks, or disrupt platform operations
- Fund prohibited items (weapons, hate material, adult services without declaration, etc.)
- Conduct transactions to, from, or in support of sanctioned jurisdictions or individuals

Violations result in account termination, IP blocking, and referral to law enforcement where appropriate.

---

## 10. Enforcement Actions

### 10.1 Available Actions

| Action | Scope | Authority Required |
|--------|-------|-------------------|
| Reject Campaign | Prevent campaign from going live | Admin |
| Request Changes | Return campaign for revision | Admin |
| Revoke Approval | Remove live campaign | Admin |
| Lock Account | Temporary account suspension | Super Admin |
| Unlock Account | Restore account access | Super Admin |
| Ban User | Permanent ban + IP block + session deletion | Super Admin |
| Unban User | Restore access + optional IP unblock | Super Admin |

### 10.2 IP Blocking Tiers

1. **Automated (Bot Blocker):** 24-hour blocks for suspicious activity
2. **Admin (User Bans):** Permanent blocks tied to banned users
3. **Email/Domain Blocklist:** Blocks by email, domain, IP pattern, or regex

---

## 11. Record Keeping and Audit Trail

### 11.1 Audited Actions

All sensitive platform actions are logged with full attribution:

- User management: role changes, bans, locks, deletions, password changes, email changes
- Project management: approvals, rejections, deactivations, reactivations, status changes
- Financial: payout creation, processing, completion, failure, cancellation
- Security: IP blocks/unblocks, settings changes, encryption key changes, API key changes
- Data access: bank account views (sensitive data access logging)

### 11.2 Audit Entry Structure

Each log entry contains:
- **Action type** — What happened
- **Actor identity** — Who performed it (ID and email)
- **Target** — What was affected (ID and type)
- **Details** — Context and metadata
- **Changes** — Before/after values
- **Timestamp** — When it occurred

### 11.3 Sensitive Field Masking

The audit system automatically masks sensitive values including: Stripe API keys, webhook secrets, SMTP passwords, email service keys, encryption keys, and all payment processor secrets.

---

## 12. Employee Training

IndieCrowdfund provides AML/CTF and sanctions compliance training to all relevant employees at the time of onboarding and as an annual refresher. Training covers:

- Platform compliance policies and procedures
- Sanctions screening requirements and red flags
- Fraud detection indicators
- Creator verification procedures
- Suspicious activity identification and escalation
- Use of admin tools for enforcement actions
- Audit trail requirements and documentation standards

---

## 13. Independent Review

No independent review has been conducted to date, as the platform recently launched. IndieCrowdfund is in the process of engaging Capital Compliance Experts to conduct the first annual independent review of this AML/CTF and sanctions compliance program, including transaction monitoring controls, creator verification procedures, and sanctions screening processes. Annual independent reviews will be established as a standing requirement going forward.

---

## 14. Payment Collection and Disbursement

### 14.1 How Funds Are Collected

IndieCrowdfund uses an escrow-style model:

**Before campaign reaches funding goal:**
- Backer payment methods are saved via Stripe SetupIntent — no charge occurs
- Cards are authorized but not debited
- Pledges remain in PENDING status

**When campaign reaches funding goal:**
- Automated cron job processes all pending pledges
- PaymentIntents are created with `transfer_data.destination` routing to creator's verified US Stripe account
- Platform collects 3% application fee via `application_fee_amount`

**If campaign fails to reach goal:**
- Saved payment methods are never charged
- Backers owe nothing
- No funds are transferred

### 14.2 How Funds Are Disbursed

Funds are disbursed exclusively through Stripe Connect Express:
- Creator accounts are restricted to US-based individuals (`country: "US"`)
- Stripe automatically transfers funds (minus platform fee) to the creator's connected account
- Stripe's standard payout schedule applies (typically 2–7 business days to creator's bank)
- Platform does not hold funds — transfers are automatic via Stripe Connect

### 14.3 Platform Fee

3% platform fee is collected on all successful transactions via Stripe's `application_fee_amount`, ensuring all revenue flows through and is visible to the platform account.

---

## 15. Campaign Transparency to Donors

IndieCrowdfund ensures campaigns are transparent to backers (donors) through the following requirements:

### 15.1 Required Campaign Information

All campaigns must include:
- Clear project title and description
- Specific funding goal with breakdown of how funds will be used
- Campaign duration (1–60 days)
- Detailed reward tiers with descriptions, pricing, and estimated delivery dates
- Risks and challenges section (mandatory — creators must disclose potential obstacles)
- AI usage disclosure (mandatory — must declare if project involves AI-generated content)
- Creator identity, biography, location, and contact information
- Social media and website links

### 15.2 Creator Accountability

- Creators must post regular updates on campaign progress
- Creators must respond to backer messages and questions
- Campaign pages are permanently archived after campaigns end
- All-or-nothing funding model ensures backers are only charged if the campaign succeeds
- Backers can modify or cancel pledges before the campaign ends

### 15.3 Verified Creator Badges

Creators who complete our full verification process display a verified badge on their profile, giving backers confidence in who they are supporting.

### 15.4 Risk Disclosure

Every campaign is required to include a "Risks and Challenges" section. The platform prominently displays a notice that crowdfunding involves inherent risk — projects may face delays, changes, or may not deliver as planned. IndieCrowdfund is not responsible for reward fulfillment or refunds.

---

## 16. Prohibited Jurisdictions Controls

### 16.1 Structural Controls

- **US-only creator accounts:** Stripe Connect Express hardcoded to `country: "US"`
- **USD-only transactions:** All PaymentIntents created with `currency: "usd"`
- **Stripe KYC:** US-based identity verification (SSN, address, bank account) required
- **Stripe sanctions screening:** Automated OFAC/international screening at onboarding and ongoing

### 16.2 Manual Controls

- Mandatory admin review of all campaigns before going live
- Cross-platform creator audit including identity and history verification
- Government-issued photo ID and Secretary of State business filing required
- All findings documented internally

### 16.3 Automatic Blocking

- Stripe blocks cards issued in comprehensively sanctioned countries (Cuba, Iran, North Korea, Syria, Crimea)
- Bot detection system blocks suspicious IPs automatically
- Rate limiting prevents brute-force and automated attacks

---

## 17. Contact Information

**Compliance and Trust & Safety:**
Email: trust@indiecrowdfund.com

**General Support:**
Email: support@indiecrowdfund.com

**Creator Support:**
Email: creators@indiecrowdfund.com

**Website:** https://www.indiecrowdfund.com

**Governing Law:** State of Indiana, United States

---

*This policy is published in accordance with IndieCrowdfund's Terms of Service (Section 7: Creator Verification & Due Diligence, Section 8: Prohibited Activities), Creator Agreement (Section 7: Identity Verification & Due Diligence), Creator Handbook (Verification tab), and Trust & Safety page. All referenced policies are publicly available at indiecrowdfund.com/terms and indiecrowdfund.com/trust-safety.*
