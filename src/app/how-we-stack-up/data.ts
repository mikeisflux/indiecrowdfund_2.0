// Feature-comparison data for the "How We Stack Up" page.
//
// "yes"     = fully included
// "partial" = limited, or typically requires a separate paid add-on / partner
// "no"      = not offered
// "unknown" = not yet known (e.g. a platform that hasn't launched) — shown as "?"
//
// Competitor columns (Kickstarter, Indiegogo, Fund My Comic, Backmebro) reflect
// publicly available information and may change; the page carries a note to
// that effect. Backmebro has now launched; its marks are what's verifiable from
// its live public site — features we can't confirm are left "unknown" rather
// than assumed absent. IndieCrowdfund marks are drawn from the platform's own
// feature set.
export type Support = "yes" | "partial" | "no" | "unknown";

export interface FeatureRow {
  label: string;
  ic: Support; // IndieCrowdfund
  ks: Support; // Kickstarter
  ig: Support; // Indiegogo
  fmc: Support; // Fund My Comic
  bmb: Support; // Backmebro
}

export interface FeatureGroup {
  title: string;
  rows: FeatureRow[];
}

// Underlying platform / frontend stack. Facts only, stated neutrally.
//   - IndieCrowdfund: verified from this codebase (Next.js / React).
//   - Fund My Comic: verified from its page source — a white-labeled
//     Thrinacia instance with an AngularJS (Angular 1.x, end-of-lifed
//     Jan 2022) frontend. (The "Wp*" controllers in its source are
//     Thrinacia's WordPress-blog integration module, not the platform.)
//   - Backmebro: verified from its live site source — Next.js (App Router,
//     Turbopack) / React / Tailwind, a multi-tenant white-label platform.
//   - Kickstarter: Ruby on Rails (long publicly documented).
//   - Indiegogo: historically Ruby on Rails + AngularJS (StackShare, public
//     GitHub); rebuilt on Gamefound's (.NET) infrastructure after the 2025
//     acquisition, per Indiegogo's own launch announcement.
export const PLATFORM: Record<"ic" | "ks" | "ig" | "fmc" | "bmb", string> = {
  ic: "Next.js / React",
  ks: "Ruby on Rails",
  ig: "Gamefound platform (.NET)",
  fmc: "Thrinacia · AngularJS",
  bmb: "Next.js (Turbopack) / React",
};

export const GROUPS: FeatureGroup[] = [
  {
    title: "Crowdfunding",
    rows: [
      { label: "Rewards-based crowdfunding campaigns", ic: "yes", ks: "yes", ig: "yes", fmc: "yes", bmb: "yes" },
      // BMB "yes": a live campaign runs "flexible" funding and charges
      // immediately at checkout ("charged immediately upon checkout as this
      // campaign has a flexible goal").
      { label: "Flexible “keep-it-all” funding option", ic: "yes", ks: "no", ig: "yes", fmc: "yes", bmb: "yes" },
      // FMC "no": Fund My Comic's public campaign pages roll externally-raised
      // funds into the headline total — e.g. campaign 118 displays "$81,850
      // raised / 16,370% funded" with the sub-line "$77,743 raised on other
      // sites by 1,574 backers" (only ~$4.1k of it raised on FMC itself).
      // Kickstarter/Indiegogo display on-platform pledges only.
      // BMB "yes": its campaign header shows only on-platform pledges
      // ("$0 pledged of $500 goal, 3 backers") — no externally-raised inflation.
      { label: "Public funding total reflects on-platform pledges only", ic: "yes", ks: "yes", ig: "yes", fmc: "no", bmb: "yes" },
      { label: "Prelaunch / coming-soon pages", ic: "yes", ks: "yes", ig: "yes", fmc: "yes", bmb: "unknown" },
      // BMB "yes": reward tiers list "1 item included + optional add-ons".
      { label: "Native à-la-carte add-ons", ic: "yes", ks: "yes", ig: "yes", fmc: "yes", bmb: "yes" },
      // KS: Kickstarter orders rewards by pledge amount with no manual reorder.
      // IG: Indiegogo's help center documents drag handles to reorder perks.
      // FMC: not verified (Thrinacia docs don't mention it; site not reachable).
      { label: "Drag-to-reorder reward tiers & add-ons", ic: "yes", ks: "no", ig: "yes", fmc: "no", bmb: "yes" },
      // Secret/hidden reward gated by a private link/code. KS + IG both offer
      // "secret" rewards; FMC not verified. BMB "yes": every reward object in
      // its page data carries an `is_secret` flag.
      { label: "Secret rewards (private link/code)", ic: "yes", ks: "yes", ig: "yes", fmc: "no", bmb: "yes" },
      { label: "Late pledges after the campaign ends", ic: "yes", ks: "yes", ig: "yes", fmc: "partial", bmb: "unknown" },
      { label: "Backer reviews & star ratings", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
      { label: "Team collaborators on a campaign", ic: "yes", ks: "yes", ig: "yes", fmc: "no", bmb: "no" },
      { label: "Built-in referral tracking", ic: "yes", ks: "partial", ig: "partial", fmc: "partial", bmb: "no" },
    ],
  },
  {
    title: "Payments",
    rows: [
      // BMB "no" across payments: its own ToS (§8.D, §9) names Stripe as its
      // sole payment processor — "Back Me Bro currently uses Stripe as our
      // Payment Processor" / "all payments … are processed through Stripe
      // Connect" — with no PayPal or crypto option (checkout confirmed Stripe).
      { label: "Multiple payment processors", ic: "yes", ks: "no", ig: "yes", fmc: "partial", bmb: "no" },
      { label: "PayPal accepted", ic: "yes", ks: "no", ig: "yes", fmc: "yes", bmb: "no" },
      { label: "Crypto / token payments (via Whop)", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
    ],
  },
  {
    title: "Fulfillment (IndieKit)",
    rows: [
      { label: "Built-in pledge manager & backer surveys", ic: "yes", ks: "yes", ig: "yes", fmc: "partial", bmb: "no" },
      { label: "Order Lock — confirm & charge early", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
      { label: "Shipping-carrier integrations (Shippo, ShipStation, EasyPost, Stamps)", ic: "yes", ks: "partial", ig: "partial", fmc: "no", bmb: "no" },
      { label: "Shopify integration", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
      { label: "Built-in comic printing & hard-copy proofs", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
      { label: "Production / already-shipped tracking", ic: "yes", ks: "partial", ig: "partial", fmc: "no", bmb: "no" },
      { label: "Digital file delivery & downloads", ic: "yes", ks: "yes", ig: "partial", fmc: "partial", bmb: "no" },
    ],
  },
  {
    title: "Ongoing store",
    rows: [
      // BMB "yes": its ToS (§9.C) describes a Creator Storefront that sells
      // "physical or digital products … outside of (or in addition to) a
      // crowdfunding Project."
      { label: "Digital storefront (sell after the campaign)", ic: "yes", ks: "partial", ig: "yes", fmc: "yes", bmb: "yes" },
      { label: "Music streaming store", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
      { label: "Movie / video streaming store", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
      // FMC "partial": each creator's campaign can keep selling its own physical
      // items after the campaign via Direct Purchase, but there's no dedicated
      // global physical-media store. BMB "yes": a top-level "Shop" storefront
      // plus a site-wide cart.
      { label: "Physical-media store", ic: "yes", ks: "no", ig: "no", fmc: "partial", bmb: "yes" },
      { label: "Discount & redeem codes", ic: "yes", ks: "partial", ig: "partial", fmc: "partial", bmb: "no" },
    ],
  },
  {
    title: "Growth & community",
    rows: [
      { label: "AI-powered marketing campaigns", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      { label: "Creator email inbox & marketing", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
      { label: "Community chat", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
      { label: "Wholesale / retailer program", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
      { label: "Backer digital library", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
      // BMB "no": its ToS gates content behind a Prohibited Content policy.
      { label: "Mature / adult content allowed", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "no" },
    ],
  },
  {
    title: "Platform & technology",
    rows: [
      // FMC "no": its frontend is AngularJS (Angular 1.x), which reached
      // Google end-of-life in January 2022 (no further releases or security
      // patches) — confirmed from its page source.
      // BMB "yes": Next.js (App Router, Turbopack) + React, confirmed from source.
      { label: "Runs on a modern, actively-supported framework", ic: "yes", ks: "yes", ig: "yes", fmc: "no", bmb: "yes" },
    ],
  },
];
