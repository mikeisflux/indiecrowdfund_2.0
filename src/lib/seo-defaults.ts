/**
 * Default SEO content for all static pages.
 * Used by the bulk auto-fix system to populate missing SEO fields.
 */

export interface SeoPageDefaults {
  title: string;
  description: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  keywords: string[];
}

const DEFAULT_OG_IMAGE = "/api/og";

export const SEO_PAGE_DEFAULTS: Record<string, SeoPageDefaults> = {
  "/": {
    title: "IndieCrowdfund - The Best Kickstarter Alternative for Independent Creators",
    description:
      "IndieCrowdfund is the top crowdfunding platform for creative projects. Launch your campaign, fund innovative ideas, and join a thriving community of creators and backers.",
    ogTitle: "IndieCrowdfund - Crowdfunding for Independent Creators",
    ogDescription:
      "The best Kickstarter alternative with lower fees and more flexibility. Launch your project today.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["crowdfunding", "kickstarter alternative", "independent creators", "fund projects", "creative campaigns"],
  },
  "/crowdfunds": {
    title: "Discover Projects - Browse Creative Campaigns",
    description:
      "Explore crowdfunding campaigns across categories like games, art, music, film, and technology. Find and back the next big idea on IndieCrowdfund.",
    ogTitle: "Discover Amazing Projects on IndieCrowdfund",
    ogDescription:
      "Browse creative crowdfunding campaigns and back projects you believe in. New projects added daily.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["discover projects", "crowdfunding campaigns", "browse projects", "back a project", "creative ideas"],
  },
  "/about-us": {
    title: "About Us - Our Mission to Empower Creators",
    description:
      "Learn about IndieCrowdfund's mission to empower independent creators with fair crowdfunding. Our story, values, and commitment to the creative community.",
    ogTitle: "About IndieCrowdfund - Empowering Independent Creators",
    ogDescription:
      "Our mission is to provide the fairest crowdfunding platform for independent creators worldwide.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["about indiecrowdfund", "crowdfunding platform", "independent creators", "our mission", "creator community"],
  },
  "/faq": {
    title: "FAQ - Frequently Asked Questions",
    description:
      "Get answers to common questions about crowdfunding on IndieCrowdfund. Learn about creating campaigns, backing projects, fees, payouts, and more.",
    ogTitle: "Frequently Asked Questions - IndieCrowdfund",
    ogDescription:
      "Find answers about creating campaigns, backing projects, fees, and payouts on IndieCrowdfund.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["faq", "crowdfunding questions", "how crowdfunding works", "campaign help", "backer questions"],
  },
  "/fees": {
    title: "Fees & Pricing - Transparent Crowdfunding Costs",
    description:
      "IndieCrowdfund offers competitive and transparent pricing for creators. Learn about our platform fees, payment processing rates, and why we're more affordable than Kickstarter.",
    ogTitle: "IndieCrowdfund Fees - Lower Than Kickstarter",
    ogDescription:
      "Transparent, competitive pricing for creators. See why our fees beat Kickstarter and other platforms.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["crowdfunding fees", "platform pricing", "kickstarter fees comparison", "creator costs", "payment processing"],
  },
  "/contact": {
    title: "Contact Us - Get in Touch",
    description:
      "Have a question or need support? Contact the IndieCrowdfund team. We're here to help creators and backers with any issues or inquiries.",
    ogTitle: "Contact IndieCrowdfund - We're Here to Help",
    ogDescription:
      "Reach out to our team for support, questions, or partnership inquiries. We respond within 24 hours.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["contact", "support", "help", "customer service", "get in touch"],
  },
  "/privacy": {
    title: "Privacy Policy - How We Protect Your Data",
    description:
      "Read IndieCrowdfund's privacy policy to understand how we collect, use, and protect your personal information. Your privacy matters to us.",
    ogTitle: "Privacy Policy - IndieCrowdfund",
    ogDescription:
      "Learn how IndieCrowdfund protects your personal data and respects your privacy.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["privacy policy", "data protection", "personal information", "user privacy", "data security"],
  },
  "/terms": {
    title: "Terms of Service - Platform Rules & Guidelines",
    description:
      "Review IndieCrowdfund's terms of service. Understand the rules, guidelines, and agreements for using our crowdfunding platform as a creator or backer.",
    ogTitle: "Terms of Service - IndieCrowdfund",
    ogDescription:
      "Our terms of service outline the rules and guidelines for using the IndieCrowdfund platform.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["terms of service", "user agreement", "platform rules", "crowdfunding terms", "guidelines"],
  },
  "/trust-safety": {
    title: "Trust & Safety - Secure Crowdfunding You Can Rely On",
    description:
      "IndieCrowdfund is committed to trust and safety. Learn about our fraud prevention, project verification, and how we protect creators and backers.",
    ogTitle: "Trust & Safety at IndieCrowdfund",
    ogDescription:
      "See how we keep crowdfunding safe with fraud prevention, project verification, and backer protection.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["trust and safety", "fraud prevention", "secure crowdfunding", "project verification", "backer protection"],
  },
  "/backer-handbook": {
    title: "Backer Handbook - Guide to Backing Projects",
    description:
      "Everything you need to know about backing projects on IndieCrowdfund. Learn how to find campaigns, pledge safely, track rewards, and support creators.",
    ogTitle: "Backer Handbook - How to Back Projects",
    ogDescription:
      "Your complete guide to backing crowdfunding projects. Find campaigns, pledge safely, and track your rewards.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["backer guide", "how to back projects", "pledge guide", "crowdfunding backer", "reward tracking"],
  },
  "/creator-handbook": {
    title: "Creator Handbook - Launch a Successful Campaign",
    description:
      "The complete guide for creators launching crowdfunding campaigns on IndieCrowdfund. Tips for campaign setup, rewards, marketing, and reaching your funding goal.",
    ogTitle: "Creator Handbook - Launch Your Campaign",
    ogDescription:
      "Everything you need to create and launch a successful crowdfunding campaign on IndieCrowdfund.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["creator guide", "launch campaign", "crowdfunding tips", "campaign setup", "creator handbook"],
  },
  "/indiekit-handbook": {
    title: "IndieKit Handbook - Your Creator Toolkit",
    description:
      "Learn how to use IndieKit, our suite of creator tools for campaign management, analytics, backer communication, and fulfillment on IndieCrowdfund.",
    ogTitle: "IndieKit Handbook - Creator Tools Guide",
    ogDescription:
      "Master IndieKit, the all-in-one toolkit for managing your crowdfunding campaign and engaging backers.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["indiekit", "creator tools", "campaign management", "backer communication", "analytics"],
  },
  "/shop": {
    title: "Marketplace - Shop Creator Products & Add-ons",
    description:
      "Browse the IndieCrowdfund Marketplace for unique products, digital downloads, and add-ons from independent creators. Support creators beyond crowdfunding.",
    ogTitle: "IndieCrowdfund Marketplace - Shop Creator Products",
    ogDescription:
      "Discover unique products and digital downloads from independent creators in our marketplace.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["marketplace", "creator products", "digital downloads", "indie products", "shop creator goods"],
  },
  "/shop/books": {
    title: "Books - Indie Author Marketplace",
    description:
      "Discover books from independent authors on the IndieCrowdfund Marketplace. Browse fiction, non-fiction, graphic novels, and more from talented indie creators.",
    ogTitle: "Indie Books Marketplace - IndieCrowdfund",
    ogDescription:
      "Shop books from independent authors. Fiction, non-fiction, graphic novels, and more.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["indie books", "independent authors", "book marketplace", "self-published books", "graphic novels"],
  },
  "/retailers": {
    title: "Retailers - Partner With IndieCrowdfund",
    description:
      "Become an IndieCrowdfund retail partner. Stock unique creator products, reach new customers, and support independent creators through our retail program.",
    ogTitle: "Retail Partners - IndieCrowdfund",
    ogDescription:
      "Partner with IndieCrowdfund to stock unique products from independent creators in your store.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["retailers", "retail partners", "stock creator products", "indie retail", "partnership program"],
  },
  "/success-stories": {
    title: "Success Stories - Creators Who Made It Happen",
    description:
      "Read inspiring success stories from creators who launched funded campaigns on IndieCrowdfund. See how independent creators turned their ideas into reality.",
    ogTitle: "Creator Success Stories - IndieCrowdfund",
    ogDescription:
      "Inspiring stories of creators who successfully funded their projects on IndieCrowdfund.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["success stories", "funded campaigns", "creator stories", "crowdfunding success", "inspiration"],
  },
  "/help": {
    title: "Help Center - Support & Resources",
    description:
      "Get help with IndieCrowdfund. Browse our support resources, tutorials, and guides for creators and backers. Find answers to common questions fast.",
    ogTitle: "Help Center - IndieCrowdfund Support",
    ogDescription:
      "Find answers, tutorials, and guides for using IndieCrowdfund as a creator or backer.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["help center", "support", "tutorials", "guides", "troubleshooting"],
  },
  "/changelog": {
    title: "Changelog - Latest Updates & New Features",
    description:
      "Stay up to date with the latest IndieCrowdfund updates, new features, improvements, and bug fixes. See what's new on the platform.",
    ogTitle: "What's New on IndieCrowdfund",
    ogDescription:
      "Check out the latest features, improvements, and updates to the IndieCrowdfund platform.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["changelog", "updates", "new features", "platform improvements", "release notes"],
  },
  "/what-is-divinitycoin": {
    title: "What is DivinityCoin? - Platform Currency Explained",
    description:
      "Learn about DivinityCoin, IndieCrowdfund's platform currency. Discover how to earn, use, and benefit from DivinityCoin when backing and creating projects.",
    ogTitle: "DivinityCoin - IndieCrowdfund Platform Currency",
    ogDescription:
      "Everything you need to know about DivinityCoin and how it works on IndieCrowdfund.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["divinitycoin", "platform currency", "rewards", "earn coins", "crowdfunding rewards"],
  },
  "/shop-handbook/creators": {
    title: "Marketplace Creator Guide - Sell Your Products",
    description:
      "The complete guide for selling on the IndieCrowdfund Marketplace. Learn how to list products, manage orders, set pricing, and grow your creator shop.",
    ogTitle: "Sell on IndieCrowdfund Marketplace - Creator Guide",
    ogDescription:
      "Everything creators need to know about listing and selling products on our marketplace.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["sell on marketplace", "creator shop", "list products", "marketplace guide", "creator selling"],
  },
  "/shop-handbook/backers": {
    title: "Marketplace Backer Guide - How to Shop",
    description:
      "Your guide to shopping on the IndieCrowdfund Marketplace. Learn how to find products, make purchases, track orders, and support independent creators.",
    ogTitle: "Shop the IndieCrowdfund Marketplace - Backer Guide",
    ogDescription:
      "Learn how to find, purchase, and track products from independent creators in our marketplace.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["marketplace shopping", "backer guide", "buy from creators", "track orders", "marketplace help"],
  },
  "/collaborate": {
    title: "Collaborate - Partner With Other Creators",
    description:
      "Find collaboration opportunities with other creators on IndieCrowdfund. Team up for campaigns, cross-promote projects, and grow your creative network.",
    ogTitle: "Creator Collaboration - IndieCrowdfund",
    ogDescription:
      "Connect and collaborate with other creators. Team up on campaigns and grow together.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["collaborate", "creator partnerships", "team projects", "cross-promotion", "creative network"],
  },
  "/bug-report": {
    title: "Report a Bug - Help Us Improve",
    description:
      "Found an issue on IndieCrowdfund? Report bugs and help us improve the platform. Our team investigates and resolves reported issues promptly.",
    ogTitle: "Report a Bug - IndieCrowdfund",
    ogDescription:
      "Help us improve IndieCrowdfund by reporting bugs. Our team investigates issues promptly.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["bug report", "report issue", "platform feedback", "help improve", "technical support"],
  },
  "/login": {
    title: "Log In to Your Account",
    description:
      "Sign in to your IndieCrowdfund account to manage campaigns, track backed projects, access your dashboard, and connect with the creator community.",
    ogTitle: "Log In - IndieCrowdfund",
    ogDescription:
      "Sign in to manage your campaigns, track pledges, and access your IndieCrowdfund dashboard.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["login", "sign in", "account access", "creator dashboard", "backer dashboard"],
  },
  "/register": {
    title: "Create Your Account - Join IndieCrowdfund",
    description:
      "Sign up for IndieCrowdfund and start your journey as a creator or backer. Create an account in seconds and join the independent crowdfunding community.",
    ogTitle: "Join IndieCrowdfund - Create Your Account",
    ogDescription:
      "Sign up for free and start backing or creating crowdfunding campaigns on IndieCrowdfund.",
    ogImage: DEFAULT_OG_IMAGE,
    keywords: ["register", "sign up", "create account", "join crowdfunding", "get started"],
  },
};
