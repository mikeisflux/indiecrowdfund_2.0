# DivinityCoin Refund Webhook Integration Guide

This document describes the webhook integration between DivinityCoin and IndieCrowdfund for processing refund requests. When DivinityCoin needs to refund coins from a user's balance (e.g., when processing a chargeback, fraud, or cancellation), it sends a webhook to IndieCrowdfund, which validates and processes the request.

---

## Overview

### How User Identification Works

**Important:** DivinityCoin does not need to know the IndieCrowdfund user ID. Instead, provide either:
- The **original card code** that was redeemed, OR
- The **transaction ID** returned when the card was redeemed

IndieCrowdfund will trace the redemption to find which user redeemed the card and process the refund from their balance.

### Flow Diagram

```
┌─────────────────┐                    ┌─────────────────────┐
│   DivinityCoin  │                    │   IndieCrowdfund    │
│     Server      │                    │       Server        │
└────────┬────────┘                    └──────────┬──────────┘
         │                                        │
         │  1. POST /api/webhooks/divinitycoin    │
         │  ─────────────────────────────────────>│
         │  (refund.request with cardCode)        │
         │                                        │
         │                               2. Verify signature
         │                               3. Look up redemption by cardCode
         │                               4. Find user who redeemed
         │                               5. Check balance >= amount
         │                                        │
         │  6a. SUCCESS Response                  │
         │  <─────────────────────────────────────│
         │  (coins deducted, userId returned)     │
         │                                        │
         │         --- OR ---                     │
         │                                        │
         │  6b. FAILURE Response                  │
         │  <─────────────────────────────────────│
         │  (insufficient balance or not found)   │
         │                                        │
         │  7. POST /webhooks/refund-failed       │
         │  <─────────────────────────────────────│
         │  (notification callback if failed)     │
         │                                        │
```

---

## Webhook Endpoint

### URL
```
POST https://indiecrowdfund.com/api/webhooks/divinitycoin
```

### Authentication

All webhook requests must include a signature header for verification.

#### Headers Required

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `X-Webhook-Signature` | HMAC signature (see Signature Verification below) |

#### Signature Format

```
X-Webhook-Signature: t=<timestamp>,v1=<signature>
```

- `timestamp`: Unix timestamp (seconds since epoch) when the request was created
- `signature`: HMAC-SHA256 signature of `{timestamp}.{raw_body}` using the shared webhook secret

#### Signature Verification Example (Node.js)

```javascript
const crypto = require('crypto');

function createWebhookSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${payload}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');

  return `t=${timestamp},v1=${signature}`;
}

// Usage
const body = JSON.stringify(webhookPayload);
const signature = createWebhookSignature(body, WEBHOOK_SECRET);

fetch('https://indiecrowdfund.com/api/webhooks/divinitycoin', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
  },
  body: body,
});
```

**Important**: Timestamps older than 5 minutes (300 seconds) will be rejected to prevent replay attacks.

---

## Refund Request Event

### Event Type
```
refund.request
```

### Request Payload

You can identify the redemption using EITHER the original card code OR the transaction ID:

#### Option 1: Using Original Card Code (Recommended)

```json
{
  "event": "refund.request",
  "data": {
    "refundId": "ref_abc123xyz",
    "amount": 25.00,
    "originalCardCode": "ABCD1234EFGH5678",
    "reason": "Customer requested refund"
  }
}
```

#### Option 2: Using Transaction ID

```json
{
  "event": "refund.request",
  "data": {
    "refundId": "ref_abc123xyz",
    "amount": 25.00,
    "originalTransactionId": "txn_xyz789",
    "reason": "Chargeback received"
  }
}
```

#### Option 3: Using Both (Most Reliable)

```json
{
  "event": "refund.request",
  "data": {
    "refundId": "ref_abc123xyz",
    "amount": 25.00,
    "originalCardCode": "ABCD1234EFGH5678",
    "originalTransactionId": "txn_xyz789",
    "reason": "Fraud investigation"
  }
}
```

### Payload Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | string | Yes | Must be `"refund.request"` |
| `data.refundId` | string | Yes | Unique identifier for this refund request. Used for idempotency. |
| `data.amount` | number | Yes | Amount of DivinityCoin to deduct (positive number) |
| `data.originalCardCode` | string | One required | The card code that was originally redeemed |
| `data.originalTransactionId` | string | One required | DivinityCoin's transaction ID from when the card was redeemed |
| `data.reason` | string | No | Human-readable reason for the refund |

**Note:** At least one of `originalCardCode` or `originalTransactionId` is required.

---

## Response Format

### Successful Refund

HTTP Status: `200 OK`

```json
{
  "success": true,
  "refundId": "ref_abc123xyz",
  "amountDeducted": 25.00,
  "previousBalance": 100.00,
  "newBalance": 75.00,
  "userId": "clxxxxxxxxxx"
}
```

### Failed Refund - Insufficient Balance

HTTP Status: `200 OK` (with error details in body)

```json
{
  "success": false,
  "refundId": "ref_abc123xyz",
  "amountDeducted": 0,
  "previousBalance": 10.00,
  "newBalance": 10.00,
  "userId": "clxxxxxxxxxx",
  "error": "Insufficient balance. User has 10 DivinityCoin, refund requires 25",
  "errorCode": "INSUFFICIENT_BALANCE"
}
```

### Failed Refund - Redemption Not Found

```json
{
  "success": false,
  "refundId": "ref_abc123xyz",
  "amountDeducted": 0,
  "previousBalance": 0,
  "newBalance": 0,
  "error": "Could not find the original redemption. The card code or transaction ID may be invalid.",
  "errorCode": "REDEMPTION_NOT_FOUND"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Whether the refund was processed successfully |
| `refundId` | string | Echo of the refund ID from the request |
| `amountDeducted` | number | Amount actually deducted (0 if failed) |
| `previousBalance` | number | User's balance before the refund |
| `newBalance` | number | User's balance after the refund |
| `userId` | string | IndieCrowdfund user ID (if found) |
| `error` | string | Error message (only if `success: false`) |
| `errorCode` | string | Machine-readable error code (only if `success: false`) |

### Error Codes

| Code | Description | Action Required |
|------|-------------|-----------------|
| `INSUFFICIENT_BALANCE` | User doesn't have enough DivinityCoin | Handle refund differently (cash refund, partial refund, etc.) |
| `REDEMPTION_NOT_FOUND` | Card code or transaction ID not found | Verify the card code or transaction ID is correct |
| `USER_NOT_FOUND` | User account was deleted after redemption | Rare edge case - may need manual handling |
| `INVALID_AMOUNT` | Amount is missing, zero, or negative | Fix the request payload |
| `ALREADY_PROCESSED` | This refundId has already been processed | No action needed - idempotency protection |

---

## Insufficient Balance Callback (Optional)

When a refund fails due to insufficient balance, IndieCrowdfund will also attempt to notify DivinityCoin via a callback endpoint. This is in addition to the webhook response.

### Callback URL
```
POST https://api.divinitycoin.com/v1/webhooks/refund-failed
```

### Callback Headers

| Header | Description |
|--------|-------------|
| `Content-Type` | `application/json` |
| `Authorization` | `Bearer {API_KEY}` |
| `X-Partner-ID` | IndieCrowdfund's partner ID |

### Callback Payload

```json
{
  "refundId": "ref_abc123xyz",
  "platformUserId": "clxxxxxxxxxx",
  "originalCardCode": "ABCD****",
  "originalTransactionId": "txn_xyz789",
  "requestedAmount": 25.00,
  "availableBalance": 10.00,
  "shortfall": 15.00,
  "timestamp": "2025-12-30T12:00:00.000Z",
  "platform": "indiecrowdfund"
}
```

### Callback Fields

| Field | Type | Description |
|-------|------|-------------|
| `refundId` | string | The refund ID that failed |
| `platformUserId` | string | The user's IndieCrowdfund ID |
| `originalCardCode` | string | Masked card code (first 4 chars + ****) |
| `originalTransactionId` | string | Original transaction ID if provided |
| `requestedAmount` | number | Amount that was requested to refund |
| `availableBalance` | number | User's actual available balance |
| `shortfall` | number | How much the user is short (requestedAmount - availableBalance) |
| `timestamp` | string | ISO 8601 timestamp of when the failure occurred |
| `platform` | string | Always "indiecrowdfund" |

**Note**: This callback is best-effort. The primary source of truth is the webhook response.

---

## Implementation Checklist for DivinityCoin

### 1. Store Transaction IDs

When a card is redeemed on IndieCrowdfund, you should receive a transaction confirmation. Store both:
- The card code
- Any transaction ID returned

This allows you to trace the redemption later for refunds.

### 2. Implement Webhook Sending

```javascript
// Example: Sending a refund request to IndieCrowdfund
async function requestRefund(cardCode, amount, reason) {
  const refundId = generateUniqueRefundId(); // e.g., "ref_" + uuid

  const payload = {
    event: "refund.request",
    data: {
      refundId,
      amount,
      originalCardCode: cardCode,  // The card code that was redeemed
      reason,
    },
  };

  const body = JSON.stringify(payload);
  const signature = createWebhookSignature(body, WEBHOOK_SECRET);

  const response = await fetch(
    'https://indiecrowdfund.com/api/webhooks/divinitycoin',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body,
    }
  );

  const result = await response.json();

  if (result.success) {
    // Refund processed - coins deducted from user's IndieCrowdfund balance
    console.log(`Refund ${refundId} successful.`);
    console.log(`User ${result.userId}: ${result.previousBalance} -> ${result.newBalance}`);
    return { success: true, result };
  } else {
    // Refund failed - handle based on errorCode
    console.log(`Refund ${refundId} failed: ${result.error}`);

    switch (result.errorCode) {
      case 'INSUFFICIENT_BALANCE':
        // User doesn't have enough coins - consider alternative refund method
        return { success: false, reason: 'insufficient_balance', details: result };
      case 'REDEMPTION_NOT_FOUND':
        // Card code not found - verify the code is correct
        return { success: false, reason: 'redemption_not_found', details: result };
      case 'ALREADY_PROCESSED':
        // Idempotency - this is actually okay, refund was already done
        return { success: true, reason: 'already_processed', details: result };
      default:
        return { success: false, reason: 'unknown', details: result };
    }
  }
}

// Usage
const result = await requestRefund('ABCD1234EFGH5678', 25.00, 'Customer chargeback');
```

### 3. Implement Refund Failed Callback Handler (Optional)

Create an endpoint at `POST /webhooks/refund-failed` to receive notifications when refunds fail:

```javascript
// POST /webhooks/refund-failed
app.post('/webhooks/refund-failed', async (req, res) => {
  const {
    refundId,
    platformUserId,
    originalCardCode,
    requestedAmount,
    availableBalance,
    shortfall,
  } = req.body;

  // Log for monitoring/alerting
  console.log(`Refund failed: ${refundId}`);
  console.log(`Card: ${originalCardCode}, User: ${platformUserId}`);
  console.log(`Has ${availableBalance}, needs ${requestedAmount} (short by ${shortfall})`);

  // Take action - examples:
  // 1. Flag the card/account for review
  // 2. Send email notification to support team
  // 3. Attempt partial refund for available balance
  // 4. Fall back to cash refund

  await flagForReview({
    cardCode: originalCardCode,
    reason: 'insufficient_divinitycoin_balance',
    refundId,
    shortfall,
  });

  res.json({ received: true });
});
```

### 4. Use Idempotent Refund IDs

Always use unique refund IDs and store them. If you retry a request with the same refundId, IndieCrowdfund will return `ALREADY_PROCESSED` instead of deducting twice.

---

## Testing

### Sandbox Mode

When IndieCrowdfund is running in development/staging mode (`NODE_ENV !== 'production'`), the webhook endpoint will accept requests but may behave differently. Test thoroughly in a staging environment before production.

### Test Ping

You can test webhook connectivity using the `test.ping` event:

```json
{
  "event": "test.ping"
}
```

Response:
```json
{
  "success": true,
  "message": "Webhook received successfully",
  "partnerId": "your_partner_id",
  "sandboxMode": true
}
```

### Get Webhook Info

Send a GET request to the webhook endpoint to see supported events and configuration:

```
GET https://indiecrowdfund.com/api/webhooks/divinitycoin
```

---

## Error Handling Best Practices

1. **Always handle `REDEMPTION_NOT_FOUND`**: Verify the card code is exactly as it was when redeemed (same casing, no extra characters).

2. **Always handle `INSUFFICIENT_BALANCE`**: This is the most common failure case. Have a fallback strategy (e.g., partial refund, cash refund, user notification).

3. **Implement retry logic**: For network failures (5xx errors, timeouts), implement exponential backoff retry.

4. **Use idempotent refundIds**: If a request times out and you're unsure if it was processed, retry with the same refundId. You'll get `ALREADY_PROCESSED` if it succeeded.

5. **Monitor the callback endpoint**: If you implement `/webhooks/refund-failed`, monitor it for patterns (users frequently short on balance, etc.).

---

## Security Considerations

1. **Validate signatures**: Always verify the webhook signature before processing any event IndieCrowdfund sends to you.

2. **Use HTTPS**: All webhook communication should use HTTPS.

3. **Keep secrets secure**: Store the webhook secret securely (environment variables, secrets manager).

4. **Verify partner ID**: Include and verify your partner ID in requests.

---

## Data IndieCrowdfund Stores

When a card is redeemed on IndieCrowdfund, we store:

1. **DivinityCoinRedemption record:**
   - `code`: The full card code (indexed, unique)
   - `userId`: The IndieCrowdfund user who redeemed it
   - `amount`: The amount credited
   - `redeemedAt`: Timestamp

2. **DivinityCoinTransaction record:**
   - `userId`: The user
   - `amount`: The credit amount
   - `type`: "REDEMPTION"
   - `metadata`: JSON with `externalTransactionId` (if provided by DivinityCoin during redemption), `codePrefix`, `codeSuffix`

This allows us to trace any redemption by either the card code or your transaction ID.

---

## Support

For integration support, contact the IndieCrowdfund development team.

### Webhook Secret

Contact IndieCrowdfund admin to obtain or rotate your webhook secret. The secret is configured in:
- Admin Settings > Payments > DivinityCoin > Webhook Secret

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2025-12-30 | Updated to trace user by card code or transaction ID instead of requiring platformUserId |
| 1.0 | 2025-12-30 | Initial refund.request webhook implementation |
