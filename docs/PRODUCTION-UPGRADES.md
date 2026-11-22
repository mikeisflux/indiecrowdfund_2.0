# Upgrade add-ons, production counts and survey reminders

How IndieKit turns "Upgrade to foil" into a production SKU, and how surveys
get chased without anyone remembering to press a button. Platform-wide: every
campaign and creator gets this; nothing is tied to a particular campaign.

## The problem it replaces

An upgrade add-on ("Upgrade to foil", "Upgrade to metal", "Hand-painted
statue") changes something the backer already holds instead of being a
product of its own. The old survey asked "which cover do you want upgraded?"
as free text. Production could not read "Sw3 12, 18 & 24" or "05", the
upgrade never reached the SKU, and the counts showed one base cover plus one
upgrade instead of one upgraded cover. Late and missing surveys then moved
the numbers again after the print run was sized.

## How it works now

1. **Mark the add-on as an upgrade** — IndieKit → Pre-Fulfillment →
   **Production** → *Upgrade add-ons*. Switch it on, give it a SKU suffix
   (`-F`), and optionally tick which items it may apply to. Nothing ticked
   means any physical item in the order (the tier and every shipped add-on;
   digital items are never eligible).
2. **Give items SKUs** — same tab, *Item SKUs*. "Fill blanks from item names"
   reads codes out of titles (`SW3-18 (Add-on)` → `SW3-18`). A SKU mapped in
   Setup → SKU Mapping always wins over this field.
3. **The survey asks the structured question** — the backer gets an
   "Apply Your Upgrades" step: one dropdown per copy of the upgrade, listing
   only their own eligible items, with quantities enforced (one SW3-18 can't
   be upgraded twice). When there is only one way to apply it (one cover +
   one upgrade; four add-on covers + four foil upgrades) it is assigned
   automatically and shown as a confirmation. Each pick is a
   `PledgeModifierAssignment` row (`pledgeId, modifierAddonId, unitIndex →
   rewardId`, `source = AUTO | SURVEY | CREATOR`).
4. **Production counts** — Production tab, per SKU: confirmed (survey done
   or order locked) vs pending, with upgraded copies on their own line
   (`SW3-18-F`) and still-unassigned copies called out. CSV export. Sizes and
   other survey choices are counted below it.
5. **Resolving the rest** — backers whose upgrade has no item yet are listed
   on the Production tab with whatever they wrote in the old free-text
   question and a suggested match parsed from it. Confirm and save, or open
   "Fill survey" to enter the whole survey for them. The same picker is in
   the backer dialog's Overview.
6. **Shopify push** uses the same resolver, so a draft order carries
   `SW3-18-F` for an assigned upgrade and `SW3-18` for an unupgraded copy.
   Unassigned upgrades go on the order as a custom line so nothing is lost.
7. **Automatic reminders** — Surveys → Sent Surveys → *Automatic reminders*.
   Backers with an unfinished survey are emailed every N days (default 7),
   up to a cap (default 4), with exactly what is still missing (an upgrade
   that needs an item, a shipping address). Set a due date and they get one
   final overdue notice when it passes. Honors the backer's "Survey
   reminders" preference and the per-project survey mute. Counters reset
   when a survey is sent or an update is requested.

SKU resolution order (shared by counts and push, `src/lib/fulfillment/production-counts.ts`):

| Item | SKU |
| --- | --- |
| Base item | `ShopifySkuMapping` row for the reward, else `Reward.sku` |
| Upgraded item | `ModifierSkuMapping` row for the exact combination, else base SKU + `Reward.modifierSkuSuffix` |

## Server setup

Daily reminder run (add to root's crontab on the app server):

```
30 15 * * * . /root/indiecrowdfund_2.0/.env && curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/survey-reminders > /dev/null 2>&1
```

The migration `prisma/migrations/add_modifier_units_and_survey_reminders.sql`
is applied by `build-and-swap.sh`. It is additive: new columns, and the
assignment unique key becomes `(pledgeId, modifierAddonId, unitIndex)`.

## Converting a campaign that already ran (e.g. one with free-text upgrade questions)

All in the UI, no SQL:

1. Production → *Upgrade add-ons*: switch on each "Upgrade to …" add-on,
   set its suffix, save. Backers with only one possible target are assigned
   on the spot.
2. Production → *Item SKUs* → "Fill blanks from item names".
3. Production → *Upgrades that need an item*: the remaining backers appear
   with their old answer and a suggestion. Confirm each.
4. Surveys → Sent Surveys → *Automatic reminders*: set a due date.

The counts table and CSV are then production-ready, and the Shopify push
will carry the upgraded SKUs.
