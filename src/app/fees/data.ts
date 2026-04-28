import { Shield, CheckCircle, Zap, Globe } from "lucide-react";

export type PaymentMethod = "stripe" | "paypal" | "divinitycoin" | "whop" | "paymentcloud";

export const stripeFeeBreakdown = [
  {
    title: "Platform Fee",
    rate: "3%",
    description: "Charged on successfully funded campaigns only",
    details:
      "Our platform fee covers hosting, tools, customer support, and payment processing infrastructure.",
  },
  {
    title: "Stripe Processing",
    rate: "2.9% + $0.30",
    description: "Standard credit card processing rates",
    details:
      "This fee goes directly to Stripe and covers the cost of securely handling credit card transactions.",
  },
];

export const divinityCoinFeeBreakdown = [
  {
    title: "DivinityCoin Partner Fee",
    rate: "3% + $0.30",
    description: "Per-transaction fee charged by DivinityCoin",
    details:
      "3% of total pledges plus $0.30 per individual transaction. Covers secure card processing and compliance infrastructure handled by DivinityCoin.",
  },
  {
    title: "IndieCrowdfund Platform Fee",
    rate: "3%",
    description: "Deducted from creator payouts",
    details:
      "Applied on the remainder after DivinityCoin partner fees are deducted. Covers hosting, tools, and customer support.",
  },
];

export const paypalFeeBreakdown = [
  {
    title: "PayPal Processing Fee",
    rate: "3.49% + $0.49",
    description: "Per-transaction fee charged by PayPal",
    details:
      "PayPal Advanced Checkout processing fee. IndieCrowdfund collects all pledges into our PayPal account on your behalf, then pays out your net earnings directly to your bank account after deducting this fee at settlement time.",
  },
  {
    title: "IndieCrowdfund Platform Fee",
    rate: "3%",
    description: "Charged on successfully funded campaigns only",
    details:
      "Our platform fee covers hosting, tools, customer support, and payment infrastructure.",
  },
];

export const paymentCloudFeeBreakdown = [
  {
    title: "PaymentCloud Processing Fee",
    rate: "4.5% + $0.13",
    description: "Per-transaction merchant account rate",
    details:
      "Standard credit/debit card processing fee on the IndieCrowdfund PaymentCloud merchant account. Cards are tokenized at pledge time via Collect.js (PAN never touches our servers) and only charged when a campaign hits its goal.",
  },
  {
    title: "IndieCrowdfund Platform Fee",
    rate: "3%",
    description: "Charged on successfully funded campaigns only",
    details:
      "Applied on the remainder after PaymentCloud processing fees are deducted. Covers hosting, tools, and customer support.",
  },
];

export const whopFeeBreakdown = [
  {
    title: "Whop Processing Fee",
    rate: "~3%",
    description: "Per-transaction fee charged by Whop",
    details:
      "Whop's embedded checkout processing fee. Supports all content types including adult/NSFW projects. IndieCrowdfund collects pledges through Whop and pays out your net earnings after deducting this fee at settlement.",
  },
  {
    title: "IndieCrowdfund Platform Fee",
    rate: "3%",
    description: "Charged on successfully funded campaigns only",
    details:
      "Our platform fee covers hosting, tools, customer support, and payment infrastructure.",
  },
];

export const comparisonData = [
  {
    platform: "IndieCrowdfund (PaymentCloud)",
    platformFee: "3%",
    paymentFee: "4.5% + $0.13/txn",
    total: "~7.5%",
    highlight: true,
  },
  {
    platform: "IndieCrowdfund (PayPal)",
    platformFee: "3%",
    paymentFee: "3.49% + $0.49",
    total: "~6.5%",
    highlight: false,
  },
  {
    platform: "IndieCrowdfund (DivinityCoin)",
    platformFee: "3%",
    paymentFee: "3% + $0.30/txn",
    total: "~6.5%",
    highlight: false,
  },
  {
    platform: "IndieCrowdfund (Whop)",
    platformFee: "3%",
    paymentFee: "3% Whop",
    total: "~6%",
    highlight: false,
  },
  // Stripe (Legacy) - hidden for now
  // {
  //   platform: "IndieCrowdfund (Stripe – Legacy)",
  //   platformFee: "3%",
  //   paymentFee: "2.9% + $0.30",
  //   total: "~6%",
  //   highlight: false,
  // },
  {
    platform: "Kickstarter",
    platformFee: "5%",
    paymentFee: "3% + $0.20",
    total: "~8%",
    highlight: false,
  },
  {
    platform: "Indiegogo",
    platformFee: "5%",
    paymentFee: "2.9% + $0.30",
    total: "~8%",
    highlight: false,
  },
  {
    platform: "GoFundMe",
    platformFee: "0%",
    paymentFee: "2.9% + $0.30",
    total: "~3%",
    highlight: false,
  },
];

export const features = [
  {
    icon: Shield,
    title: "No Hidden Fees",
    description: "What you see is what you get. No surprise charges or hidden costs.",
  },
  {
    icon: CheckCircle,
    title: "Only Pay When Funded",
    description: "If your campaign doesn't reach its goal, you pay nothing.",
  },
  {
    icon: Zap,
    title: "Fast Payouts",
    description: "Receive your funds within 14 days of campaign completion.",
  },
  {
    icon: Globe,
    title: "Global Payments",
    description: "Accept payments from backers in 135+ countries and currencies.",
  },
];
