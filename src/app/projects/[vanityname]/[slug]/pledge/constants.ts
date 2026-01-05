import { SHIPPING_COUNTRIES } from "@/types";

// Map timezone to country code for auto-detection
export const TIMEZONE_TO_COUNTRY: Record<string, string> = {
  "America/New_York": "US", "America/Los_Angeles": "US", "America/Chicago": "US", "America/Denver": "US",
  "America/Toronto": "CA", "America/Vancouver": "CA", "America/Montreal": "CA",
  "Europe/London": "GB", "Europe/Berlin": "DE", "Europe/Paris": "FR", "Europe/Rome": "IT", "Europe/Madrid": "ES",
  "Europe/Amsterdam": "NL", "Europe/Brussels": "BE", "Europe/Zurich": "CH", "Europe/Vienna": "AT",
  "Europe/Stockholm": "SE", "Europe/Oslo": "NO", "Europe/Copenhagen": "DK", "Europe/Helsinki": "FI",
  "Europe/Dublin": "IE", "Europe/Warsaw": "PL", "Europe/Prague": "CZ", "Europe/Lisbon": "PT",
  "Europe/Athens": "GR", "Europe/Bucharest": "RO", "Europe/Budapest": "HU",
  "Australia/Sydney": "AU", "Australia/Melbourne": "AU", "Australia/Perth": "AU",
  "Pacific/Auckland": "NZ", "Asia/Tokyo": "JP", "Asia/Singapore": "SG", "Asia/Hong_Kong": "HK",
  "Asia/Seoul": "KR", "America/Mexico_City": "MX", "America/Sao_Paulo": "BR", "America/Buenos_Aires": "AR",
  "America/Santiago": "CL", "America/Bogota": "CO", "Asia/Bangkok": "TH", "Asia/Kuala_Lumpur": "MY",
  "Asia/Manila": "PH", "Asia/Jakarta": "ID", "Asia/Kolkata": "IN", "Africa/Johannesburg": "ZA",
  "Asia/Dubai": "AE", "Asia/Jerusalem": "IL", "Asia/Taipei": "TW", "Asia/Shanghai": "CN", "Europe/Moscow": "RU",
};

// Detect user's country from timezone
export function detectUserCountry(): string {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const detectedCountry = TIMEZONE_TO_COUNTRY[timezone];
    // Only return if it's a country we support for shipping
    if (detectedCountry && SHIPPING_COUNTRIES.some(c => c.code === detectedCountry)) {
      return detectedCountry;
    }
  } catch {
    // Ignore errors
  }
  return "US"; // Default fallback
}

export const getFaqItems = (isFunded: boolean) => [
  {
    question: "How do I pledge?",
    answer: "Select your reward tier, add any optional add-ons, enter your shipping information, and complete your payment. You'll receive a confirmation email once your pledge is processed.",
  },
  {
    question: "When is my card charged?",
    answer: isFunded
      ? "Your card is charged immediately when you complete your pledge. This project has already reached its funding goal, so payments are processed right away."
      : "Your card is only charged when the campaign reaches its funding goal. If you pledge before the goal is met, your payment is held and will only be processed once the campaign successfully funds. If the campaign doesn't reach its goal, you won't be charged at all.",
  },
  ...(isFunded
    ? []
    : [
        {
          question: "So I'm only charged if funding succeeds?",
          answer: "Exactly! Your payment is held until the campaign reaches its funding goal. If the project doesn't reach its goal by the deadline, your payment method is never charged.",
        },
      ]),
  {
    question: "What can others see about my pledge?",
    answer: "Creators can see your name, email, and pledge amount. Other backers can only see your public profile name. Your payment details are never shared with creators.",
  },
  {
    question: "What if I want to change my pledge?",
    answer: "You can modify or cancel your pledge at any time before the campaign ends. After the campaign successfully funds, you may be able to update your reward selection or shipping address through the pledge manager.",
  },
  {
    question: "If this project is funded, how do I get my reward?",
    answer: "After successful funding, the creator will begin production. Estimated delivery dates are shown for each reward. You'll receive updates from the creator and they'll reach out when it's time to confirm your shipping details.",
  },
  {
    question: "Will I be charged more later?",
    answer: "You may be charged shipping costs later if they weren't included in your pledge amount. The creator will notify you of any additional charges through the pledge manager before shipping.",
  },
];
