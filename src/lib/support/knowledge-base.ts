// IndieCrowdfund support chatbot knowledge base.
//
// This file is the source of truth the support agent (Claude) consults
// before answering a backer / creator question. Keep entries short and
// scannable — Claude reads the whole thing as system context on every
// turn, so brevity matters.
//
// Each entry has:
//   - title: human-friendly heading the AI may cite back to the user
//   - tags:  free-form keywords the AI can use to score relevance
//   - content: 1-3 short paragraphs of plain text. NO markdown headings.
//   - link: optional public URL the AI can suggest the user visit for more
//
// When you change platform behavior (fees, payment processors, survey
// flow, etc.), update this file or the answers will drift.

export interface KbEntry {
  id: string;
  title: string;
  tags: string[];
  content: string;
  link?: string;
}

export const KNOWLEDGE_BASE: KbEntry[] = [
  // ============== Pledging & payment timing ==============
  {
    id: "all-or-nothing-vs-keep-it-all",
    title: "All-or-Nothing vs Keep-It-All campaigns",
    tags: ["pledge", "campaign type", "AoN", "KIA", "all-or-nothing", "keep-it-all", "charge", "billing"],
    content:
      "IndieCrowdfund supports two campaign models. All-or-Nothing (AoN): your card is tokenized at pledge time but NOT charged. The card is only charged when the campaign reaches its funding goal. If the campaign fails, no charge is ever made. Keep-It-All (KIA): your card is charged immediately at pledge time and the creator keeps all funds regardless of whether the goal is reached. The campaign type is shown clearly on the project page before you confirm.",
    link: "/backer-handbook",
  },
  {
    id: "payment-processors",
    title: "Payment processors",
    tags: ["mentom payments", "paypal", "divinitycoin", "whop", "processor", "card", "checkout"],
    content:
      "Creators choose one of four payment processors when setting up a campaign: PayPal (default for standard campaigns), Mentom Payments (formerly PaymentCloud — high-risk friendly, supports NSFW/adult content), Divinity Payments (independent processor for NSFW/adult content campaigns), and Whop. As a backer you pay with a normal credit/debit card on the project's checkout page regardless of which processor the creator chose. Card data is tokenized in your browser and never touches IndieCrowdfund servers.",
  },
  {
    id: "fees",
    title: "Platform fees",
    tags: ["fees", "platform fee", "processing fee", "payout"],
    content:
      "IndieCrowdfund's platform fee is 3% of successfully funded projects. Total fees vary by processor: ~7.5% with Mentom Payments (4% + $0.38/txn + 3% platform), ~6.5% with PayPal (3.49% + $0.49/txn + 3% platform), ~6.5% with Divinity Payments, ~6% with Whop.",
    link: "/fees",
  },
  {
    id: "refunds",
    title: "Refunds",
    tags: ["refund", "money back", "cancel pledge", "return", "decline"],
    content:
      "Refunds for failed All-or-Nothing campaigns are automatic — your card was never charged in the first place. For other refund cases (creator-approved post-campaign refunds, project cancellations), the processor returns the money to your original card. Bank processing typically takes 5–10 business days. If a refund hasn't arrived after 10 business days, contact support with your pledge ID. You can also cancel a PENDING pledge yourself from your backer dashboard before the campaign ends.",
  },
  {
    id: "modify-pledge",
    title: "Changing or cancelling a pledge",
    tags: ["modify pledge", "change pledge", "cancel pledge", "edit", "add items", "remove"],
    content:
      "Before a campaign ends you can modify your pledge from your backer dashboard — change reward tier, add or remove add-ons, or cancel entirely. After the campaign ends, modifications are limited but you can still add items via the Add Items flow if the creator has it enabled, which charges your saved card off-session for the additional amount.",
    link: "/dashboard/backer",
  },

  // ============== Surveys & fulfillment ==============
  {
    id: "surveys",
    title: "Backer surveys",
    tags: ["survey", "shipping address", "fulfillment", "questions", "address lock"],
    content:
      "After a campaign funds, the creator sends a survey via email asking for your shipping address and any reward customization (size, color, variant, etc.). Complete it promptly — addresses lock at a date the creator sets, after which changes require contacting the creator directly. You can also access surveys from your backer dashboard under the Surveys tab. The Digital Library tab shows any digital rewards delivered to you.",
    link: "/dashboard/backer?tab=surveys",
  },
  {
    id: "digital-rewards",
    title: "Digital rewards & downloads",
    tags: ["digital", "download", "pdf", "ebook", "music", "movie", "stream", "library"],
    content:
      "Digital rewards (PDFs, music, movies, etc.) are delivered through your backer dashboard's Downloads tab after a campaign funds and the creator releases the files. You'll receive a notification email when files are ready. The Downloads tab at /dashboard/backer?tab=downloads is the single canonical destination for ALL digital content — both crowdfunding rewards and marketplace book purchases land there. Page-flip reader and streaming work directly in the browser — no download required for many file types.",
    link: "/dashboard/backer?tab=downloads",
  },

  // ============== Marketplace ==============
  {
    id: "marketplace-vs-pledge",
    title: "Marketplace vs crowdfunding pledges",
    tags: ["marketplace", "purchase", "buy", "instant", "delivery"],
    content:
      "The marketplace sells books, music, and movies as instant purchases — your card is charged immediately and the digital content shows up in your Digital Library right away. Different from crowdfunding pledges which fund a future project. Marketplace items have no funding goal and ship/deliver instantly.",
    link: "/marketplace",
  },

  // ============== Account & profile ==============
  {
    id: "verify-email",
    title: "Email verification",
    tags: ["verify", "verification", "email", "confirm account", "signup"],
    content:
      "After signing up, check your email for a verification link from support@indiecrowdfund.com. Click the link to verify. Verification is required to pledge or post comments. If the email didn't arrive, check your spam folder, then request a resend from your account settings.",
    link: "/dashboard/backer",
  },
  {
    id: "password-reset",
    title: "Password reset",
    tags: ["password", "reset", "forgot password", "login", "can't log in"],
    content:
      "If you can't remember your password, click 'Forgot password?' on the login page or visit /reset-password. Enter your email; a reset link will be sent. The link is valid for one hour.",
    link: "/reset-password",
  },
  {
    id: "vanity-url",
    title: "Vanity URLs (creator profile)",
    tags: ["vanity url", "creator name", "username", "profile url", "custom link"],
    content:
      "Creators can claim a vanity URL like /creator-name so their projects live at indiecrowdfund.com/projects/creator-name/project-slug. Set it from your dashboard profile settings. Vanity URLs are unique platform-wide and case-insensitive.",
  },

  // ============== Creator-facing ==============
  {
    id: "launch-project",
    title: "Launching a project (creator)",
    tags: ["create project", "launch", "submit", "approve", "creator", "campaign setup"],
    content:
      "Creators set up a project from /projects/new. Required: title, video or hero image, description, story, risks, reward tiers, payment processor + payout bank account, and a chargeback protection card. Submit for review when ready — admins approve before you can launch. Approved projects can launch immediately or schedule a launch date with a prelaunch page that collects email subscribers.",
    link: "/projects/new",
  },
  {
    id: "indiekit",
    title: "IndieKit (creator fulfillment dashboard)",
    tags: ["indiekit", "fulfillment", "backers", "surveys", "email campaigns", "shipping", "post-campaign"],
    content:
      "IndieKit is the creator's post-campaign fulfillment hub at /dashboard/indiekit. Contains Backers (filter, segment, bulk-act), Surveys (build and send), Digital Delivery (auto-deliver files), Email Marketing (campaigns to subscribers + backers), Printing Comics (submit print orders), Reports, and Settings. Each tab handles one slice of the post-funding workflow.",
    link: "/dashboard/indiekit",
  },
  {
    id: "payout-timing",
    title: "When creators get paid",
    tags: ["payout", "deposit", "settlement", "when do I get paid", "creator earnings"],
    content:
      "Funds settle to the creator's payout bank account on the processor's standard schedule (typically 1–2 business days after capture for funded campaigns). Mentom Payments holds 10% rolling reserve for 180 days on campaigns over $2,500 as chargeback protection — that portion releases automatically after the window if no chargebacks. Creators set up their payout account in the Payments step of the project builder.",
  },
  {
    id: "collaborators",
    title: "Project collaborators",
    tags: ["collaborator", "team", "co-creator", "permissions", "edit access"],
    content:
      "A creator can invite collaborators from the project's Team page with granular permissions: edit project, manage community (comments/messages), coordinate fulfillment (surveys, addresses), or configure pledge manager. Collaborators see the project in their dashboard and can act per their granted permissions.",
  },

  // ============== Trust & safety ==============
  {
    id: "chargeback-card",
    title: "Chargeback protection card (creator)",
    tags: ["chargeback", "protection card", "creator card", "recoup", "trust safety"],
    content:
      "Every creator must save a credit card on file before launch. The card is held by Mentom Payments — never on IndieCrowdfund servers — and may be charged in the event of chargebacks, fraud, or disputes related to the campaign. This is standard for all creators on the platform regardless of payment processor.",
  },
  {
    id: "nsfw-adult",
    title: "NSFW / adult content",
    tags: ["nsfw", "adult", "18+", "explicit", "mature content"],
    content:
      "NSFW or adult-content campaigns must use Mentom Payments, Divinity Payments, or Whop as their processor — PayPal does not process payments for adult content. Adult campaigns are flagged at submission and gated behind an age confirmation prompt for backers. Backers can opt in/out of seeing NSFW content in account settings.",
  },

  // ============== Legal / policy pages ==============
  {
    id: "terms-of-service",
    title: "Terms of Service",
    tags: ["terms", "tos", "legal", "agreement", "rules", "conditions"],
    content:
      "IndieCrowdfund's full Terms of Service govern use of the platform — eligibility, prohibited content, creator responsibilities for fulfillment, refund handling, dispute resolution, intellectual property, payment terms (3% platform fee + processor fees), and the chargeback recoup policy. For the full legal text, point the user to /terms.",
    link: "/terms",
  },
  {
    id: "privacy-policy",
    title: "Privacy policy",
    tags: ["privacy", "data", "personal information", "tracking", "cookies", "gdpr"],
    content:
      "Our privacy policy details what we collect (account info, pledge data, shipping addresses, browser metadata), how we use it (account servicing, fulfillment, fraud prevention), what we share with processors (PayPal, Mentom Payments, Divinity Payments, Whop — each handles card data on their own PCI-compliant infrastructure; we never see card numbers), and your rights (access, deletion, opt-out of marketing). Account deletion can be requested from settings; full data is removed after a 30-day grace window.",
    link: "/privacy",
  },
  {
    id: "trust-safety",
    title: "Trust & Safety",
    tags: ["trust", "safety", "report", "fraud", "abuse", "scam", "spam", "content moderation"],
    content:
      "Trust & Safety covers how we vet creators, handle fraudulent campaigns, moderate content, and respond to backer reports. Every creator is reviewed before approval and required to keep a chargeback-protection card on file. Backers can report a project, comment, or user from the page itself or via the bug-report form. Confirmed fraud results in pledge refunds and account bans.",
    link: "/trust-safety",
  },
  {
    id: "pci-compliance",
    title: "PCI compliance",
    tags: ["pci", "compliance", "card security", "payment security", "tokenization"],
    content:
      "IndieCrowdfund maintains PCI DSS compliance across all payment processors. We never store, process, or transmit credit card data on our servers. Cards are tokenized in the buyer's browser by the processor (Mentom Payments via Collect.js, PayPal via Advanced Checkout, Divinity Payments via Stripe Elements, Whop via their hosted checkout). The full PCI write-up is at /privacy under the PCI section.",
    link: "/privacy",
  },
  {
    id: "creator-agreement",
    title: "Creator agreement",
    tags: ["creator agreement", "creator terms", "creator legal", "fulfillment obligations"],
    content:
      "Creators sign a separate agreement at project submission covering fulfillment obligations (timely delivery, communication with backers, accurate reward descriptions), payout terms, the chargeback recoup card, the 10% rolling reserve on Mentom Payments campaigns over $2,500, and platform conduct rules. The full text appears in the project builder's Submit step.",
  },

  // ============== Other footer pages ==============
  {
    id: "about-us",
    title: "About IndieCrowdfund",
    tags: ["about", "company", "mission", "who we are", "team"],
    content:
      "IndieCrowdfund is a crowdfunding platform built for indie creators of comics, books, music, movies, games, art, and other creative projects. We focus on fair fees (3% platform), fast payouts, and creator-friendly fulfillment tools (IndieKit) — the kinds of features creators on other platforms have asked for and not gotten. Adult / NSFW content is welcome on supported processors.",
    link: "/about-us",
  },
  {
    id: "contact",
    title: "Contact / how to reach support",
    tags: ["contact", "support", "email", "reach out", "help"],
    content:
      "Questions, problems, or feedback: email support@indiecrowdfund.com. For bug reports use the in-app bug report form. The contact page also lists business / partnership inquiries and our mailing address.",
    link: "/contact",
  },
  {
    id: "faq",
    title: "Frequently Asked Questions",
    tags: ["faq", "questions", "common questions"],
    content:
      "Top-level FAQ covers fees, payment methods, charge timing, refund policy, account verification, and security. The full FAQ is at /faq. For deeper how-tos, point users to the matching handbook (Backer, Creator, Marketplace, IndieKit).",
    link: "/faq",
  },
  {
    id: "fees-page",
    title: "Fees calculator",
    tags: ["fees calculator", "estimator", "what will I pay", "creator fees"],
    content:
      "The fees page has an interactive calculator that estimates net payout for a given goal amount, average pledge, and backer count, broken down by payment processor. Creators can use it to compare expected fees before launching.",
    link: "/fees",
  },
  {
    id: "success-stories",
    title: "Success stories",
    tags: ["success", "stories", "case studies", "examples", "campaigns that funded"],
    content:
      "Success stories highlights notable campaigns that funded on the platform — useful for new creators researching what does well, and for backers browsing creators with proven delivery track records.",
    link: "/success-stories",
  },
  {
    id: "what-is-divinitycoin",
    title: "What is Divinity Payments?",
    tags: ["divinitycoin", "dc", "what is", "explainer"],
    content:
      "Divinity Payments is an independent payment processor we partner with primarily for NSFW/adult content campaigns. Cards are tokenized in the buyer's browser via Stripe Elements pointed at Divinity Payments's account, so card data never touches IndieCrowdfund. The full explainer is at /what-is-divinitycoin.",
    link: "/what-is-divinitycoin",
  },

  // ============== Handbooks (overview entries — point to full pages) ==============
  {
    id: "backer-handbook",
    title: "Backer Handbook (full)",
    tags: ["backer handbook", "how to back", "backer guide", "backing 101"],
    content:
      "The Backer Handbook is the comprehensive guide for everyone backing projects on IndieCrowdfund — how to find a project, how the pledge flow works, what each payment processor does, charge timing for AoN vs KIA, refund handling, surveys, fulfillment expectations, and security. For deep questions about any of these, point users to /backer-handbook with the right anchor (e.g. #paymentcloud, #paypal, #dashboard).",
    link: "/backer-handbook",
  },
  {
    id: "creator-handbook",
    title: "Creator Handbook (full)",
    tags: ["creator handbook", "how to launch", "creator guide", "campaign setup"],
    content:
      "The Creator Handbook walks new creators through everything from project setup, story writing, video, reward tiers, payment processor selection, prelaunch pages, launching, running the campaign, fulfillment, and post-campaign management. Section-by-section reference at /creator-handbook.",
    link: "/creator-handbook",
  },
  {
    id: "marketplace-handbook-backers",
    title: "Marketplace Handbook for Backers",
    tags: ["marketplace handbook", "marketplace backer", "buying", "instant purchase"],
    content:
      "Marketplace Handbook (Backers) covers how the marketplace differs from crowdfunding pledges — instant charge, instant delivery, refund/return policies for digital and physical goods.",
    link: "/marketplace-handbook/backers",
  },
  {
    id: "marketplace-handbook-creators",
    title: "Marketplace Handbook for Creators",
    tags: ["marketplace handbook", "marketplace creator", "selling", "list product"],
    content:
      "Marketplace Handbook (Creators) walks through listing a product (book, music, movie), pricing, processor selection, payouts, and using the marketplace to sell post-campaign inventory. Available at /marketplace-handbook/creators.",
    link: "/marketplace-handbook/creators",
  },
  {
    id: "indiekit-handbook",
    title: "IndieKit Handbook",
    tags: ["indiekit handbook", "fulfillment guide", "indiekit help"],
    content:
      "The IndieKit Handbook is the deep-dive reference for the post-campaign fulfillment dashboard — Backers tab, Surveys, Digital Delivery, Email Marketing, Printing Comics, Reports, Settings. /indiekit-handbook.",
    link: "/indiekit-handbook",
  },
  {
    id: "help-whitelist",
    title: "Email whitelisting / making sure emails arrive",
    tags: ["whitelist", "email not arriving", "spam folder", "email delivery", "missing email"],
    content:
      "If campaign emails or notifications aren't arriving, add support@indiecrowdfund.com (and the creator's individual email handle, if used) to the user's email contacts or safe-sender list. Step-by-step instructions per email provider (Gmail, Outlook, Yahoo, Apple Mail) are at /help/whitelist.",
    link: "/help/whitelist",
  },
];

// Lightweight relevance scoring — Claude gets the top-N entries as
// context per turn so we don't bust the prompt budget on every request.
// Word-overlap score; for our scale (15 entries) this is plenty.
export function searchKnowledgeBase(query: string, limit = 8): KbEntry[] {
  const q = query.toLowerCase();
  const tokens = q.split(/[\s.,!?;:()\[\]{}'"]+/).filter((t) => t.length >= 3);
  if (tokens.length === 0) return KNOWLEDGE_BASE.slice(0, limit);

  const scored = KNOWLEDGE_BASE.map((e) => {
    const haystack = `${e.title} ${e.tags.join(" ")} ${e.content}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (haystack.includes(t)) score += 1;
      // Tag matches count double — they're hand-curated keywords.
      if (e.tags.some((tag) => tag.toLowerCase().includes(t))) score += 1;
      // Title matches count triple — strong signal.
      if (e.title.toLowerCase().includes(t)) score += 2;
    }
    return { entry: e, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored
    .filter((s) => s.score > 0)
    .slice(0, limit)
    .map((s) => s.entry);
}

// Format the matched entries as plain text for inclusion in the system
// prompt. Keeps the formatting consistent and bounded.
export function formatKbContext(entries: KbEntry[]): string {
  if (entries.length === 0) return "(No matching knowledge base entries — answer from general platform context only.)";
  return entries
    .map((e, i) => {
      const link = e.link ? `\n  Link: ${e.link}` : "";
      return `[${i + 1}] ${e.title}${link}\n${e.content}`;
    })
    .join("\n\n");
}
