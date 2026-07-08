# DivinityCoin Pre-Charge Chargeback-Ban Prefilter Spec

**Version:** 1.0
**Audience:** DivinityCoin engineering / risk team
**Owner:** IndieCrowdfund
**Last Updated:** June 18, 2026

---

## 1. Background

IndieCrowdfund's Terms of Service make filing a chargeback against IndieCrowdfund or any of our payment processors (including DivinityCoin) an immediate permanent ban condition — **for the disputing account AND every future account created under the same email, payment method, IP address, or device fingerprint.**

The full policy is at <https://indiecrowdfund.com/terms?tab=chargebacks>.

IndieCrowdfund enforces the ban on the platform side: locked accounts, IP blocklist, session revocation, and a periodic propagation cron that finds matching identifiers and bans those accounts too.

This spec describes what we want DivinityCoin to add **on the payment-processor side** so that a banned user cannot get a charge through by re-registering under a new email / new IP / different device while reusing the same card or billing identity.

The goal: **stop the charge at the rail before it is authorized, not catch it after a chargeback hits.**

---

## 2. What IndieCrowdfund Will Send to DivinityCoin

IndieCrowdfund will expose a new endpoint:

```
GET https://indiecrowdfund.com/api/divinitycoin/chargeback-ban-signals
Authorization: Bearer <DC_API_KEY>
```

Response shape (JSON, 200):

```json
{
  "updated_at": "2026-06-18T15:00:00Z",
  "signals": [
    {
      "source_user_id": "cmk1...",
      "banned_at": "2026-06-17T22:34:10Z",
      "reason": "chargeback",
      "identifiers": {
        "emails": ["jane@example.com", "janedoe@example.com"],
        "phones": ["+15551234567"],
        "billing_names": ["Jane Doe", "J. Doe"],
        "billing_addresses": [
          {
            "line1": "123 Maple St",
            "line2": null,
            "city": "Springfield",
            "state": "IL",
            "postal_code": "62701",
            "country": "US"
          }
        ],
        "card_fingerprints": [
          "Stripe-style payment_method.card.fingerprint values, if available"
        ],
        "last_known_ips": ["73.9.8.34"],
        "device_fingerprints": []
      }
    }
  ]
}
```

Fields explained:

- `source_user_id` — IndieCrowdfund's internal user id of the originally banned account. Provided for audit correlation.
- `banned_at` — When IndieCrowdfund applied the ban. Use to drop old signals if you choose (e.g., after 7 years, or never).
- `reason` — Currently always `"chargeback"`. Reserved field for future ban-class differentiation (e.g., `"fraud"`, `"abuse"`).
- `identifiers.emails` — Lowercased, trimmed. May include canonicalized variants we've observed.
- `identifiers.phones` — E.164 format. Best-effort; not always present.
- `identifiers.billing_names` — Normalized (whitespace collapsed, case-preserved). Best-effort.
- `identifiers.billing_addresses` — Postal-format objects. Multiple addresses per banned user are possible if they've pledged with different ones.
- `identifiers.card_fingerprints` — Whatever stable card fingerprint your underlying acquirer exposes. Optional.
- `identifiers.last_known_ips` — IPv4/IPv6 strings. May include CGNAT/VPN IPs that match many users; DC should weight these as a soft signal, not a hard block on their own.
- `identifiers.device_fingerprints` — Browser/device fingerprint hashes we have captured (future / optional).

### Update Cadence

- IndieCrowdfund will refresh the feed every 5 minutes
- The endpoint always returns the **full** current ban list — not a delta. This keeps DC's side stateless and resilient to missed polls.
- DC should re-pull every 15 minutes minimum, 5 minutes recommended.

### Authentication

- A long-lived bearer token issued by IndieCrowdfund's admin panel
- IP-restricted to DC's egress range (we'll lock it down once we exchange ranges)
- Rate limited to one request per 10 seconds

---

## 3. What We Want DivinityCoin to Do With It

### 3.1 Pre-Authorization Check

On every `create-payment-intent` call originating from IndieCrowdfund (i.e., `metadata.partnerId === "<IndieCrowdfund partner id>"`), before submitting the authorization to the card network, run a match check against the cached ban list:

| Identifier | Hard Block (reject the charge) | Soft Flag (allow but log + notify) |
|---|---|---|
| `card_fingerprint` match | ✅ | — |
| `email` exact match (case-insensitive) | ✅ | — |
| `phone` exact match (E.164) | ✅ | — |
| `billing_name + billing_address` both match | ✅ | — |
| `billing_address` only (no name) | — | ✅ |
| `last_known_ip` only | — | ✅ |
| `device_fingerprint` match | ✅ | — |

A **hard block** means: do NOT submit the authorization, return an error to IndieCrowdfund's API client, and surface it as a decline with a specific code:

```json
{
  "success": false,
  "error": "Payment blocked: account associated with prior chargeback.",
  "code": "chargeback_ban_match",
  "matched_signals": ["card_fingerprint", "email"]
}
```

IndieCrowdfund will translate this to a user-facing message and prevent the pledge from being created. The matched_signals field is for our logs only; **do not return it to the end user in your default error string** — that gives a fraud signal to the attacker.

A **soft flag** means: still submit the auth, but include the match details in the response payload so IndieCrowdfund can log them and surface them to admin review:

```json
{
  "success": true,
  "status": "succeeded",
  "paymentIntentId": "pi_...",
  "soft_flags": ["billing_address_match", "ip_match"]
}
```

### 3.2 Match Logic

- **Emails** — compare normalized (trim, lowercase). Plus-aliasing on Gmail (`user+tag@gmail.com` → `user@gmail.com`) should match. Dot-aliasing on Gmail should also match.
- **Phones** — strict E.164 match.
- **Names** — case-insensitive, whitespace-normalized exact match. Don't try fuzzy matching here; false positives are worse than false negatives.
- **Addresses** — match on `(line1, postal_code, country)` triple. Country is required; if either side lacks a country, skip the match.
- **Card fingerprint** — exact equality.
- **IP** — exact equality. Consider exposing a separate "shared-NAT allowlist" admin tool so DC can drop signals known to be CGNAT exits.

### 3.3 Reporting Back

After every blocked charge, DC should POST to:

```
POST https://indiecrowdfund.com/api/divinitycoin/chargeback-ban-blocked
Authorization: Bearer <ICF_WEBHOOK_SECRET>
Content-Type: application/json
```

with:

```json
{
  "blocked_at": "2026-06-18T15:01:23Z",
  "attempted_amount_cents": 2500,
  "attempted_currency": "usd",
  "matched_signals": ["card_fingerprint", "email"],
  "source_user_ids": ["cmk1..."],
  "attempted_email": "newalt@example.com",
  "attempted_ip": "73.9.8.34",
  "attempted_card_last4": "1175",
  "attempted_card_brand": "visa",
  "attempted_billing_postal_code": "97123"
}
```

This lets IndieCrowdfund:

- Audit how often the prefilter is firing
- Detect when a banned user is actively trying to create new accounts (which itself is a signal to widen the ban net via our cron)
- Pre-emptively lock the new account on our side as soon as a charge attempt is blocked

---

## 4. Edge Cases and Disagreements We Need to Settle

1. **Shared households / shared cards.** Two legitimate users who share a card or live at the same address. We accept the small risk of false positives here — a banned account's spouse will need to use a different card. If DC pushes back on this we can downgrade `card_fingerprint` to soft-flag instead of hard-block, but our preference is hard-block.

2. **Card replaced.** If a banned user replaces their card with a new one, the card fingerprint won't match. We rely on email, address, name, and phone to catch that. DC should not allow itself to be reasoned out of those signals.

3. **IP reuse via mobile carriers / VPNs.** IP is a soft signal for a reason. Accept it as supporting evidence only.

4. **Ban removal.** Bans are permanent under our ToS. IndieCrowdfund will not have a "lift ban" admin action. Therefore DC does not need to handle un-banning. If a signal entry disappears from the feed, treat it as no longer in the ban list (graceful), but understand that we don't currently plan to remove entries.

5. **Pre-existing pledges from banned users.** DC may have a customer-vault record for a now-banned user. On the next charge against that vault id, the prefilter still fires (because the card fingerprint signal still matches). This is intentional.

6. **Saved-card off-session charges (upcharges / modifications).** Run the same prefilter on those too — IndieCrowdfund's chargeback policy applies equally to upcharges.

---

## 5. Implementation Order (Suggested)

1. **Phase 1 (Week 1):** DC stands up the `/api/divinitycoin/chargeback-ban-signals` consumer. Caches the list. Logs match data but does not block. Posts back the would-have-blocked events. This lets both sides verify the feed and match logic without breaking real charges.

2. **Phase 2 (Week 2-3):** DC starts hard-blocking on the highest-confidence signals: `card_fingerprint`, `email`, `phone`. Soft-flagging everything else. IndieCrowdfund tunes the feed (false-positive reports).

3. **Phase 3 (Week 4+):** DC adds the `billing_name + billing_address` and `device_fingerprint` hard-blocks. IndieCrowdfund begins capturing device fingerprints in the auth flow.

---

## 6. Operational

- **Logging:** Both sides retain match logs for 1 year minimum
- **Privacy:** The signal feed is PII-heavy. DC must treat it as restricted, encrypt at rest, and not share it with third-party fraud vendors without explicit ICF consent
- **Disputes from DC's side:** If DC believes a banned user has been incorrectly flagged (e.g., suspected ICF error), DC engineering opens a ticket via <support@indiecrowdfund.com> with the `source_user_id`. ICF reviews and either confirms the ban or removes the signal
- **Incident response:** If the feed endpoint is down for >1 hour, DC should fail open (allow charges) and alert; if down for >24 hours, DC should escalate

---

## 7. Open Questions for DC

1. What is your existing fraud-rules engine? Can we layer this in as a rule, or does it need a separate hook?
2. Do you already capture card fingerprints (Stripe `payment_method.card.fingerprint` or NMI vault fingerprints) on each authorization? If yes, we can rely on that; if not, do you have a plan to expose one?
3. What's your preferred decline code for the soft-flag scenario, if any?
4. Are you willing to add a header on the inbound charge request that echoes back the cached feed timestamp you used? That would let us debug staleness end-to-end.

---

## Contact

- **Spec owner (ICF):** support@indiecrowdfund.com
- **DC contact (please fill):** _________________
- **Target rollout date:** _________________
