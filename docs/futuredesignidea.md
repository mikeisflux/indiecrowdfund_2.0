# Future design idea — add-ons become shipping groups

**Status: shelved.** Fully specified, nothing built. Pick this up by re-reading
section 3 (the compatibility seam) first — it is the decision the rest depends on.

Retire add-ons as a product type on new campaigns. Backers pick any number of
rewards in any quantity; the builder section that used to sell add-ons becomes
the place where the creator defines how those rewards ship together. Old and
live campaigns keep today's behaviour permanently.

Scope when shelved: ~160 files across IndieKit, the pledge/payment paths, admin,
the builder, and the footer handbooks.

---

## 1. Decisions already made

These were settled in a Q&A and should not be relitigated without a reason.

| # | Question | Decision |
|---|----------|----------|
| 1 | What does a group rule compute? | Creator picks per group: flat, first + additional, tiered by count, or highest-wins |
| 2 | Two groups in one cart? | Charges add together. No cross-group combine rule |
| 3 | Reward in multiple groups? | No — exactly one group per reward |
| 4 | Per-country rates? | Yes. `Reward.shippingType` / `shippingCountries` still gate eligibility and visibility; groups only price |
| 5 | Same reward more than once? | Yes, subject to limits. This is what replaces add-ons |
| 6 | Keep the ADDON type on new campaigns? | No. Deprecated. No importing from pre-cutover campaigns |
| 7 | What does the IndieKit survey offer? | Rewards, with quantities, priced by the same group rules |
| 8 | Digital / no-shipping rewards? | Auto-assigned to a visible system group, "No shipping needed" |

Two decisions were left open, both recommended for inclusion:

- **Order-level shipping cap per country** ("never more than $20 to the US").
  Groups add together, so comics ($8) + prints ($12) + apparel ($15) reaches $35
  at checkout — each number fair, the total a conversion killer.
- **Per-backer quantity cap per reward** ("max 2 of this variant").

Neither exists today. Verified at shelving time: `Reward.quantityAvailable` and
the `AddonSelector` max are both *total remaining stock*, so one backer can clear
a limited run in a single order. `sharedStockWithId` pools stock but is still a
total. `retailerMin/MaxQuantity` is the unrelated wholesale feature. There is no
shipping cap field anywhere in the schema.

---

## 2. The shape of the change

**Today.** A pledge is exactly one tier plus N add-ons. `Pledge.rewardId` is a
single FK; add-ons hang off `PledgeAddon`. Shipping is per-line and additive:
`rewardShipping + Σ(addonShipping × qty)`. A backer taking a tier and three
add-ons pays four stacked shipping charges even when it all goes in one box.
That is the problem being solved.

**New campaigns.** A pledge is N rewards with quantities. Shipping is computed by
partitioning the cart into groups and applying each group's rule. Add-ons are not
removed as a capability — a reward you can take three of *is* an add-on. One
concept replaces two.

### Two independent version axes

`layoutVersion` (presentation) was already backfilled to `2` on every campaign
that had not gone live. Commerce gets its own flag, `pledgeModel`, set at project
creation and never backfilled.

Existing drafts therefore run **new layout + old add-ons**, which is a real
combination the campaign page must render. Sharing one version number between
presentation and money would have silently changed checkout for those drafts.

---

## 3. The compatibility seam

This is the single decision that keeps the job from becoming a rewrite. Roughly
53 files read `Pledge.rewardId` directly and assume one reward. Rather than
branching on `pledgeModel` in each of them, both shapes normalize once:

```
Legacy pledge                                    New pledge
  Pledge.rewardId  (one tier)                      PledgeItem[]  (every line, with qty)
  PledgeAddon[]    (extras with qty)               Pledge.rewardId stays null
         \                                                /
          \                                              /
                      getPledgeLines(pledge)
                     one normalized line list
                                |
   IndieKit · admin · fulfillment · exports · Shopify push · digital delivery
        all read the normalized list, never learn which model it came from
```

The same principle applies to money. `calculateShipping(project, lines, country)`
is one server-side function with a legacy branch and a group branch. Old
campaigns keep producing the exact numbers they produce today because that branch
*is* today's code moved behind the interface — correct by construction rather
than by care.

No migration backfills `PledgeItem` from historical pledges. Every legacy row
stays exactly as written. The normalizer reads them; nothing rewrites them.

---

## 4. Schema

### New: `ShippingGroup`

Belongs to a project. Carries a rule type and a per-country rate table whose
shape depends on the type.

| Rule type | Rate config, per country | Notes |
|-----------|--------------------------|-------|
| `PER_ITEM` | — uses each reward's own rate | Exactly today's behaviour. The default group's rule, so an untouched campaign charges what it does now |
| `FLAT` | `{ "US": 12, "WW": 25 }` | One charge for the group however many items |
| `FIRST_PLUS_ADDITIONAL` | `{ "US": { first: 8, add: 3 } }` | Needs quantities to be meaningful |
| `TIERED_BY_COUNT` | `{ "US": [{upTo:3,rate:10}, …] }` | Final band has `upTo: null` |
| `HIGHEST_WINS` | — uses each reward's own rate | Charges the dearest single item once. Also how a creator expresses "one charge for everything": put it all in one group |
| `NONE` | — always 0 | The "No shipping needed" system group |

`HIGHEST_WINS` and `PER_ITEM` both read the individual rewards' rates, so
per-reward shipping does **not** go away — groups sit *on top* of it. That is
what lets the legacy model be expressed as "everything in one `PER_ITEM` group"
and share a single calculator.

### Changed and added

- `Project.pledgeModel Int @default(1)` — new projects created with `2`
- `Project.shippingCapByCountry Json?` — optional order-level cap (open decision)
- `Reward.shippingGroupId String?` — null means the default group
- `Reward.maxPerBacker Int?` — optional per-person cap (open decision)
- `PledgeItem` — `pledgeId, rewardId, quantity, unitAmount, shippingAmount`.
  Same shape as `PledgeAddon`, honest name, no `addon` in it
- `Reward.type` stays. It is how legacy campaigns keep working; the builder just
  stops offering `ADDON` on new ones

### Validation the eligibility/pricing split gives us

A reward can ship somewhere its group has no rate for. Today `getShippingCost`
silently returns **$0** in that case, so a creator who ships "Cover A" to Canada
but forgets Canada in the Comics group's table eats the freight and never finds
out. The builder should validate the union of every reward's countries against
its group's rate table and flag the holes before launch.

---

## 5. Phases

Ordered so each phase is independently shippable and the flag that changes
behaviour flips **last**, after every surface can already handle both models.

### Phase 0 — Make shipping server-authoritative

Today `usePledge` computes shipping in the browser and POSTs `shippingAmount`;
`/api/pledges` reads `data.shippingAmount || 0` and charges it. A crafted request
can set shipping to zero. Move the calculation server-side for the *existing*
model: client quotes for display, server recomputes before charging.

A prerequisite, not a detour — decision 7 requires one calculator producing the
same number at checkout and at survey-balance time. Also closes a live hole.

*Ships alone · touches money · no behaviour change*

### Phase 1 — Schema + the normalizer, with nothing switched on

Add every table and column above. Write `getPledgeLines()` and migrate all ~53
direct `rewardId` readers onto it. With `pledgeModel = 1` everywhere this is a
behavioural no-op — which is what makes the largest refactor in the project
safely testable.

*Ships alone · largest diff · no behaviour change*

### Phase 2 — The shipping engine

Implement the six rule types, the group partition, the optional cap, and the
itemized breakdown. Pure functions with unit tests, no UI consuming it yet. The
piece worth testing hardest, because it is the piece that charges people.

*Ships alone · touches money · heavily unit-tested*

### Phase 3 — Builder: Add-ons tab becomes Shipping

On `pledgeModel 2`: one unified Rewards list with quantity limits, no ADDON
creation, and the old tab reborn as group management — create groups, pick a
rule, fill the country table, assign rewards. Import dialogs filter to
same-model source campaigns only. Includes the country-hole validation above.

*Ships alone · creator-facing*

### Phase 4 — Campaign page + checkout

Multi-select cart with quantities, per-reward stock and per-backer caps enforced,
itemized shipping breakdown ("Comics $14 · Prints $12") instead of one opaque
number. Legacy campaigns keep the tier + add-on selectors untouched. All four
processors write `PledgeItem` rows.

*Touches money · 4 processors · backer-facing*

### Phase 5 — IndieKit

~55 files. Surveys offer rewards with quantities and price them through the same
engine; add-on tabs, SKU mapping, modifier combinations, distribution rules,
segments, counts, exports, Shopify push and digital delivery all move onto
normalized lines. Balance charges reuse the Phase 2 calculator.

*Touches money · largest surface*

### Phase 6 — Admin

9 surfaces: transaction detail, pledge editing, recalculate-amounts,
process-pledges, DC migration, duplicate-reward cleanup. Mostly display changes
once they read normalized lines — but `recalculate-pledge-amounts` genuinely
recomputes money and needs the new engine.

*Touches money*

### Phase 7 — Documentation

Footer handbooks, with add-on mention counts at shelving time:
`indiekit-handbook` (28), `backer-handbook` (10), `creator-handbook` (8),
`faq` (4). Each needs the new model documented *and* the old one preserved for
creators still running it — these pages serve both populations simultaneously
for years. `/help` and `/fees` reviewed; neither mentions add-ons today.

*Ships alone*

### Phase 8 — Cutover

Flip the default so newly created projects get `pledgeModel = 2`. One line, after
everything above is live and proven. Trivially reversible: flip it back and new
projects return to the old model with no data to unwind.

*One line · reversible*

---

## 6. Risks

**No database in the dev environment.** There is no local database and no
`DATABASE_URL`, so none of this can be exercised against real data from a Claude
session. For a change that recomputes what backers are charged, this is the most
serious constraint. Recommended: a staging database with a production snapshot
before Phase 4. Failing that, Phases 0 and 2 ship in shadow mode — compute the
new number, log it beside the old one, charge the old one — until the logs show
them agreeing.

**Server recompute could reject valid pledges.** Phase 0 makes the server
authoritative. If client and server ever disagree, a legitimate backer is blocked
at checkout. Mitigation: log mismatches without enforcing for a set period, then
enforce once the log is quiet.

**Stock accounting changes shape.** Quantities mean stock decrements by N, not 1.
Claims are already centralized in `lib/payments/rewards.ts` with row locking for
shared pools, so this is a parameter change rather than new concurrency — but it
is the code path where an error oversells a limited variant.

**Old pledges must never move.** See section 3. No backfill, ever.

---

## 7. Surface inventory

| Surface | Files | Nature of change |
|---------|-------|------------------|
| IndieKit (dashboard + API) | ~55 | Surveys, add-on tabs, SKU mapping, distribution, exports, Shopify |
| Pledge & payment paths | ~44 | 4 processors, add-items, modify, confirm, webhooks |
| Files reading `rewardId` | 53 | Migrate to the normalizer |
| Shipping consumers | 36 | Route through the shared calculator |
| Admin | 9 | Display, plus recalculate-amounts |
| Builder (rewards step) | ~12 | Unified list, group editor, import filtering |
| Docs & handbooks | 4 | Both models documented side by side |

Counts overlap — a pledge route reading `rewardId` appears in two rows. Treat
them as a map of where the work lands, not a sum.

---

## 8. If picking this back up

1. Re-verify the counts in section 7; the codebase will have moved.
2. Confirm the two open decisions in section 1 are still wanted.
3. Start with Phase 0. It is useful on its own even if the rest is never built —
   it closes the client-controlled shipping amount.
4. Do not start at Phase 3 or 4. They are the visible half, but without the seam
   from Phase 1 they turn into per-file `pledgeModel` branching, which is the
   outcome this design exists to avoid.
