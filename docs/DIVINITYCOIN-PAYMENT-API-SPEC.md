# DivinityCoin Seamless Payment Integration Spec

## The Big Picture

DivinityCoin becomes a **seamless, white-label payment processor** for IndieK. The backer enters their credit card on IndieK, clicks "Pledge $50", and they're done. They never see DivinityCoin, never see a wallet, never see a gift card code.

Behind the scenes, the gift card system still exists as the **compliance layer** that separates Stripe from adult/NSFW content. Stripe sees "DivinityCoin digital product purchase" - a perfectly legitimate transaction. The actual content on IndieK is not Stripe's concern.

### Current Flow (bad UX, lots of friction):
```
Backer → goes to divinitycoin.com → buys $50 gift card via Stripe →
gets voucher code → comes back to IndieK → redeems code in wallet →
goes to pledge page → pays $50 from balance
```

### New Flow (seamless, zero friction):
```
Backer → enters card on IndieK → clicks "Pledge $50" → done
```

### What happens behind the scenes:
```
1. IndieK backend calls DivinityCoin API: "Process $50 for pledge XYZ"
2. DivinityCoin creates a Stripe PaymentIntent on THEIR Stripe account
3. DivinityCoin returns the Stripe client_secret to IndieK
4. IndieK frontend renders Stripe Elements using DivinityCoin's publishable key
5. Backer enters card → Stripe processes it → money lands in DivinityCoin's Stripe
6. DivinityCoin internally auto-generates a $50 gift card + auto-redeems it (audit trail)
7. DivinityCoin sends webhook to IndieK: "payment succeeded for pledge XYZ"
8. IndieK marks pledge as COMPLETED, sends confirmation email

What Stripe sees: "Customer purchased $50 DivinityCoin digital product"
What backer sees: "I entered my card and pledged $50"
What the audit trail shows: Gift card created → redeemed → applied to pledge
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                      BACKER'S BROWSER                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  IndieK Pledge Page                                        │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  Stripe Elements (loaded with DivinityCoin's         │  │  │
│  │  │  Stripe publishable key - NOT IndieK's)              │  │  │
│  │  │  ┌─────────────────┐ ┌────────┐ ┌────────────────┐  │  │  │
│  │  │  │  Card Number    │ │ MM/YY  │ │     CVC        │  │  │  │
│  │  │  └─────────────────┘ └────────┘ └────────────────┘  │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                            │  │
│  │  [ Pledge $50.00 ]                                         │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────┬────────────────────────────────────┬──────────────────┘
           │                                    │
           │ Card data goes directly to         │ IndieK backend only
           │ Stripe (DivinityCoin's account)    │ sends pledgeId + amount
           │                                    │
           ▼                                    ▼
┌─────────────────────┐              ┌──────────────────────────┐
│  Stripe             │              │  IndieK Backend          │
│  (DivinityCoin's    │              │                          │
│   Stripe account)   │              │  POST /api/pledges       │
│                     │              │  → calls DivinityCoin    │
│  Sees: "DivinityCoin│              │    API to create intent  │
│  digital product    │              │  → returns clientSecret  │
│  purchase"          │              │                          │
└────────┬────────────┘              └──────────┬───────────────┘
         │                                      │
         │ Payment succeeds                     │
         ▼                                      │
┌──────────────────────────┐                    │
│  DivinityCoin Backend    │                    │
│                          │                    │
│  1. Receives Stripe      │   webhook:         │
│     payment success      │   "payment         │
│  2. Auto-creates $50     │   succeeded"       │
│     gift card (internal) │────────────────────►│
│  3. Auto-redeems to      │                    │
│     backer account       │                    │
│  4. Creates audit trail  │                    │
│  5. Sends webhook to     │                    │
│     IndieK               │                    │
│                          │                    │
│  Stripe sees: gift card  │                    │
│  Audit shows: compliant  │                    │
└──────────────────────────┘                    │
```

---

## Part 1: What DivinityCoin Needs to Build

Since DivinityCoin already uses Stripe, this is essentially building a thin API layer on top of DivinityCoin's existing Stripe integration.

### 1.1 Core Payment API

#### `POST /api/v1/payment-intents`

Creates a Stripe PaymentIntent on DivinityCoin's Stripe account. Returns the client_secret so IndieK can render Stripe Elements.

**Request:**
```json
{
  "amount": 5000,
  "currency": "usd",
  "partner_id": "partner_indiecrowdfund",
  "metadata": {
    "pledgeId": "pledge_abc123",
    "projectId": "project_xyz",
    "userId": "user_456",
    "platform": "indiecrowdfund"
  },
  "customer_id": "dcust_789",
  "statement_descriptor": "INDIECROWDFUND"
}
```

**What DivinityCoin does internally:**
```python
# Pseudocode for DivinityCoin's implementation
def create_payment_intent(request):
    # 1. Create Stripe PaymentIntent on DivinityCoin's Stripe account
    stripe.api_key = DIVINITYCOIN_STRIPE_SECRET_KEY
    intent = stripe.PaymentIntent.create(
        amount=request.amount,
        currency=request.currency,
        # Statement descriptor shows "DIVINITYCOIN" or custom text
        statement_descriptor=request.statement_descriptor or "DIVINITYCOIN",
        metadata={
            "partner": request.partner_id,
            "type": "gift_card_purchase",  # <-- This is what Stripe sees
            **request.metadata
        },
        customer=get_or_create_stripe_customer(request.customer_id),
    )

    # 2. Store the mapping: payment_intent_id → partner metadata
    db.save_pending_transaction(
        stripe_intent_id=intent.id,
        partner_id=request.partner_id,
        metadata=request.metadata,
        amount=request.amount,
    )

    # 3. Return client_secret to IndieK
    return {
        "id": f"dpi_{intent.id}",
        "client_secret": intent.client_secret,  # IndieK passes this to Stripe Elements
        "status": intent.status,
        "amount": request.amount,
    }
```

**Response:**
```json
{
  "id": "dpi_pi_3ABC123",
  "client_secret": "pi_3ABC123_secret_XYZ789",
  "amount": 5000,
  "currency": "usd",
  "status": "requires_payment_method"
}
```

**Key point:** The `client_secret` is literally the Stripe PaymentIntent client secret from DivinityCoin's Stripe account. IndieK uses this with Stripe Elements + DivinityCoin's Stripe publishable key.

---

#### `GET /api/v1/payment-intents/:id`

Check status of a payment.

**Response:**
```json
{
  "id": "dpi_pi_3ABC123",
  "amount": 5000,
  "status": "succeeded",
  "payment_method": {
    "type": "card",
    "brand": "visa",
    "last4": "4242"
  },
  "gift_card": {
    "code": "DC-XXXXXXXX",
    "created_at": "2026-02-13T10:01:30Z",
    "auto_redeemed": true
  },
  "metadata": { ... }
}
```

---

### 1.2 Setup Intents API (Save Card for Unfunded Campaigns)

For campaigns that haven't reached their goal yet - save the card, charge later.

#### `POST /api/v1/setup-intents`

**Request:**
```json
{
  "partner_id": "partner_indiecrowdfund",
  "customer_id": "dcust_789",
  "metadata": {
    "pledgeId": "pledge_abc123",
    "projectId": "project_xyz",
    "amount": 5000
  }
}
```

**What DivinityCoin does internally:**
```python
def create_setup_intent(request):
    stripe.api_key = DIVINITYCOIN_STRIPE_SECRET_KEY
    intent = stripe.SetupIntent.create(
        customer=get_stripe_customer(request.customer_id),
        payment_method_types=["card"],
        metadata={
            "partner": request.partner_id,
            "type": "saved_card_for_future_gift_card",
            **request.metadata
        },
    )
    return {
        "id": f"dsi_{intent.id}",
        "client_secret": intent.client_secret,
        "status": intent.status,
    }
```

**Response:**
```json
{
  "id": "dsi_seti_3XYZ456",
  "client_secret": "seti_3XYZ456_secret_ABC123",
  "status": "requires_payment_method",
  "customer_id": "dcust_789"
}
```

---

#### `POST /api/v1/customers/:id/charge`

Charge a saved card when campaign reaches its goal. DivinityCoin creates a PaymentIntent using the saved payment method.

**Request:**
```json
{
  "amount": 5000,
  "currency": "usd",
  "payment_method_id": "dpm_pm_1ABC123",
  "metadata": {
    "pledgeId": "pledge_abc123",
    "type": "campaign_funded_collection"
  }
}
```

**What DivinityCoin does internally:**
```python
def charge_saved_card(customer_id, request):
    stripe.api_key = DIVINITYCOIN_STRIPE_SECRET_KEY
    intent = stripe.PaymentIntent.create(
        amount=request.amount,
        currency=request.currency,
        customer=get_stripe_customer(customer_id),
        payment_method=get_stripe_pm(request.payment_method_id),
        off_session=True,
        confirm=True,
        metadata={
            "type": "gift_card_purchase",
            **request.metadata
        },
    )

    if intent.status == "succeeded":
        # Auto-generate gift card + auto-redeem
        create_and_redeem_gift_card(customer_id, request.amount, request.metadata)

    return {"id": f"dpi_{intent.id}", "status": intent.status}
```

**Response:**
```json
{
  "id": "dpi_pi_3NEW789",
  "status": "succeeded",
  "amount": 5000
}
```

---

### 1.3 Customers API

#### `POST /api/v1/customers`

Creates a customer record on DivinityCoin (and a corresponding Stripe customer on DivinityCoin's Stripe).

**Request:**
```json
{
  "email": "backer@example.com",
  "name": "John Doe",
  "partner_id": "partner_indiecrowdfund",
  "metadata": {
    "indiek_user_id": "user_456"
  }
}
```

**What DivinityCoin does:** Creates both a DivinityCoin customer record AND a Stripe customer on their Stripe account.

**Response:**
```json
{
  "id": "dcust_789",
  "email": "backer@example.com"
}
```

#### `GET /api/v1/customers/:id/payment-methods`

List saved cards.

**Response:**
```json
{
  "data": [
    {
      "id": "dpm_pm_1ABC123",
      "type": "card",
      "brand": "visa",
      "last4": "4242",
      "exp_month": 12,
      "exp_year": 2027
    }
  ]
}
```

---

### 1.4 Refunds API

#### `POST /api/v1/refunds`

**Request:**
```json
{
  "payment_intent_id": "dpi_pi_3ABC123",
  "amount": 5000,
  "reason": "campaign_failed",
  "metadata": {
    "pledgeId": "pledge_abc123"
  }
}
```

**What DivinityCoin does:** Refunds via Stripe, voids the internal gift card.

**Response:**
```json
{
  "id": "dref_abc123",
  "status": "succeeded",
  "amount": 5000
}
```

---

### 1.5 Webhook Delivery (DivinityCoin → IndieK)

When a payment succeeds (Stripe notifies DivinityCoin), DivinityCoin should:

1. Auto-create the internal gift card for the exact amount
2. Auto-redeem it to the backer's DivinityCoin account (create account if needed)
3. Record the audit trail
4. Send a webhook to IndieK

**Events to deliver:**

| Event | Trigger |
|-------|---------|
| `payment.succeeded` | Stripe PaymentIntent succeeded → gift card created & redeemed |
| `payment.failed` | Stripe PaymentIntent failed |
| `setup.succeeded` | Card saved successfully via SetupIntent |
| `refund.completed` | Refund processed |

**Webhook payload:**
```json
{
  "id": "evt_abc123",
  "type": "payment.succeeded",
  "data": {
    "payment_intent_id": "dpi_pi_3ABC123",
    "amount": 5000,
    "currency": "usd",
    "status": "succeeded",
    "gift_card": {
      "code": "DC-A1B2C3D4",
      "amount": 5000,
      "auto_redeemed": true
    },
    "payment_method": {
      "type": "card",
      "brand": "visa",
      "last4": "4242"
    },
    "metadata": {
      "pledgeId": "pledge_abc123",
      "projectId": "project_xyz",
      "userId": "user_456"
    }
  },
  "created_at": "2026-02-13T10:01:30Z"
}
```

**Signature:** Same HMAC-SHA256 format already in use:
```
X-Webhook-Signature: t=1707825600,v1=<hmac_hex>
```

---

### 1.6 The Internal Gift Card Flow (Compliance Layer)

This is the key piece. When a payment succeeds, DivinityCoin:

```python
def on_payment_succeeded(stripe_payment_intent):
    """Called by Stripe webhook on DivinityCoin's side"""

    metadata = stripe_payment_intent.metadata
    amount = stripe_payment_intent.amount  # in cents

    # 1. Generate internal gift card
    gift_card = GiftCard.create(
        code=generate_unique_code(),  # e.g., "DC-A1B2C3D4"
        amount_cents=amount,
        purchased_via="stripe",
        stripe_payment_intent_id=stripe_payment_intent.id,
        partner_id=metadata.get("partner"),
        status="ACTIVE",
        # This is what makes it compliant:
        product_type="digital_gift_card",
        description=f"DivinityCoin Gift Card - ${amount/100:.2f}",
    )

    # 2. Auto-redeem to backer's DivinityCoin account
    customer = get_customer(metadata.get("customer_id"))
    redemption = Redemption.create(
        gift_card_id=gift_card.id,
        customer_id=customer.id,
        amount_cents=amount,
        auto_redeemed=True,  # Flag that this was system-initiated
    )

    # 3. Credit the internal balance
    customer.balance += amount
    customer.save()

    # 4. Create audit trail
    Transaction.create(
        customer_id=customer.id,
        type="AUTO_PURCHASE_AND_REDEEM",
        amount_cents=amount,
        gift_card_code=gift_card.code,
        stripe_payment_intent_id=stripe_payment_intent.id,
        partner_metadata=metadata,
    )

    # 5. Notify IndieK via webhook
    send_webhook(
        url=partner.webhook_url,
        event="payment.succeeded",
        data={
            "payment_intent_id": f"dpi_{stripe_payment_intent.id}",
            "amount": amount,
            "gift_card": {
                "code": gift_card.code,
                "auto_redeemed": True,
            },
            "metadata": metadata,
        }
    )
```

**Audit trail for any gift card purchase looks like:**
```
2026-02-13 10:01:28  GIFT_CARD_CREATED    DC-A1B2C3D4  $50.00  stripe:pi_3ABC123
2026-02-13 10:01:28  GIFT_CARD_REDEEMED   DC-A1B2C3D4  $50.00  customer:dcust_789
2026-02-13 10:01:28  BALANCE_CREDITED     dcust_789     $50.00  gift_card:DC-A1B2C3D4
```

This is a legitimate digital product sale. The gift card exists. It was purchased. It was redeemed. It's just automated.

---

### 1.7 Authentication

**Server-to-server (IndieK backend → DivinityCoin API):**
```
Authorization: Bearer dsk_live_<secret_key>
X-Partner-ID: partner_indiecrowdfund
Content-Type: application/json
```

**Browser-side (for Stripe Elements):**
IndieK loads Stripe Elements using DivinityCoin's **Stripe publishable key** (`pk_live_divinitycoin...`). This is safe to expose - it can only be used to confirm payment/setup intents that were already created server-side.

**Key types:**
| Key | Where Used | Example |
|-----|-----------|---------|
| DivinityCoin API Secret Key | IndieK backend → DC API | `dsk_live_abc123...` |
| DivinityCoin Stripe Publishable Key | IndieK frontend → Stripe | `pk_live_dcstripe...` |
| Webhook Secret | DC → IndieK webhook signing | `whsec_xyz789...` |

---

### 1.8 Settlement & Payouts to Creators

DivinityCoin collects all the money in their Stripe account. When an IndieK campaign is funded and ready for payout:

1. IndieK admin triggers "Initiate Payout" in admin panel
2. IndieK calls `POST /api/v1/payouts` on DivinityCoin
3. DivinityCoin transfers funds to creator's bank account

#### `POST /api/v1/payouts`

```json
{
  "amount": 47000,
  "currency": "usd",
  "destination": {
    "bank_name": "Chase",
    "routing_number": "021000021",
    "account_number": "123456789",
    "account_holder": "Creator Studios LLC",
    "account_type": "checking"
  },
  "metadata": {
    "projectId": "project_xyz",
    "settlementId": "settlement_abc",
    "platform": "indiecrowdfund"
  }
}
```

DivinityCoin can process this via ACH, wire, or even Stripe payouts. The existing `DivinityCoinBankAccount` and `DivinityCoinSettlement` models on IndieK already support this.

---

## Part 2: What IndieK Needs to Change

### 2.1 Frontend: Replace Balance UI with Card Form

The DivinityCoin section in `PaymentStep.tsx` changes from:
- Balance card showing "You have $X" / "You need $X more"
- "Pay with DivinityCoin" button

To:
- Standard card input form (Stripe Elements, loaded with DivinityCoin's publishable key)
- "Pledge $50" button

Since DivinityCoin uses Stripe under the hood, IndieK literally uses the same `@stripe/react-stripe-js` library but initialized with DivinityCoin's Stripe publishable key instead of IndieK's. The `StripePaymentForm` component can be reused as-is.

**Changes to `PaymentStep.tsx`:**
```tsx
// BEFORE (balance-based):
project?.paymentProcessor === "DIVINITYCOIN" ? (
  <DivinityCoinBalanceCard />
  <Button>Pay $50 with DivinityCoin</Button>
)

// AFTER (card form - identical to Stripe but different keys):
project?.paymentProcessor === "DIVINITYCOIN" ? (
  clientSecret && divinityCoinStripePromise ? (
    <Elements
      stripe={divinityCoinStripePromise}  // loadStripe(DIVINITYCOIN_STRIPE_PK)
      options={{ clientSecret, appearance: { theme: "stripe", variables: { colorPrimary: "#028858" } } }}
    >
      <StripePaymentForm  // Same exact component - just different Stripe account
        onSuccess={handlePaymentSuccess}
        onError={handlePaymentError}
        agreedToTerms={agreedToTerms}
        isProcessing={isProcessing}
        setIsProcessing={setIsProcessing}
        total={total}
        intentType={intentType}
        pledgeId={currentPledgeId}
        projectPath={projectPath}
      />
    </Elements>
  ) : <LoadingSpinner />
)
```

**Changes to `pledge/page.tsx`:**
```tsx
// Add separate Stripe promise for DivinityCoin's Stripe account
const [divinityCoinStripePromise, setDivinityCoinStripePromise] = useState(null);

useEffect(() => {
  if (project?.paymentProcessor === "DIVINITYCOIN") {
    fetch("/api/divinitycoin/config")
      .then(res => res.json())
      .then(data => setDivinityCoinStripePromise(loadStripe(data.stripePublishableKey)));
  }
}, [project?.paymentProcessor]);
```

### 2.2 Backend: New DivinityCoin Payment Flow

**New file: `src/lib/payments/divinitycoin-processor.ts`**

This replaces the current balance-deduction logic with API calls to DivinityCoin:

```typescript
export async function createDivinityCoinPayment({
  projectId, rewardId, addons, amount, userId, shippingAmount
}) {
  const config = await getDivinityCoinConfig();
  const project = await db.project.findUnique({ where: { id: projectId } });
  const user = await db.user.findUnique({ where: { id: userId } });
  const isCampaignFunded = Number(project.currentAmount) >= Number(project.goalAmount);

  // 1. Create pledge locally
  const pledge = await db.pledge.create({
    data: {
      userId, projectId, rewardId, amount,
      status: "PENDING",
      paymentProcessor: "DIVINITYCOIN",
    },
  });

  // 2. Ensure customer exists on DivinityCoin
  let dcCustomerId = user.divinityCoinCustomerId;
  if (!dcCustomerId) {
    const res = await fetch(`${config.baseUrl}/api/v1/customers`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, name: user.name, partner_id: config.partnerId }),
    });
    const customer = await res.json();
    dcCustomerId = customer.id;
    await db.user.update({ where: { id: userId }, data: { divinityCoinCustomerId: dcCustomerId } });
  }

  if (isCampaignFunded) {
    // 3a. Campaign funded → create PaymentIntent (charge immediately)
    const res = await fetch(`${config.baseUrl}/api/v1/payment-intents`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency: "usd",
        customer_id: dcCustomerId,
        partner_id: config.partnerId,
        metadata: { pledgeId: pledge.id, projectId, userId },
      }),
    });
    const intent = await res.json();

    await db.pledge.update({
      where: { id: pledge.id },
      data: { divinityCoinPaymentId: intent.id },
    });

    return {
      type: "payment_intent" as const,
      clientSecret: intent.client_secret,
      pledgeId: pledge.id,
      chargedImmediately: true,
    };
  } else {
    // 3b. Campaign not funded → create SetupIntent (save card for later)
    const res = await fetch(`${config.baseUrl}/api/v1/setup-intents`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: dcCustomerId,
        partner_id: config.partnerId,
        metadata: { pledgeId: pledge.id, projectId, userId, amount: Math.round(amount * 100) },
      }),
    });
    const intent = await res.json();

    await db.pledge.update({
      where: { id: pledge.id },
      data: { divinityCoinPaymentId: intent.id },
    });

    return {
      type: "setup_intent" as const,
      clientSecret: intent.client_secret,
      pledgeId: pledge.id,
      chargedImmediately: false,
    };
  }
}
```

### 2.3 New API Endpoint: DivinityCoin Config

**`src/app/api/divinitycoin/config/route.ts`**

Serves DivinityCoin's Stripe publishable key to the frontend:

```typescript
export async function GET() {
  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: { divinityCoinStripePublishableKey: true },
  });
  return NextResponse.json({
    stripePublishableKey: settings?.divinityCoinStripePublishableKey || "",
  });
}
```

### 2.4 Updated Webhook Handler

The existing `/api/webhooks/divinitycoin/route.ts` gets new payment event handlers:

```typescript
case "payment.succeeded":
  // 1. Find pledge by metadata.pledgeId
  // 2. Mark pledge as COMPLETED
  // 3. Increment project currentAmount + backerCount
  // 4. Claim reward slot
  // 5. Send backer confirmation email
  // 6. Notify creator
  // 7. Add to creator email list
  // 8. Check if project just reached goal → notify + process pending pledges
  break;

case "payment.failed":
  // Mark pledge as FAILED, notify backer
  break;

case "setup.succeeded":
  // Card saved - update pledge with payment method ID for future charging
  break;
```

### 2.5 Charge Saved Cards When Campaign Funded

Update `processPendingPledgesForProject()` to handle DivinityCoin pledges:

```typescript
if (pledge.paymentProcessor === "DIVINITYCOIN") {
  const config = await getDivinityCoinConfig();
  const res = await fetch(
    `${config.baseUrl}/api/v1/customers/${pledge.user.divinityCoinCustomerId}/charge`,
    {
      method: "POST",
      headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: Math.round(Number(pledge.amount) * 100),
        currency: "usd",
        payment_method_id: pledge.metadata?.savedPaymentMethodId,
        metadata: { pledgeId: pledge.id, projectId: pledge.projectId },
      }),
    }
  );
  // Handle response, update pledge status
}
```

### 2.6 Database Changes

```prisma
model User {
  // Add:
  divinityCoinCustomerId    String?   // Customer ID on DivinityCoin's system
}

model PlatformSettings {
  // Add:
  divinityCoinStripePublishableKey  String?  // DivinityCoin's Stripe publishable key (safe for browser)
}
```

### 2.7 Admin Settings Update

Add to Admin > Payment Settings > DivinityCoin section:

| Setting | Type | Description |
|---------|------|-------------|
| DivinityCoin Stripe Publishable Key | SecureKeyInput | The Stripe publishable key from DC's Stripe account |

The existing API Key, Partner ID, and Webhook Secret fields remain.

---

## Part 3: What Stays / What Changes

### Stays (internal, invisible to backer):
- `DivinityCoinRedemption` model - now records auto-redemptions from the API
- `DivinityCoinTransaction` model - expanded to track card-based payments
- `DivinityCoinBankAccount` model - creator payout bank info (unchanged)
- `DivinityCoinSettlement` model - admin payout tracking (unchanged)
- Gift card codes - still generated, just auto-created and auto-redeemed
- Webhook signature verification - same HMAC-SHA256 pattern

### Changes:
- `PaymentStep.tsx` - Card form replaces balance display
- `pledge/page.tsx` - Loads DivinityCoin's Stripe publishable key
- Pledge creation API - Calls DivinityCoin API instead of checking balance
- `/api/divinitycoin/pay` - Replaced by DivinityCoin API payment intents
- Wallet/balance UI - No longer shown to backers (internal bookkeeping only)

### Optional (can keep for power users):
- Manual gift card redemption at divinitycoin.com - for users who prefer buying in bulk
- Wallet page in backer dashboard - shows transaction history if they care
- "Pay with DivinityCoin balance" option - if a user already has credits

---

## Part 4: Implementation Plan

### Phase 1: DivinityCoin API (DivinityCoin side) ~1-2 weeks

Build the thin API layer on top of existing Stripe integration:

1. **`POST /api/v1/customers`** - Create DC customer + Stripe customer
2. **`POST /api/v1/payment-intents`** - Create Stripe PaymentIntent, return client_secret
3. **`POST /api/v1/setup-intents`** - Create Stripe SetupIntent, return client_secret
4. **`GET /api/v1/payment-intents/:id`** - Check payment status
5. **`POST /api/v1/customers/:id/charge`** - Charge saved card
6. **`POST /api/v1/refunds`** - Process refund via Stripe
7. **Auto gift card flow** - On Stripe payment_intent.succeeded webhook:
   - Generate internal gift card for exact amount
   - Auto-redeem to customer account
   - Create audit trail
   - Send webhook to IndieK
8. **Webhook delivery** - Send signed webhooks to partner webhook URL
9. **Generate API keys** - Secret key + expose Stripe publishable key

### Phase 2: IndieK Integration (IndieK side) ~1 week

1. Add `divinityCoinStripePublishableKey` + `divinityCoinCustomerId` to schema
2. Create `/api/divinitycoin/config` endpoint
3. Create `divinitycoin-processor.ts` (payment intent creation via DC API)
4. Update pledge creation to call DivinityCoin API for DC projects
5. Update `PaymentStep.tsx` to render card form for DivinityCoin projects
6. Update `pledge/page.tsx` to load DivinityCoin's Stripe publishable key
7. Update webhook handler for new payment events
8. Update `processPendingPledgesForProject` for DC saved cards
9. Update admin settings for new config fields
10. End-to-end testing

### Phase 3: Polish ~3-5 days

1. Apple Pay / Google Pay (free with Stripe Elements)
2. Saved card display for returning backers
3. Settlement/payout API integration
4. Dispute handling

---

## Part 5: The Compliance Story

If anyone ever asks "how does payment work for NSFW content?":

1. Backers purchase DivinityCoin digital gift cards (processed via Stripe)
2. Gift cards are redeemed on partner platforms (IndieK)
3. Stripe's relationship is with DivinityCoin (digital goods seller), not with the NSFW content
4. Complete audit trail exists: card purchase → gift card creation → redemption → platform usage
5. DivinityCoin is the merchant of record for card transactions

The automation just removes the manual steps. Instead of the backer manually buying a gift card and manually redeeming it, the system does it instantly and invisibly. The legal structure is identical.

---

## Summary: What DivinityCoin Needs to Provide IndieK

Once the API is built, IndieK just needs these credentials:

| What | Example | Where It's Used |
|------|---------|-----------------|
| API Secret Key | `dsk_live_abc123` | IndieK backend → DivinityCoin API calls |
| Stripe Publishable Key | `pk_live_dc_xyz789` | IndieK frontend → Stripe Elements |
| Webhook Secret | `whsec_def456` | Verify webhooks from DivinityCoin |
| Partner ID | `partner_indiecrowdfund` | Identify IndieK in API calls |
| API Base URL | `https://api.divinitycoin.com` | Where to send API requests |
