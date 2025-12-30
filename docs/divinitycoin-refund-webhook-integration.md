# DivinityCoin Refund Webhook Integration Guide

This document describes the webhook integration between DivinityCoin and IndieCrowdfund for processing refund requests. When DivinityCoin needs to refund coins from a user's balance (e.g., when processing a chargeback or cancellation), it sends a webhook to IndieCrowdfund, which validates and processes the request.

---

## Overview

### Flow Diagram

```
┌─────────────────┐                    ┌─────────────────────┐
│   DivinityCoin  │                    │   IndieCrowdfund    │
│     Server      │                    │       Server        │
└────────┬────────┘                    └──────────┬──────────┘
         │                                        │
         │  1. POST /api/webhooks/divinitycoin    │
         │  ─────────────────────────────────────>│
         │  (refund.request event)                │
         │                                        │
         │                               2. Verify signature
         │                               3. Check user exists
         │                               4. Check balance >= amount
         │                                        │
         │  5a. SUCCESS Response                  │
         │  <─────────────────────────────────────│
         │  (coins deducted)                      │
         │                                        │
         │         --- OR ---                     │
         │                                        │
         │  5b. FAILURE Response                  │
         │  <─────────────────────────────────────│
         │  (insufficient balance)                │
         │                                        │
         │  6. POST /webhooks/refund-failed       │
         │  <─────────────────────────────────────│
         │  (notification callback)               │
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

```json
{
  "event": "refund.request",
  "data": {
    "refundId": "ref_abc123xyz",
    "platformUserId": "clxxxxxxxxxx",
    "amount": 25.00,
    "reason": "Customer requested refund",
    "originalTransactionId": "txn_original123"
  }
}
```

### Payload Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `event` | string | Yes | Must be `"refund.request"` |
| `data.refundId` | string | Yes | Unique identifier for this refund request. Used for idempotency. |
| `data.platformUserId` | string | Yes | The IndieCrowdfund user ID (starts with "cl") |
| `data.amount` | number | Yes | Amount of DivinityCoin to deduct (positive number) |
| `data.reason` | string | No | Human-readable reason for the refund |
| `data.originalTransactionId` | string | No | Reference to the original transaction being refunded |

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
  "newBalance": 75.00
}
```

### Failed Refund

HTTP Status: `200 OK` (with error details in body)

```json
{
  "success": false,
  "refundId": "ref_abc123xyz",
  "amountDeducted": 0,
  "previousBalance": 10.00,
  "newBalance": 10.00,
  "error": "Insufficient balance. User has 10 DivinityCoin, refund requires 25",
  "errorCode": "INSUFFICIENT_BALANCE"
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
| `error` | string | Error message (only if `success: false`) |
| `errorCode` | string | Machine-readable error code (only if `success: false`) |

### Error Codes

| Code | Description | Action Required |
|------|-------------|-----------------|
| `INSUFFICIENT_BALANCE` | User doesn't have enough DivinityCoin | DivinityCoin should handle refund differently (cash refund, partial refund, etc.) |
| `USER_NOT_FOUND` | The platformUserId doesn't exist in IndieCrowdfund | Verify the user ID is correct |
| `INVALID_AMOUNT` | Amount is missing, zero, or negative | Fix the request payload |
| `ALREADY_PROCESSED` | This refundId has already been processed | No action needed - this is idempotency protection |

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
| `requestedAmount` | number | Amount that was requested to refund |
| `availableBalance` | number | User's actual available balance |
| `shortfall` | number | How much the user is short (requestedAmount - availableBalance) |
| `timestamp` | string | ISO 8601 timestamp of when the failure occurred |
| `platform` | string | Always "indiecrowdfund" |

**Note**: This callback is best-effort. The primary source of truth is the webhook response. If this endpoint doesn't exist or returns an error, the refund failure is still valid.

---

## Implementation Checklist for DivinityCoin

### 1. Implement Webhook Sending

```javascript
// Example: Sending a refund request to IndieCrowdfund
async function requestRefund(userId, amount, reason) {
  const refundId = generateUniqueRefundId(); // e.g., "ref_" + uuid

  const payload = {
    event: "refund.request",
    data: {
      refundId,
      platformUserId: userId,
      amount,
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
    console.log(`Refund ${refundId} successful. New balance: ${result.newBalance}`);
    return { success: true, result };
  } else {
    // Refund failed - handle based on errorCode
    console.log(`Refund ${refundId} failed: ${result.error}`);

    switch (result.errorCode) {
      case 'INSUFFICIENT_BALANCE':
        // User doesn't have enough coins - consider alternative refund method
        return { success: false, reason: 'insufficient_balance', details: result };
      case 'USER_NOT_FOUND':
        // Invalid user ID
        return { success: false, reason: 'user_not_found', details: result };
      case 'ALREADY_PROCESSED':
        // Idempotency - this is actually okay, refund was already done
        return { success: true, reason: 'already_processed', details: result };
      default:
        return { success: false, reason: 'unknown', details: result };
    }
  }
}
```

### 2. Implement Refund Failed Callback Handler (Optional)

Create an endpoint at `POST /webhooks/refund-failed` to receive notifications when refunds fail:

```javascript
// POST /webhooks/refund-failed
app.post('/webhooks/refund-failed', async (req, res) => {
  const {
    refundId,
    platformUserId,
    requestedAmount,
    availableBalance,
    shortfall,
    timestamp,
  } = req.body;

  // Log for monitoring/alerting
  console.log(`Refund failed: ${refundId}`);
  console.log(`User ${platformUserId} has ${availableBalance}, needs ${requestedAmount}`);

  // Take action - examples:
  // 1. Flag the account for review
  // 2. Send email notification to support team
  // 3. Attempt partial refund
  // 4. Fall back to cash refund

  await flagAccountForReview(platformUserId, {
    reason: 'insufficient_divinitycoin_balance',
    refundId,
    shortfall,
  });

  res.json({ received: true });
});
```

### 3. Store refundId for Idempotency

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

1. **Always handle `INSUFFICIENT_BALANCE`**: This is the most common failure case. Have a fallback strategy (e.g., partial refund, cash refund, user notification).

2. **Implement retry logic**: For network failures (5xx errors, timeouts), implement exponential backoff retry.

3. **Use idempotent refundIds**: If a request times out and you're unsure if it was processed, retry with the same refundId. You'll get `ALREADY_PROCESSED` if it succeeded.

4. **Monitor the callback endpoint**: If you implement `/webhooks/refund-failed`, monitor it for patterns (users frequently short on balance, etc.).

---

## Security Considerations

1. **Validate signatures**: Always verify the webhook signature before processing any event IndieCrowdfund sends to you.

2. **Use HTTPS**: All webhook communication should use HTTPS.

3. **Keep secrets secure**: Store the webhook secret securely (environment variables, secrets manager).

4. **Verify partner ID**: Include and verify your partner ID in requests.

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
| 1.0 | 2025-12-30 | Initial refund.request webhook implementation |
