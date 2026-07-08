# IndieCrowdfund — Prohibited Jurisdictions Compliance Controls

**Date:** March 13, 2026
**Platform:** IndieCrowdfund (indiecrowdfund.com)
**Payment Processor:** Stripe (Stripe Connect Express)

---

## 1. Overview

IndieCrowdfund is a US-based crowdfunding platform that connects independent creators with backers. We have implemented multiple layers of controls to ensure that no transactions are processed to, from, or in support of causes in Stripe's prohibited jurisdictions, including but not limited to Cuba, Iran, North Korea, Syria, the Crimea region of Ukraine, and other sanctioned territories.

---

## 2. Creator Account Restrictions (Fund Recipients)

### US-Only Connected Accounts

All creator accounts are provisioned as **Stripe Connect Express** accounts hardcoded to the United States:

```typescript
// src/lib/payments/stripe/connect.ts
const account = await stripeClient.accounts.create({
  type: "express",
  country: "US",
  email,
  capabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
  },
  business_type: "individual",
});
```

**Effect:** Only individuals who can pass Stripe's US-based identity verification (SSN, US address, US bank account) can receive disbursements. This structurally prevents funds from being routed to prohibited jurisdictions.

### Stripe Connect Onboarding Verification

Before a creator can receive any funds, they must complete Stripe's Express onboarding flow, which includes:

- Government-issued ID verification
- SSN or Tax ID verification
- US bank account verification
- OFAC sanctions list screening (performed by Stripe)

Creators who do not complete onboarding (`isOnboarded: false`) cannot have campaigns go live.

---

## 3. Currency Controls

All transactions on the platform are denominated exclusively in **US Dollars (USD)**:

```typescript
// src/lib/payments/stripe/checkout.ts
const paymentIntent = await stripeClient.paymentIntents.create({
  amount: amountInCents,
  currency: "usd",
  // ...
});
```

No alternative currencies are supported, reducing exposure to jurisdictions where USD transactions would be flagged or blocked.

---

## 4. Admin Project Review Process

Every project on IndieCrowdfund must pass through a **mandatory admin review** before it can accept pledges:

### Review Workflow

1. **DRAFT** — Creator builds their campaign
2. **SUBMITTED** — Creator submits for review
3. **APPROVED / REJECTED / REQUESTED_CHANGES** — Admin reviews the project
4. **LIVE** — Only approved projects can go live and accept pledges

### Review Implementation

```typescript
// src/app/api/admin/projects/review/route.ts
// POST - Submit a project review (approve, reject, request changes)
// Actions: "APPROVED" | "REJECTED" | "REQUESTED_CHANGES"
```

**What admins review:**

- Campaign legitimacy and content compliance
- Creator identity and stated purpose
- Whether the campaign could benefit prohibited entities or jurisdictions
- Compliance with platform Terms of Service and Acceptable Use Policy

All review actions are recorded in an **audit log** with reviewer identity, timestamp, and action taken:

```typescript
await auditLog({
  action: "PROJECT_APPROVE",
  userId: session.user.id,
  details: { action, previousStatus, newStatus, rejectionReason },
});
```

---

## 5. Stripe's Built-In Protections

In addition to our platform-level controls, we rely on Stripe's native compliance infrastructure:

- **Sanctions screening** — Stripe screens all Connect accounts and payment participants against OFAC, EU, UK, and other global sanctions lists
- **Card-issuer country blocking** — Stripe automatically declines transactions from cards issued in comprehensively sanctioned countries
- **Ongoing monitoring** — Stripe continuously monitors connected accounts for changes in risk profile
- **Radar fraud detection** — Stripe Radar provides real-time fraud and risk scoring on all transactions

---

## 6. Escrow Model — Additional Safeguard

Our escrow-based funding model provides an additional layer of protection:

- **Unfunded campaigns:** Backer payment methods are saved via SetupIntent but **not charged** until the campaign reaches its goal
- **Funded campaigns:** Charges are processed with `transfer_data.destination` pointing to the verified US-based creator account
- **Failed campaigns:** If a campaign does not reach its goal, saved payment methods are **never charged** — no funds move

This means there is always a review window between a pledge being made and funds actually being transferred, allowing for intervention if compliance concerns arise.

---

## 7. Platform Fee Structure

The platform collects a **3% application fee** on all successful transactions via Stripe's `application_fee_amount`. This fee structure ensures all transactions flow through and are visible to the platform account, providing full transaction-level visibility for compliance monitoring.

---

## 8. Summary of Controls

| Control Layer | Description |
|---|---|
| **Creator Geography** | Connect Express accounts restricted to US only |
| **Identity Verification** | Stripe KYC/KYB during Express onboarding |
| **Sanctions Screening** | Stripe OFAC screening on all accounts |
| **Currency Restriction** | USD-only transactions |
| **Admin Review** | Mandatory project review before going live |
| **Audit Logging** | All admin actions logged with full traceability |
| **Card-Issuer Blocking** | Stripe blocks cards from sanctioned countries |
| **Escrow Model** | Funds held until campaign success, allowing intervention window |

---

## 9. Ongoing Compliance

IndieCrowdfund is committed to maintaining compliance with Stripe's Prohibited and Restricted Businesses list and all applicable sanctions regulations. We will:

- Promptly remove any campaign found to violate these controls
- Cooperate with Stripe on any compliance inquiries
- Update our controls as Stripe's prohibited jurisdictions list changes
- Maintain audit logs of all administrative actions for accountability
