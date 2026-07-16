// Feature-comparison data for the "How We Stack Up" page.
//
// "yes"     = fully included
// "partial" = limited, or typically requires a separate paid add-on / partner
// "no"      = not offered
// "unknown" = not yet known (e.g. a platform that hasn't launched) — shown as "?"
//
// Competitor columns (Kickstarter, Indiegogo, Fund My Comic, Backmebro) reflect
// publicly available information and may change; the page carries a note to
// that effect. Backmebro has not launched yet, so every cell is "unknown".
// IndieCrowdfund marks are drawn from the platform's own feature set.
export type Support = "yes" | "partial" | "no" | "unknown";

export interface FeatureRow {
  label: string;
  ic: Support; // IndieCrowdfund
  ks: Support; // Kickstarter
  ig: Support; // Indiegogo
  fmc: Support; // Fund My Comic
  bmb: Support; // Backmebro (not launched yet)
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
//   - Backmebro: Node.js, per the vendor (pre-launch).
//   - Kickstarter: Ruby on Rails (long publicly documented).
//   - Indiegogo: not publicly disclosed post-2025 Gamefound migration.
export const PLATFORM: Record<"ic" | "ks" | "ig" | "fmc" | "bmb", string> = {
  ic: "Next.js / React",
  ks: "Ruby on Rails",
  ig: "Not publicly disclosed",
  fmc: "Thrinacia · AngularJS",
  bmb: "Node.js (pre-launch)",
};

export const GROUPS: FeatureGroup[] = [
  {
    title: "Crowdfunding",
    rows: [
      { label: "Rewards-based crowdfunding campaigns", ic: "yes", ks: "yes", ig: "yes", fmc: "yes", bmb: "unknown" },
      { label: "Flexible “keep-it-all” funding option", ic: "yes", ks: "no", ig: "yes", fmc: "yes", bmb: "unknown" },
      // FMC "no": Fund My Comic's public campaign pages roll externally-raised
      // funds into the headline total — e.g. campaign 118 displays "$81,850
      // raised / 16,370% funded" with the sub-line "$77,743 raised on other
      // sites by 1,574 backers" (only ~$4.1k of it raised on FMC itself).
      // Kickstarter/Indiegogo display on-platform pledges only.
      { label: "Public funding total reflects on-platform pledges only", ic: "yes", ks: "yes", ig: "yes", fmc: "no", bmb: "unknown" },
      { label: "Prelaunch / coming-soon pages", ic: "yes", ks: "yes", ig: "yes", fmc: "yes", bmb: "unknown" },
      { label: "Native à-la-carte add-ons", ic: "yes", ks: "yes", ig: "yes", fmc: "yes", bmb: "unknown" },
      { label: "Late pledges after the campaign ends", ic: "yes", ks: "yes", ig: "yes", fmc: "partial", bmb: "unknown" },
      { label: "Backer reviews & star ratings", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      { label: "Team collaborators on a campaign", ic: "yes", ks: "yes", ig: "yes", fmc: "no", bmb: "unknown" },
      { label: "Built-in referral tracking", ic: "yes", ks: "partial", ig: "partial", fmc: "partial", bmb: "unknown" },
    ],
  },
  {
    title: "Payments",
    rows: [
      { label: "Multiple payment processors", ic: "yes", ks: "no", ig: "yes", fmc: "partial", bmb: "unknown" },
      { label: "PayPal accepted", ic: "yes", ks: "no", ig: "yes", fmc: "yes", bmb: "unknown" },
      { label: "Crypto / token payments (via Whop)", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
    ],
  },
  {
    title: "Fulfillment (IndieKit)",
    rows: [
      { label: "Built-in pledge manager & backer surveys", ic: "yes", ks: "yes", ig: "yes", fmc: "partial", bmb: "unknown" },
      { label: "Order Lock — confirm & charge early", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      { label: "Shipping-carrier integrations (Shippo, ShipStation, EasyPost, Stamps)", ic: "yes", ks: "partial", ig: "partial", fmc: "no", bmb: "unknown" },
      { label: "Shopify integration", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      { label: "Built-in comic printing & hard-copy proofs", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      { label: "Production / already-shipped tracking", ic: "yes", ks: "partial", ig: "partial", fmc: "no", bmb: "unknown" },
      { label: "Digital file delivery & downloads", ic: "yes", ks: "yes", ig: "partial", fmc: "partial", bmb: "unknown" },
    ],
  },
  {
    title: "Ongoing store",
    rows: [
      { label: "Digital storefront (sell after the campaign)", ic: "yes", ks: "partial", ig: "yes", fmc: "yes", bmb: "unknown" },
      { label: "Music streaming store", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      { label: "Movie / video streaming store", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      // FMC "partial": each creator's campaign can keep selling its own physical
      // items after the campaign via Direct Purchase, but there's no dedicated
      // global physical-media store.
      { label: "Physical-media store", ic: "yes", ks: "no", ig: "no", fmc: "partial", bmb: "unknown" },
      { label: "Discount & redeem codes", ic: "yes", ks: "partial", ig: "partial", fmc: "partial", bmb: "unknown" },
    ],
  },
  {
    title: "Growth & community",
    rows: [
      { label: "AI-powered marketing campaigns", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      { label: "Creator email inbox & marketing", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      { label: "Community chat", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      { label: "Wholesale / retailer program", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      { label: "Backer digital library", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
      { label: "Mature / adult content allowed", ic: "yes", ks: "no", ig: "no", fmc: "no", bmb: "unknown" },
    ],
  },
  {
    title: "Platform & technology",
    rows: [
      // FMC "no": its frontend is AngularJS (Angular 1.x), which reached
      // Google end-of-life in January 2022 (no further releases or security
      // patches) — confirmed from its page source.
      { label: "Runs on a modern, actively-supported framework", ic: "yes", ks: "yes", ig: "yes", fmc: "no", bmb: "unknown" },
    ],
  },
];
