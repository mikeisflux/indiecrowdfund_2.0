# DivinityCoin ↔ IndieCrowdfund Refund Webhook Integration

**Version:** 1.1
**Last Updated:** 2025-12-30
**Status:** Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication](#authentication)
4. [API Specification](#api-specification)
5. [Type Definitions](#type-definitions)
6. [Database Schema](#database-schema)
7. [Implementation Examples](#implementation-examples)
8. [Error Handling](#error-handling)
9. [Testing](#testing)
10. [Security](#security)
11. [Troubleshooting](#troubleshooting)
12. [Changelog](#changelog)

---

## Overview

### Purpose

This webhook allows DivinityCoin to request refunds/deductions from users' DivinityCoin balances on IndieCrowdfund. When a user requests a refund through DivinityCoin, DivinityCoin sends a webhook to IndieCrowdfund to deduct the coins from that user's wallet.

### Key Concepts

- **DivinityCoin does NOT know IndieCrowdfund user IDs** - User identification is done by tracing the original card redemption
- **Card Code Lookup** - Primary method: provide the original card code that was redeemed
- **Transaction ID Lookup** - Secondary method: provide the DivinityCoin transaction ID from the original redemption
- **Balance Verification** - IndieCrowdfund checks if the user has sufficient balance before processing
- **Idempotency** - Duplicate refund requests with the same `refundId` are safely rejected

### Flow Summary

```
1. User redeems DivinityCoin card on IndieCrowdfund
   └─→ IndieCrowdfund stores: code, userId, amount, timestamp

2. Later: User requests refund from DivinityCoin

3. DivinityCoin sends webhook to IndieCrowdfund:
   POST /api/webhooks/divinitycoin
   {
     "event": "refund.request",
     "data": {
       "refundId": "unique_id",
       "amount": 25.00,
       "originalCardCode": "ABCD1234..."
     }
   }

4. IndieCrowdfund:
   a. Looks up card code → finds userId
   b. Checks user's current balance
   c. If balance >= amount: deduct coins, return success
   d. If balance < amount: return INSUFFICIENT_BALANCE error

5. DivinityCoin receives response and proceeds accordingly
```

---

## Architecture

### System Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                              DIVINITYCOIN                                 │
│                                                                          │
│  ┌─────────────┐     ┌─────────────────┐     ┌─────────────────────┐    │
│  │   Refund    │────>│  Webhook        │────>│  Response           │    │
│  │   Request   │     │  Sender         │     │  Handler            │    │
│  └─────────────┘     └────────┬────────┘     └──────────┬──────────┘    │
│                               │                         │                │
│                               │ POST                    │                │
│                               │ /api/webhooks/          │                │
│                               │ divinitycoin            │                │
└───────────────────────────────┼─────────────────────────┼────────────────┘
                                │                         │
                                ▼                         ▲
┌───────────────────────────────┼─────────────────────────┼────────────────┐
│                               │                         │                │
│                        INDIECROWDFUND                   │                │
│                               │                         │                │
│  ┌────────────────────────────▼─────────────────────────┴───────────┐    │
│  │                      Webhook Handler                              │    │
│  │  POST /api/webhooks/divinitycoin                                 │    │
│  │                                                                   │    │
│  │  1. Verify Signature (HMAC-SHA256)                               │    │
│  │  2. Parse Event Type                                              │    │
│  │  3. Route to Handler                                              │    │
│  └───────────────────────────────────────────────────────────────────┘    │
│                                    │                                      │
│                                    ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    handleRefundRequest()                            │  │
│  │                                                                     │  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌────────────────┐  │  │
│  │  │ Look up by      │───>│ Look up by      │───>│ Get User       │  │  │
│  │  │ Card Code       │    │ Transaction ID  │    │ Balance        │  │  │
│  │  │ (Primary)       │    │ (Fallback)      │    │                │  │  │
│  │  └─────────────────┘    └─────────────────┘    └────────┬───────┘  │  │
│  │                                                          │          │  │
│  │                                                          ▼          │  │
│  │  ┌─────────────────────────────────────────────────────────────┐   │  │
│  │  │                  Balance Check                               │   │  │
│  │  │                                                              │   │  │
│  │  │   balance >= amount?                                         │   │  │
│  │  │      │                                                       │   │  │
│  │  │      ├── YES ──> Deduct Balance ──> Create Transaction Log   │   │  │
│  │  │      │                                   │                   │   │  │
│  │  │      │                                   └──> Return SUCCESS │   │  │
│  │  │      │                                                       │   │  │
│  │  │      └── NO ───> Notify DivinityCoin ──> Return FAILURE      │   │  │
│  │  │                  (callback)                                  │   │  │
│  │  └─────────────────────────────────────────────────────────────┘   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                         DATABASE                                    │  │
│  │                                                                     │  │
│  │  ┌─────────────────────┐  ┌────────────────────────────────────┐   │  │
│  │  │ DivinityCoinRedemption│  │ DivinityCoinTransaction           │   │  │
│  │  ├─────────────────────┤  ├────────────────────────────────────┤   │  │
│  │  │ id                  │  │ id                                 │   │  │
│  │  │ code (unique index) │  │ userId                             │   │  │
│  │  │ userId              │  │ amount (+/-)                       │   │  │
│  │  │ amount              │  │ type (REDEMPTION/REFUND_DEDUCTION) │   │  │
│  │  │ redeemedAt          │  │ metadata (JSON)                    │   │  │
│  │  └─────────────────────┘  │ createdAt                          │   │  │
│  │                           └────────────────────────────────────┘   │  │
│  │                                                                     │  │
│  │  ┌─────────────────────┐                                           │  │
│  │  │ User                │                                           │  │
│  │  ├─────────────────────┤                                           │  │
│  │  │ id                  │                                           │  │
│  │  │ divinityCoinBalance │                                           │  │
│  │  │ email               │                                           │  │
│  │  └─────────────────────┘                                           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

### Sequence Diagram

```
DivinityCoin                    IndieCrowdfund                    Database
     │                                │                               │
     │  POST /api/webhooks/divinitycoin                               │
     │  {event: "refund.request", data: {...}}                        │
     │───────────────────────────────>│                               │
     │                                │                               │
     │                                │  Verify X-Webhook-Signature   │
     │                                │──────────────────────────────>│
     │                                │                               │
     │                                │  SELECT * FROM                │
     │                                │  DivinityCoinRedemption       │
     │                                │  WHERE code = ?               │
     │                                │──────────────────────────────>│
     │                                │<──────────────────────────────│
     │                                │  {userId, amount, redeemedAt} │
     │                                │                               │
     │                                │  SELECT divinityCoinBalance   │
     │                                │  FROM User WHERE id = ?       │
     │                                │──────────────────────────────>│
     │                                │<──────────────────────────────│
     │                                │  {balance: 100.00}            │
     │                                │                               │
     │                                │  BEGIN TRANSACTION            │
     │                                │                               │
     │                                │  UPDATE User SET              │
     │                                │  divinityCoinBalance -= 25.00 │
     │                                │──────────────────────────────>│
     │                                │                               │
     │                                │  INSERT INTO                  │
     │                                │  DivinityCoinTransaction      │
     │                                │  (type: REFUND_DEDUCTION)     │
     │                                │──────────────────────────────>│
     │                                │                               │
     │                                │  COMMIT                       │
     │                                │                               │
     │  200 OK                        │                               │
     │  {success: true, ...}          │                               │
     │<───────────────────────────────│                               │
     │                                │                               │
```

---

## Authentication

### Webhook Signature

All requests must include a signature header for verification.

#### Header Format

```
X-Webhook-Signature: t=<timestamp>,v1=<signature>
```

| Component | Description |
|-----------|-------------|
| `t` | Unix timestamp (seconds since epoch) when the request was created |
| `v1` | HMAC-SHA256 signature hex string |

#### Signature Generation Algorithm

```
1. Get current Unix timestamp (seconds)
2. Create signed payload: "{timestamp}.{request_body}"
3. Compute HMAC-SHA256 of signed payload using webhook secret
4. Format: "t={timestamp},v1={hex_signature}"
```

#### Verification Rules

| Rule | Value |
|------|-------|
| Timestamp tolerance | 300 seconds (5 minutes) |
| Algorithm | HMAC-SHA256 |
| Comparison | Constant-time (timing-safe) |

#### Signature Generation Examples

**Node.js**
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
```

**Python**
```python
import hmac
import hashlib
import time

def create_webhook_signature(payload: str, secret: str) -> str:
    timestamp = int(time.time())
    signed_payload = f"{timestamp}.{payload}"
    signature = hmac.new(
        secret.encode('utf-8'),
        signed_payload.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()

    return f"t={timestamp},v1={signature}"
```

**PHP**
```php
function createWebhookSignature(string $payload, string $secret): string {
    $timestamp = time();
    $signedPayload = "{$timestamp}.{$payload}";
    $signature = hash_hmac('sha256', $signedPayload, $secret);

    return "t={$timestamp},v1={$signature}";
}
```

---

## API Specification

### Endpoint

```
POST https://indiecrowdfund.com/api/webhooks/divinitycoin
```

### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | Must be `application/json` |
| `X-Webhook-Signature` | Yes | HMAC signature (see Authentication) |

### Request Body

```json
{
  "event": "refund.request",
  "data": {
    "refundId": "string (required)",
    "amount": "number (required)",
    "originalCardCode": "string (required if no originalTransactionId)",
    "originalTransactionId": "string (required if no originalCardCode)",
    "reason": "string (optional)"
  }
}
```

### Field Specifications

| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `event` | string | Yes | Must be `"refund.request"` | Event type identifier |
| `data.refundId` | string | Yes | Max 255 chars, unique | Idempotency key for this refund |
| `data.amount` | number | Yes | > 0, max 2 decimal places | Amount to deduct |
| `data.originalCardCode` | string | Conditional | Alphanumeric, 8-32 chars | Card code that was redeemed |
| `data.originalTransactionId` | string | Conditional | Max 255 chars | DivinityCoin's original transaction ID |
| `data.reason` | string | No | Max 500 chars | Human-readable reason |

### Response Format

#### Success Response

**HTTP Status:** `200 OK`

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

#### Error Response

**HTTP Status:** `200 OK` (errors are returned in body, not as HTTP errors)

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

### Response Field Specifications

| Field | Type | Always Present | Description |
|-------|------|----------------|-------------|
| `success` | boolean | Yes | Whether the refund was processed |
| `refundId` | string | Yes | Echo of request refundId |
| `amountDeducted` | number | Yes | Amount actually deducted (0 if failed) |
| `previousBalance` | number | Yes | User's balance before operation |
| `newBalance` | number | Yes | User's balance after operation |
| `userId` | string | If found | IndieCrowdfund user ID |
| `error` | string | If failed | Human-readable error message |
| `errorCode` | string | If failed | Machine-readable error code |

### Error Codes

| Code | HTTP Status | Description | Recommended Action |
|------|-------------|-------------|--------------------|
| `INSUFFICIENT_BALANCE` | 200 | User has less coins than refund amount | Process cash refund or partial refund |
| `REDEMPTION_NOT_FOUND` | 200 | Card code/transaction ID not found | Verify identifiers are correct |
| `USER_NOT_FOUND` | 200 | User account deleted after redemption | Manual review required |
| `INVALID_AMOUNT` | 200 | Amount missing, zero, or negative | Fix request payload |
| `ALREADY_PROCESSED` | 200 | This refundId was already processed | No action needed (idempotent) |

### HTTP Error Responses

| Status | Cause |
|--------|-------|
| `400 Bad Request` | Missing signature header or malformed JSON |
| `401 Unauthorized` | Invalid signature or expired timestamp |
| `500 Internal Server Error` | Database error or unexpected failure |

---

## Type Definitions

### TypeScript Definitions

```typescript
// ============================================
// REQUEST TYPES
// ============================================

type DivinityCoinEventType =
  | "test.ping"
  | "card.validate"
  | "card.redeem"
  | "refund.request";

interface DivinityCoinWebhookRequest {
  event: DivinityCoinEventType;
  data?: RefundRequestData;
}

interface RefundRequestData {
  /** Unique identifier for this refund (idempotency key) */
  refundId: string;

  /** Amount of DivinityCoin to deduct (positive number) */
  amount: number;

  /** The card code that was originally redeemed */
  originalCardCode?: string;

  /** DivinityCoin's transaction ID from when card was redeemed */
  originalTransactionId?: string;

  /** Human-readable reason for refund */
  reason?: string;
}

// ============================================
// RESPONSE TYPES
// ============================================

interface RefundSuccessResponse {
  success: true;
  refundId: string;
  amountDeducted: number;
  previousBalance: number;
  newBalance: number;
  userId: string;
}

interface RefundErrorResponse {
  success: false;
  refundId: string;
  amountDeducted: 0;
  previousBalance: number;
  newBalance: number;
  userId?: string;
  error: string;
  errorCode: RefundErrorCode;
}

type RefundErrorCode =
  | "INSUFFICIENT_BALANCE"
  | "REDEMPTION_NOT_FOUND"
  | "USER_NOT_FOUND"
  | "INVALID_AMOUNT"
  | "ALREADY_PROCESSED";

type RefundResponse = RefundSuccessResponse | RefundErrorResponse;

// ============================================
// CALLBACK TYPES (IndieCrowdfund → DivinityCoin)
// ============================================

interface RefundFailedCallback {
  refundId: string;
  platformUserId: string;
  originalCardCode: string | null;
  originalTransactionId: string | null;
  requestedAmount: number;
  availableBalance: number;
  shortfall: number;
  timestamp: string; // ISO 8601
  platform: "indiecrowdfund";
}
```

### JSON Schema

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "DivinityCoin Refund Request",
  "type": "object",
  "required": ["event", "data"],
  "properties": {
    "event": {
      "type": "string",
      "const": "refund.request"
    },
    "data": {
      "type": "object",
      "required": ["refundId", "amount"],
      "properties": {
        "refundId": {
          "type": "string",
          "maxLength": 255,
          "description": "Unique identifier for idempotency"
        },
        "amount": {
          "type": "number",
          "exclusiveMinimum": 0,
          "description": "Amount to deduct"
        },
        "originalCardCode": {
          "type": "string",
          "pattern": "^[A-Z0-9]{8,32}$",
          "description": "Card code that was redeemed"
        },
        "originalTransactionId": {
          "type": "string",
          "maxLength": 255,
          "description": "DivinityCoin transaction ID"
        },
        "reason": {
          "type": "string",
          "maxLength": 500,
          "description": "Reason for refund"
        }
      },
      "anyOf": [
        { "required": ["originalCardCode"] },
        { "required": ["originalTransactionId"] }
      ]
    }
  }
}
```

---

## Database Schema

### Tables Used

#### DivinityCoinRedemption

Stores records of redeemed cards. Primary lookup table for refunds.

```sql
CREATE TABLE DivinityCoinRedemption (
  id            VARCHAR(255) PRIMARY KEY,
  code          VARCHAR(255) UNIQUE NOT NULL,  -- Card code (indexed)
  userId        VARCHAR(255) NOT NULL,          -- FK to User
  amount        DECIMAL(10,2) NOT NULL,         -- Amount credited
  redeemedAt    DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_code (code),
  INDEX idx_userId (userId),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);
```

#### DivinityCoinTransaction

Audit log of all DivinityCoin balance changes.

```sql
CREATE TABLE DivinityCoinTransaction (
  id            VARCHAR(255) PRIMARY KEY,
  userId        VARCHAR(255) NOT NULL,
  pledgeId      VARCHAR(255) NULL,              -- Optional: linked pledge
  amount        DECIMAL(10,2) NOT NULL,         -- Positive=credit, Negative=debit
  type          VARCHAR(50) NOT NULL,           -- REDEMPTION, PAYMENT, REFUND_DEDUCTION
  description   TEXT NULL,
  metadata      TEXT NULL,                      -- JSON audit data
  createdAt     DATETIME DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_userId (userId),
  INDEX idx_type (type),
  INDEX idx_createdAt (createdAt),
  FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE
);
```

#### User (relevant fields)

```sql
-- Relevant fields from User table
ALTER TABLE User ADD COLUMN divinityCoinBalance DECIMAL(10,2) DEFAULT 0;
```

### Transaction Metadata Format

When a refund is processed, the transaction metadata contains:

```json
{
  "refundId": "ref_abc123xyz",
  "originalCardCode": "ABCD****",
  "originalTransactionId": "txn_xyz789",
  "originalRedemption": {
    "code": "ABCD1234EFGH5678",
    "amount": 25.00,
    "redeemedAt": "2025-12-01T10:30:00.000Z"
  },
  "reason": "Customer chargeback",
  "previousBalance": 100.00,
  "newBalance": 75.00,
  "processedAt": "2025-12-30T12:00:00.000Z",
  "source": "divinitycoin_webhook"
}
```

---

## Implementation Examples

### Complete Node.js/TypeScript Client

```typescript
import crypto from 'crypto';

interface RefundOptions {
  cardCode?: string;
  transactionId?: string;
  amount: number;
  reason?: string;
}

interface RefundResult {
  success: boolean;
  refundId: string;
  amountDeducted: number;
  previousBalance: number;
  newBalance: number;
  userId?: string;
  error?: string;
  errorCode?: string;
}

class DivinityCoinRefundClient {
  private webhookUrl: string;
  private webhookSecret: string;

  constructor(webhookUrl: string, webhookSecret: string) {
    this.webhookUrl = webhookUrl;
    this.webhookSecret = webhookSecret;
  }

  private generateRefundId(): string {
    return `ref_${crypto.randomUUID().replace(/-/g, '')}`;
  }

  private createSignature(payload: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signedPayload = `${timestamp}.${payload}`;
    const signature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(signedPayload)
      .digest('hex');

    return `t=${timestamp},v1=${signature}`;
  }

  async requestRefund(options: RefundOptions): Promise<RefundResult> {
    const { cardCode, transactionId, amount, reason } = options;

    if (!cardCode && !transactionId) {
      throw new Error('Either cardCode or transactionId is required');
    }

    const refundId = this.generateRefundId();

    const payload = {
      event: 'refund.request',
      data: {
        refundId,
        amount,
        ...(cardCode && { originalCardCode: cardCode }),
        ...(transactionId && { originalTransactionId: transactionId }),
        ...(reason && { reason }),
      },
    };

    const body = JSON.stringify(payload);
    const signature = this.createSignature(body);

    const response = await fetch(this.webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
      },
      body,
    });

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    return await response.json() as RefundResult;
  }

  async requestRefundWithRetry(
    options: RefundOptions,
    maxRetries: number = 3,
    backoffMs: number = 1000
  ): Promise<RefundResult> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await this.requestRefund(options);

        // Don't retry on business logic errors
        if (!result.success && result.errorCode !== 'ALREADY_PROCESSED') {
          return result;
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        if (attempt < maxRetries - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, backoffMs * Math.pow(2, attempt))
          );
        }
      }
    }

    throw lastError;
  }
}

// Usage Example
async function main() {
  const client = new DivinityCoinRefundClient(
    'https://indiecrowdfund.com/api/webhooks/divinitycoin',
    process.env.WEBHOOK_SECRET!
  );

  try {
    const result = await client.requestRefund({
      cardCode: 'ABCD1234EFGH5678',
      amount: 25.00,
      reason: 'Customer requested refund',
    });

    if (result.success) {
      console.log(`Refund successful!`);
      console.log(`User ${result.userId}: $${result.previousBalance} → $${result.newBalance}`);
    } else {
      console.log(`Refund failed: ${result.error}`);

      switch (result.errorCode) {
        case 'INSUFFICIENT_BALANCE':
          console.log(`User only has $${result.previousBalance}, needs $25`);
          // Process cash refund instead
          break;
        case 'REDEMPTION_NOT_FOUND':
          console.log('Card code not found in system');
          break;
        case 'ALREADY_PROCESSED':
          console.log('This refund was already processed (idempotent)');
          break;
      }
    }
  } catch (error) {
    console.error('Network error:', error);
  }
}
```

### Complete Python Client

```python
import hmac
import hashlib
import time
import json
import uuid
from dataclasses import dataclass
from typing import Optional
import requests

@dataclass
class RefundResult:
    success: bool
    refund_id: str
    amount_deducted: float
    previous_balance: float
    new_balance: float
    user_id: Optional[str] = None
    error: Optional[str] = None
    error_code: Optional[str] = None

class DivinityCoinRefundClient:
    def __init__(self, webhook_url: str, webhook_secret: str):
        self.webhook_url = webhook_url
        self.webhook_secret = webhook_secret

    def _generate_refund_id(self) -> str:
        return f"ref_{uuid.uuid4().hex}"

    def _create_signature(self, payload: str) -> str:
        timestamp = int(time.time())
        signed_payload = f"{timestamp}.{payload}"
        signature = hmac.new(
            self.webhook_secret.encode('utf-8'),
            signed_payload.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        return f"t={timestamp},v1={signature}"

    def request_refund(
        self,
        amount: float,
        card_code: Optional[str] = None,
        transaction_id: Optional[str] = None,
        reason: Optional[str] = None
    ) -> RefundResult:
        if not card_code and not transaction_id:
            raise ValueError("Either card_code or transaction_id is required")

        refund_id = self._generate_refund_id()

        data = {
            "refundId": refund_id,
            "amount": amount,
        }
        if card_code:
            data["originalCardCode"] = card_code
        if transaction_id:
            data["originalTransactionId"] = transaction_id
        if reason:
            data["reason"] = reason

        payload = json.dumps({
            "event": "refund.request",
            "data": data
        })

        signature = self._create_signature(payload)

        response = requests.post(
            self.webhook_url,
            headers={
                "Content-Type": "application/json",
                "X-Webhook-Signature": signature,
            },
            data=payload,
            timeout=30
        )

        response.raise_for_status()
        result = response.json()

        return RefundResult(
            success=result["success"],
            refund_id=result["refundId"],
            amount_deducted=result["amountDeducted"],
            previous_balance=result["previousBalance"],
            new_balance=result["newBalance"],
            user_id=result.get("userId"),
            error=result.get("error"),
            error_code=result.get("errorCode"),
        )

# Usage Example
if __name__ == "__main__":
    import os

    client = DivinityCoinRefundClient(
        webhook_url="https://indiecrowdfund.com/api/webhooks/divinitycoin",
        webhook_secret=os.environ["WEBHOOK_SECRET"]
    )

    result = client.request_refund(
        amount=25.00,
        card_code="ABCD1234EFGH5678",
        reason="Customer requested refund"
    )

    if result.success:
        print(f"Refund successful!")
        print(f"User {result.user_id}: ${result.previous_balance} → ${result.new_balance}")
    else:
        print(f"Refund failed: {result.error}")
        print(f"Error code: {result.error_code}")
```

### Complete PHP Client

```php
<?php

class DivinityCoinRefundClient
{
    private string $webhookUrl;
    private string $webhookSecret;

    public function __construct(string $webhookUrl, string $webhookSecret)
    {
        $this->webhookUrl = $webhookUrl;
        $this->webhookSecret = $webhookSecret;
    }

    private function generateRefundId(): string
    {
        return 'ref_' . bin2hex(random_bytes(16));
    }

    private function createSignature(string $payload): string
    {
        $timestamp = time();
        $signedPayload = "{$timestamp}.{$payload}";
        $signature = hash_hmac('sha256', $signedPayload, $this->webhookSecret);
        return "t={$timestamp},v1={$signature}";
    }

    public function requestRefund(
        float $amount,
        ?string $cardCode = null,
        ?string $transactionId = null,
        ?string $reason = null
    ): array {
        if ($cardCode === null && $transactionId === null) {
            throw new InvalidArgumentException(
                'Either cardCode or transactionId is required'
            );
        }

        $refundId = $this->generateRefundId();

        $data = [
            'refundId' => $refundId,
            'amount' => $amount,
        ];

        if ($cardCode !== null) {
            $data['originalCardCode'] = $cardCode;
        }
        if ($transactionId !== null) {
            $data['originalTransactionId'] = $transactionId;
        }
        if ($reason !== null) {
            $data['reason'] = $reason;
        }

        $payload = json_encode([
            'event' => 'refund.request',
            'data' => $data,
        ]);

        $signature = $this->createSignature($payload);

        $ch = curl_init($this->webhookUrl);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $payload,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                "X-Webhook-Signature: {$signature}",
            ],
            CURLOPT_TIMEOUT => 30,
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $error = curl_error($ch);
        curl_close($ch);

        if ($error) {
            throw new RuntimeException("cURL error: {$error}");
        }

        if ($httpCode !== 200) {
            throw new RuntimeException("HTTP error: {$httpCode}");
        }

        return json_decode($response, true);
    }
}

// Usage Example
$client = new DivinityCoinRefundClient(
    'https://indiecrowdfund.com/api/webhooks/divinitycoin',
    getenv('WEBHOOK_SECRET')
);

try {
    $result = $client->requestRefund(
        amount: 25.00,
        cardCode: 'ABCD1234EFGH5678',
        reason: 'Customer requested refund'
    );

    if ($result['success']) {
        echo "Refund successful!\n";
        echo "User {$result['userId']}: \${$result['previousBalance']} → \${$result['newBalance']}\n";
    } else {
        echo "Refund failed: {$result['error']}\n";
        echo "Error code: {$result['errorCode']}\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
```

---

## Error Handling

### Error Code Reference

| Error Code | Meaning | Response Data | Recommended Handling |
|------------|---------|---------------|---------------------|
| `INSUFFICIENT_BALANCE` | User's balance < refund amount | `previousBalance` shows actual balance | 1. Offer partial refund for available amount<br>2. Process cash refund<br>3. Notify support team |
| `REDEMPTION_NOT_FOUND` | Card code or txn ID not in system | None | 1. Verify code is correct<br>2. Check if code was ever redeemed<br>3. Contact support |
| `USER_NOT_FOUND` | User deleted after redemption | `userId` shows the deleted user | Rare edge case - manual review |
| `INVALID_AMOUNT` | Amount ≤ 0 or missing | None | Fix the request payload |
| `ALREADY_PROCESSED` | Duplicate refundId | `userId`, balances from first request | Safe to ignore - idempotent |

### Handling Insufficient Balance

When `INSUFFICIENT_BALANCE` is returned, the response includes useful data:

```json
{
  "success": false,
  "refundId": "ref_abc123",
  "amountDeducted": 0,
  "previousBalance": 10.00,
  "newBalance": 10.00,
  "userId": "clxxxxxxxxxx",
  "error": "Insufficient balance. User has 10 DivinityCoin, refund requires 25",
  "errorCode": "INSUFFICIENT_BALANCE"
}
```

**Options:**

1. **Partial Refund** - Deduct what's available:
   ```javascript
   const partialAmount = result.previousBalance;
   await client.requestRefund({
     cardCode: 'ABCD...',
     amount: partialAmount,
     reason: 'Partial refund - user only had ' + partialAmount
   });
   ```

2. **Cash Refund** - Process remaining via payment system

3. **Notify User** - Inform them of the shortfall

### Callback for Failed Refunds

When a refund fails due to insufficient balance, IndieCrowdfund also sends a callback:

**Endpoint:** `POST https://api.divinitycoin.com/v1/webhooks/refund-failed`

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

---

## Testing

### Test Ping

Verify webhook connectivity without processing real data:

```json
{
  "event": "test.ping"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Webhook received successfully",
  "partnerId": "your_partner_id",
  "sandboxMode": true
}
```

### Get Webhook Info

```
GET https://indiecrowdfund.com/api/webhooks/divinitycoin
```

Returns supported events and configuration.

### Test Scenarios

| Scenario | Setup | Expected Result |
|----------|-------|-----------------|
| Successful refund | User has balance ≥ amount | `success: true`, balance deducted |
| Insufficient balance | User has balance < amount | `errorCode: INSUFFICIENT_BALANCE` |
| Card not found | Invalid card code | `errorCode: REDEMPTION_NOT_FOUND` |
| Duplicate request | Same refundId twice | `errorCode: ALREADY_PROCESSED` |
| Invalid signature | Wrong secret | HTTP 400 or 401 |
| Expired timestamp | timestamp > 5 min old | HTTP 400 |
| Missing fields | No refundId | `errorCode: INVALID_AMOUNT` |

### Sandbox Mode

In non-production environments (`NODE_ENV !== 'production'`), the webhook operates in sandbox mode. Test thoroughly before production.

---

## Security

### Checklist

- [ ] Store webhook secret in secure environment variables
- [ ] Always verify signature before processing
- [ ] Use HTTPS for all communications
- [ ] Implement idempotency using refundId
- [ ] Log all webhook requests for auditing
- [ ] Set up monitoring for failed refunds
- [ ] Implement rate limiting on your end

### Secret Rotation

To rotate the webhook secret:

1. Contact IndieCrowdfund to generate new secret
2. Update your environment with new secret
3. Both old and new secrets will work during transition
4. Confirm all requests use new secret
5. IndieCrowdfund invalidates old secret

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `400 Bad Request` | Malformed JSON or missing headers | Validate JSON and check Content-Type |
| `401 Unauthorized` | Invalid signature | Verify secret and signature algorithm |
| Signature fails | Timestamp mismatch | Ensure server clock is accurate (NTP) |
| Signature fails | Body modified | Don't modify body after signing |
| `REDEMPTION_NOT_FOUND` | Case sensitivity | Card codes are uppercased: `ABCD` not `abcd` |
| `REDEMPTION_NOT_FOUND` | Extra characters | Remove dashes/spaces from card code |

### Debug Logging

IndieCrowdfund logs all webhook requests with this format:

```
[DivinityCoin] Refund request: ref_abc123, amount: 25, cardCode: ABCD****, txnId: N/A
[DivinityCoin] Found user clxxxxxxxxxx via card code lookup
[DivinityCoin] Refund ref_abc123 processed successfully. User clxxxxxxxxxx: 100 -> 75
```

Request these logs from IndieCrowdfund support when debugging.

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.1 | 2025-12-30 | - User traced by card code instead of requiring platformUserId<br>- Added `originalCardCode` field<br>- Added `REDEMPTION_NOT_FOUND` error code<br>- Response now includes `userId` |
| 1.0 | 2025-12-30 | Initial implementation |

---

## Support

**IndieCrowdfund Integration Support**
- Email: integration@indiecrowdfund.com
- Webhook secret management: Admin Settings > Payments > DivinityCoin

**Documentation URL**
- `GET /api/webhooks/divinitycoin` returns live API documentation
