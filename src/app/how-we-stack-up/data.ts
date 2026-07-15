// Feature-comparison data for the "How We Stack Up" page.
//
// "yes"     = fully included
// "partial" = limited, or typically requires a separate paid add-on / partner
// "no"      = not offered
//
// Competitor columns (Kickstarter, Indiegogo, Fund My Comic) reflect publicly
// available information and may not capture recent changes — the page carries
// a note to that effect. IndieCrowdfund marks are drawn from the platform's
// own feature set.
export type Support = "yes" | "partial" | "no";

export interface FeatureRow {
  label: string;
  ic: Support; // IndieCrowdfund
  ks: Support; // Kickstarter
  ig: Support; // Indiegogo
  fmc: Support; // Fund My Comic
}

export interface FeatureGroup {
  title: string;
  rows: FeatureRow[];
}

export const GROUPS: FeatureGroup[] = [
  {
    title: "Crowdfunding",
    rows: [
      { label: "Rewards-based crowdfunding campaigns", ic: "yes", ks: "yes", ig: "yes", fmc: "yes" },
      { label: "Flexible “keep-it-all” funding option", ic: "yes", ks: "no", ig: "yes", fmc: "yes" },
      { label: "Prelaunch / coming-soon pages", ic: "yes", ks: "yes", ig: "yes", fmc: "yes" },
      { label: "Native à-la-carte add-ons", ic: "yes", ks: "yes", ig: "yes", fmc: "yes" },
      { label: "Late pledges after the campaign ends", ic: "yes", ks: "yes", ig: "yes", fmc: "partial" },
      { label: "Backer reviews & star ratings", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Team collaborators on a campaign", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Built-in referral tracking", ic: "yes", ks: "partial", ig: "partial", fmc: "partial" },
    ],
  },
  {
    title: "Payments",
    rows: [
      { label: "Multiple payment processors", ic: "yes", ks: "no", ig: "yes", fmc: "partial" },
      { label: "PayPal accepted", ic: "yes", ks: "no", ig: "yes", fmc: "yes" },
      { label: "Crypto / token payments (DivinityCoin)", ic: "yes", ks: "no", ig: "no", fmc: "no" },
    ],
  },
  {
    title: "Fulfillment (IndieKit)",
    rows: [
      { label: "Built-in pledge manager & backer surveys", ic: "yes", ks: "yes", ig: "yes", fmc: "partial" },
      { label: "Order Lock — confirm & charge early", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Shipping-carrier integrations (Shippo, ShipStation, EasyPost, Stamps)", ic: "yes", ks: "partial", ig: "partial", fmc: "no" },
      { label: "Shopify integration", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Built-in comic printing & hard-copy proofs", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Production / already-shipped tracking", ic: "yes", ks: "partial", ig: "partial", fmc: "no" },
      { label: "Digital file delivery & downloads", ic: "yes", ks: "yes", ig: "partial", fmc: "partial" },
    ],
  },
  {
    title: "Ongoing store",
    rows: [
      { label: "Digital storefront (sell after the campaign)", ic: "yes", ks: "partial", ig: "yes", fmc: "no" },
      { label: "Music streaming store", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Movie / video streaming store", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Physical-media store", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Discount & redeem codes", ic: "yes", ks: "partial", ig: "partial", fmc: "partial" },
    ],
  },
  {
    title: "Growth & community",
    rows: [
      { label: "AI-powered marketing campaigns", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Creator email inbox & marketing", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Community chat", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Wholesale / retailer program", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Backer digital library", ic: "yes", ks: "no", ig: "no", fmc: "no" },
      { label: "Mature / adult content allowed", ic: "yes", ks: "no", ig: "no", fmc: "yes" },
    ],
  },
];
