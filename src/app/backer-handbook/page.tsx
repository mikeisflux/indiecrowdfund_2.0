'use client';

import { useState } from 'react';
import {
  Search,
  Heart,
  CreditCard,
  Coins,
  Gift,
  Package,
  Info,
  ArrowLeft,
  Shield,
  BookOpen,
  HelpCircle,
  LayoutDashboard,
  ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import { Footer } from "@/components/footer";

const tabs = [
  { id: 'discover', label: 'Finding Projects', icon: Search },
  { id: 'backing', label: 'Making a Pledge', icon: Heart },
  { id: 'paypal', label: 'Paying with PayPal', icon: CreditCard },
  { id: 'divinitycoin', label: 'DivinityCoin', icon: Coins },
  { id: 'whop', label: 'Paying with Whop', icon: ShoppingBag },
  { id: 'rewards', label: 'Rewards & Add-ons', icon: Gift },
  { id: 'after', label: 'After You Pledge', icon: Package },
  { id: 'dashboard', label: 'Your Backer Dashboard', icon: LayoutDashboard },
  { id: 'marketplace', label: 'Marketplace', icon: BookOpen },
  { id: 'faq', label: 'FAQ', icon: HelpCircle },
];

interface Step {
  title: string;
  description: string;
  tip?: string;
}

interface Section {
  heading: string;
  description?: string;
  steps: Step[];
}

interface TabContent {
  title: string;
  description: string;
  alert?: { icon: typeof Shield; title: string; text: string; color: string };
  steps?: Step[];
  sections?: Section[];
}

const tabContent: Record<string, TabContent> = {
  'discover': {
    title: 'Finding the Perfect Project',
    description: 'Learn how to discover campaigns that match your interests.',
    steps: [
      { title: 'Browse the Discover Page', description: 'Explore live campaigns. Filter by category and sort by popularity, newest, or ending soon.', tip: 'Projects ending soon often have the most momentum.' },
      { title: 'Use Search', description: 'Find projects by name, creator, or keywords. Results include live and past projects.', tip: 'Search for creators you\'ve backed before!' },
      { title: 'Read the Project Page', description: 'See full details, rewards, video, and learn about the creator.', tip: 'Check "Risks & Challenges" - honest creators explain obstacles upfront.' },
      { title: 'Check FAQ & Updates', description: 'Look for FAQ answers and check Updates to see how the creator communicates.', tip: 'Active creators who post regular updates are more likely to deliver.' },
      { title: 'Follow Before Backing', description: 'Not ready? Click the heart to follow. Get notifications without committing.', tip: 'Following pre-launch projects gets you notified at launch with early-bird pricing!' },
    ]
  },
  'backing': {
    title: 'Making Your Pledge',
    description: 'Step-by-step walkthrough of the pledge process.',
    steps: [
      { title: 'Choose Your Reward Tier', description: 'Browse tiers on the right side. Each shows what you receive, amount, delivery date, and shipping.', tip: 'Limited quantity rewards go fast!' },
      { title: 'Click "Back this project"', description: 'Start with the button or click directly on a tier. You can also pledge without a reward.', tip: 'You can change your pledge anytime before the campaign ends.' },
      { title: 'Add Optional Add-ons', description: 'After selecting your reward, add extras like additional copies or accessories.', tip: 'Add-ons often include exclusive items not available elsewhere.' },
      { title: 'Add Bonus Support', description: 'Want to give extra? Add a bonus amount. It doesn\'t change your reward.', tip: 'Every dollar helps projects reach stretch goals faster!' },
      { title: 'Enter Shipping Information', description: 'For physical items, provide your address. Shipping costs vary by location.', tip: 'Double-check your address! Easiest to get it right the first time.' },
      { title: 'Review Your Pledge', description: 'See the complete breakdown before payment. Make sure everything looks correct.', tip: 'Take a screenshot for your records.' },
    ]
  },
  'paypal': {
    title: 'Paying with PayPal',
    description: 'Everything about PayPal payments on IndieCrowdfund, including when you\'re charged.',
    alert: { icon: Shield, title: 'Secure Payment Processing', text: 'Campaign payments are processed securely through PayPal, DivinityCoin, or Whop — depending on the creator\'s chosen processor. You can pay with your credit or debit card at checkout regardless of which processor is used. Your card details are encrypted and never stored on our servers.', color: 'emerald' },
    steps: [
      { title: 'Select Your Payment Method', description: 'At checkout you\'ll see the PayPal Advanced Checkout form — use your PayPal wallet, or enter a credit/debit card directly. No PayPal account required to pay by card.', tip: 'PayPal is trusted by hundreds of millions worldwide.' },
      { title: 'Enter Card or Use PayPal Wallet', description: 'Fill in your card details (Visa, Mastercard, Amex, Discover) or log into your PayPal account to use your saved payment method.', tip: 'Make sure your card won\'t expire before the campaign ends.' },
      { title: 'Understand Campaign Types', description: 'IndieCrowdfund supports two campaign models. "All or Nothing": payment is only captured if the project reaches its goal — if the goal isn\'t reached, the authorization is cancelled. "Keep It All": backers are charged immediately when pledging, regardless of whether the goal is reached.', tip: 'Check the campaign page to see which model the creator has chosen.' },
      { title: 'Understand When You\'re Charged', description: 'For All or Nothing campaigns, you\'re NOT charged until the goal is reached. For Keep It All campaigns, your card is charged immediately at the time of your pledge.', tip: 'The campaign type is shown clearly on the project page before you confirm.' },
      { title: 'Confirm Your Pledge', description: 'Click "Pledge" to submit. You\'ll see confirmation and receive an email.', tip: 'Save your confirmation email.' },
      { title: 'What Happens at Campaign End', description: 'All or Nothing: if successful, payment is captured automatically; if not, any authorization is released. Keep It All: funds are already collected — the campaign ends and the creator keeps everything pledged.', tip: 'Ensure sufficient funds are available when pledging to a Keep It All campaign.' },
    ]
  },
  'divinitycoin': {
    title: 'Paying with DivinityCoin',
    description: 'DivinityCoin is an alternative payment processor - pay with your credit or debit card, processed through DivinityCoin\'s secure system.',
    alert: { icon: Coins, title: 'Seamless Card Payment (Not Cryptocurrency)', text: 'DivinityCoin is a payment sub-processor, not a cryptocurrency. Enter your card details at checkout and payment is handled securely through DivinityCoin\'s certified payment system. Supports all content types including NSFW/adult projects.', color: 'amber' },
    steps: [
      { title: 'What is DivinityCoin?', description: 'DivinityCoin is an alternative payment sub-processor used by some creators on IndieCrowdfund. It is NOT a cryptocurrency or wallet system. When a creator uses DivinityCoin, you simply pay with your credit or debit card at checkout.', tip: 'Learn more at our "What is DivinityCoin?" page.' },
      { title: 'How It Works', description: 'At checkout, you\'ll see a secure card payment form. Enter your card details (Visa, Mastercard, Amex, Discover) and complete your pledge. DivinityCoin handles the payment processing behind the scenes.', tip: 'You\'ll see card brand logos (Visa, Mastercard, etc.) confirming accepted card types.' },
      { title: 'Check Which Payment Processor the Project Uses', description: 'Some creators choose DivinityCoin as their payment processor, while others may use Whop. You\'ll see the processor indicator on the project page and at checkout.', tip: 'Creators choose their processor based on their needs - some content types require DivinityCoin or Whop.' },
      { title: 'Secure Payment', description: 'Your card details are entered directly into a PCI-compliant payment form. IndieCrowdfund never sees or stores your card information. The payment is encrypted end-to-end.', tip: 'Look for the lock icon and "Secure Payment" header with card brand logos.' },
      { title: 'Immediate Charge for Funded Projects or Keep It All Campaigns', description: 'For campaigns that have already reached their goal, your card is charged immediately. Keep It All campaigns also charge immediately when you pledge. For All or Nothing campaigns still in progress, charges are held until the campaign funds.', tip: 'You\'ll see clear messaging about when you\'ll be charged before confirming.' },
      { title: 'Refunds', description: 'If a campaign fails or your pledge is refunded, the refund is processed back to your original payment method. For closed campaigns, backers can submit a refund request which the creator must approve.', tip: 'Refund processing times depend on your card issuer, typically 5-10 business days.' },
    ]
  },
  'whop': {
    title: 'Paying with Whop',
    description: 'Whop is a third payment processor option some creators use on IndieCrowdfund. Pay by credit/debit card — Whop handles the processing.',
    alert: { icon: ShoppingBag, title: 'Card Payments via Whop', text: 'Whop is a regulated payment platform that accepts Visa, Mastercard, Amex, and Discover. Like PayPal and DivinityCoin, the creator chooses Whop as their processor and you check out with your card. IndieCrowdfund never sees or stores your card details.', color: 'emerald' },
    steps: [
      { title: 'What is Whop?', description: 'Whop is one of three payment processors a creator can pick on IndieCrowdfund (PayPal, DivinityCoin, Whop). For you as a backer, the experience is the same: enter your card at a secure checkout. There is no Whop account requirement.', tip: 'Look for the "Powered by Whop" indicator on the project page or at checkout to see which processor a creator is using.' },
      { title: 'How to Tell Which Processor a Project Uses', description: 'Each project page and checkout displays the processor it uses. Some content categories (e.g., adult/NSFW or certain digital goods) require Whop or DivinityCoin instead of PayPal.', tip: 'If the processor matters to you (e.g., refund policy, accepted regions), check before pledging.' },
      { title: 'Checkout Flow', description: 'At pledge time, click "Back this project" → choose your reward → continue to checkout → the Whop card form appears. Enter card number, expiration, CVC, and your billing postal code. Click Pledge.', tip: 'Whop\'s form supports Apple Pay and Google Pay where available — look for the wallet buttons above the card form.' },
      { title: 'When You\'re Charged (All-or-Nothing vs Keep-It-All)', description: 'Same rules as the other processors. All-or-Nothing: card authorized at pledge, captured only if the goal is reached. Keep-It-All: charged immediately at pledge time. Already-funded campaigns charge immediately too.', tip: 'The campaign type and timing are shown clearly on the project page before you confirm.' },
      { title: 'Security', description: 'Whop is PCI-DSS compliant. Card data is tokenized at the browser, sent directly to Whop, and never touches IndieCrowdfund servers. The lock icon and "Secure Payment" header on the form confirm this.', tip: 'Never enter card details on a page that doesn\'t show the processor name and a lock icon in the URL bar.' },
      { title: 'Refunds via Whop', description: 'Refunds for failed All-or-Nothing campaigns are automatic — the authorization is released. For other refund cases (creator-approved post-campaign refunds), Whop returns the money to your original card. Bank processing typically takes 5–10 business days.', tip: 'If a refund hasn\'t arrived after 10 business days, contact support with your pledge ID and the date you were notified of the refund.' },
      { title: 'Where Whop Pledges Show Up in Your Dashboard', description: 'Whop pledges appear in My Projects → Backed exactly like PayPal or DivinityCoin pledges. The processor is visible in the pledge details. Receipts are emailed and also accessible from the pledge card.', tip: 'Filter your Analytics tab by source if you want to see how much you\'ve spent through each processor over time.' },
    ]
  },
  'rewards': {
    title: 'Understanding Rewards & Add-ons',
    description: 'How reward tiers and add-ons work.',
    steps: [
      { title: 'Reward Tiers', description: 'Packages at different price points. Higher tiers include more or exclusive items.', tip: 'Compare tiers - paying a bit more often gets significantly more value.' },
      { title: 'Limited vs Unlimited', description: 'Some rewards limited to specific number of backers. Once gone, they\'re gone.', tip: 'Early-bird tiers offer the best pricing - grab them fast!' },
      { title: 'Estimated Delivery', description: 'Creator\'s best estimate. Crowdfunding often faces delays.', tip: 'Add a few months in your mind for realistic expectations.' },
      { title: 'Shipping Costs', description: 'Usually charged separately. Varies by location and item size/weight.', tip: 'International backers: factor in shipping before pledging.' },
      { title: 'Add-ons Explained', description: 'Extra items you can add to your pledge - extra copies, accessories, etc.', tip: 'Add-ons often include exclusive items not in any tier!' },
      { title: 'Changing Your Pledge', description: 'Modify your pledge anytime before campaign ends in your backer dashboard.', tip: 'Set a reminder a day before the campaign ends to review.' },
    ]
  },
  'after': {
    title: 'After You Pledge',
    description: 'What happens from confirmation to receiving your rewards.',
    steps: [
      { title: 'Confirmation Email', description: 'You\'ll receive email with complete pledge breakdown. Save it for records.', tip: 'Check spam folder if you don\'t see it in a few minutes.' },
      { title: 'Your Backer Dashboard', description: 'See all pledges, update addresses, and track status. Your home base.', tip: 'Bookmark your dashboard for easy access.' },
      { title: 'Following Updates', description: 'Creators post updates throughout. You\'ll get email notifications.', tip: 'Read updates carefully - they often contain surveys or decisions.' },
      { title: 'Completing Surveys', description: 'After campaign ends, creators may send surveys for address, preferences, etc.', tip: 'Complete surveys promptly! Creators can\'t fulfill without the info.' },
      { title: 'Tracking Fulfillment', description: 'See status in your dashboard: Not Started, In Progress, Shipped, Delivered.', tip: 'If "Shipped" but no tracking, check updates or contact creator.' },
      { title: 'Receiving Rewards', description: 'When rewards arrive, celebrate! Consider sharing photos or reviews.', tip: 'Having issues? Contact creator before leaving negative feedback.' },
    ]
  },
  'dashboard': {
    title: 'Your Backer Dashboard — Complete Walkthrough',
    description: 'Every menu in the dashboard, what it does, and step-by-step how to use it. Open your dashboard at /dashboard/backer and follow along.',
    alert: { icon: LayoutDashboard, title: 'Four Sections, One Hub', text: 'The dashboard sidebar is split into four groups: My Projects (what you\'ve backed, saved, organized, or followed), Communication (messages and notifications), Fulfillment (surveys, addresses, downloads, digital library), and Insights (spending analytics). Use the tab buttons at the top of the dashboard to switch between them, or jump in via direct URLs like /dashboard/backer?tab=surveys.', color: 'emerald' },
    sections: [
      {
        heading: 'Top of the Dashboard — Stats & Reminders',
        description: 'Before you dive into a tab, the top of /dashboard/backer shows a snapshot. Read this first.',
        steps: [
          { title: 'Stats Overview Cards', description: 'Four glowing cards: Projects Backed (with success rate), Total Invested (with average per project), Successfully Funded (with delivered count), and Rewards Pending (pulses if you have unfulfilled items). They update live whenever a project status changes.', tip: 'A pulsing "Rewards Pending" card usually means you have a survey to complete — jump straight to the Surveys tab.' },
          { title: 'Shipping Address Reminder Banner', description: 'If you have no shipping address saved and at least one physical reward is in flight, an amber banner appears at the top with an "Add Shipping Address" button that takes you straight to the Addresses tab.', tip: 'Add an address before your first physical pledge — creators can\'t ship without one.' },
          { title: 'Sidebar: Backing Activity, Upcoming Deliveries, Recommended', description: 'On the right side: an animated bar chart of your last 6 months of spending, up to 5 Upcoming Deliveries sorted by estimated date, and Recommended For You suggestions based on the categories you\'ve backed.', tip: 'Click any Upcoming Delivery card to jump to that pledge in the Backed tab.' },
        ],
      },
      {
        heading: 'Section 1 — My Projects',
        description: 'The first section in the sidebar. Everything tied to projects you have a relationship with.',
        steps: [
          { title: 'Backed (My Projects → Backed)', description: 'Lists every project you\'ve pledged to. Each card shows the project image, title, creator name, funding progress bar, your pledge amount, the reward tier you chose, estimated delivery, and the current fulfillment status (Not Started → In Progress → Shipped → Delivered). Use the action buttons: View Project, Manage Pledge, Message Creator, and Complete Survey (when one is open). Tick "Mark as Received" when your reward arrives, then leave a review with 1–5 stars across Overall, Delivery, Quality, and Communication, plus an optional title and review body (5000 char max).', tip: 'How-to: After your reward arrives, open Backed → find the project → tick "Mark as Received" → the review dialog opens automatically → rate each axis → click Save. Reviews help future backers and creators love the feedback.' },
          { title: 'Saved (My Projects → Saved)', description: 'A grid of every project you\'ve hearted/saved. Each card shows the project image, funding percentage, and time remaining. Click "Back this project" to convert a Saved item into a pledge, or "Unsave" to remove it.', tip: 'How-to: Browsing Discover, click the heart icon on any project card → it lands here. Use this as a wishlist before payday.' },
          { title: 'Collections (My Projects → Collections)', description: 'Group projects into named buckets — like Steam wishlists. Click "+ Create Collection" → name it ("Tabletop 2026"), pick a color, choose Public or Private, optionally add a note. Then on any project, use "Add to Collection". Edit, delete, or share a collection from the per-card menu.', tip: 'How-to: Make a Public collection like "Best Solo RPGs of 2026", add 5–10 projects, then share the URL on social. Public collections drive real pledges to creators you love.' },
          { title: 'Following (My Projects → Following)', description: 'Lists every creator you follow. Each row shows their bio, project count, total backers, and recent projects. Per-creator toggles let you turn notifications on/off for new project launches and updates. One-click Unfollow. The activity feed below shows recent creator events (new projects, updates, funded campaigns).', tip: 'How-to: Visit a creator page → click "Follow" → return here → toggle "New project notifications" ON. You\'ll get an email the moment they launch — early-bird tiers go fastest.' },
        ],
      },
      {
        heading: 'Section 2 — Communication',
        description: 'How you talk to creators and how the platform talks to you.',
        steps: [
          { title: 'Messages (Communication → Messages)', description: 'A full inbox-style interface. Conversations on the left, message thread on the right. The Messages tab shows a red unread-count badge in the sidebar. Click a conversation to read, type in the composer, hit Send. Backers usually get priority responses from creators.', tip: 'How-to: Need to fix a shipping address after a survey closed? Open Messages → find the creator → start your message with "Re: Pledge ID #12345". Always include your backer email or pledge ID for fulfillment questions.' },
          { title: 'Notifications (Communication → Notifications)', description: 'Two layers of control. Global preferences: email updates on/off, digest frequency (daily / weekly / monthly), push notifications, marketing emails. Per-project toggles for: updates, comments, surveys, shipping, messages.', tip: 'How-to: Turn shipping notifications ON for every project so you know when to be home for a package. Turn marketing emails OFF and switch global digest to Weekly if your inbox is overflowing.' },
        ],
      },
      {
        heading: 'Section 3 — Fulfillment',
        description: 'Everything between "campaign funded" and "package on your doorstep / file on your hard drive".',
        steps: [
          { title: 'Surveys (Fulfillment → Surveys)', description: 'A hub for every creator survey. The header shows your completion percentage and counts (total / completed / pending). Pending surveys are listed first, then completed. Each survey card shows project image, title, creator, your reward, your pledge amount, and how many questions remain. After a survey deadline, addresses lock and creators may not accept changes — the card surfaces the deadline clearly.', tip: 'How-to: New pledge funded? Check Surveys within 7 days. Click "Complete Survey" → answer size/colour/address questions → submit. Fulfillment waves often happen weeks before the public update — late surveys miss the wave.' },
          { title: 'Addresses (Fulfillment → Addresses)', description: 'Manage every shipping address on your account. Click "+ Add Address" → fill full name, line 1, line 2 (optional), city, state, postal code, country, phone, and a label (Home / Work / Other) → Save. Click the star icon to set a default — it auto-fills on new pledges. Edit or Delete via each card\'s menu. A green tick indicates the address has been validated.', tip: 'How-to: Set your default address BEFORE your next pledge. Saves time at checkout and prevents typos. Moving house? Add the new address, set it as default, then delete the old one only after every active pledge has shipped.' },
          { title: 'Downloads (Fulfillment → Downloads)', description: 'Every file a creator has shared with you, organised by project (each project is an expandable section). File cards show filename, file size, description, download count, and last downloaded date. New files have a "New" badge. Click "Download" to save locally.', tip: 'How-to: Download new files immediately — some creators rotate or expire links for paid digital releases. Keep a local backup folder per project.' },
          { title: 'Digital Library (Fulfillment → Digital Library)', description: 'A built-in PDF/eBook reader for backed projects. Toggle between Grid and List view. Search the library, sort (Date / Name / Reading Progress), and filter (All projects / Source / Status). Click a book to open the reader: zoom controls, page navigation, bookmarks, fullscreen, auto-saved reading progress. If your browser supports IndexedDB, you can also Upload your own PDFs to read alongside backed content.', tip: 'How-to: Open a long PDF → use bookmarks to mark cliffhanger pages or art you want to revisit. Reading progress saves automatically, so you can pick up on another browser tab where you left off.' },
        ],
      },
      {
        heading: 'Section 4 — Insights',
        description: 'Step back and see your backing patterns over time.',
        steps: [
          { title: 'Analytics (Insights → Analytics)', description: 'A dashboard of your spending. Total Spending broken into Physical / Digital / Add-ons / Shipping. Monthly chart for the last 6 months. Category breakdown (Comics, Tabletop, Film, Tech, etc.). Yearly comparison chart. Success rate (backed / funded / failed). Average delivery time. Time-range filter at the top (All time / 1 year / 6 months / etc.). Click "Export CSV" to download the raw data.', tip: 'How-to: Before the holidays, switch the time range to "6 months" and check your Category Breakdown — you\'ll spot trends you didn\'t know about (e.g., 60% of your spending went to one category) and can budget the next quarter accordingly.' },
        ],
      },
      {
        heading: 'Direct Links — Bookmark These',
        description: 'Every dashboard tab has a clean URL. Bookmark the ones you visit most.',
        steps: [
          { title: 'Quick URL Reference', description: 'Append ?tab=<id> to /dashboard/backer to land on a tab directly. Valid IDs: backed, saved, collections, following, messages, notifications, surveys, addresses, downloads, digital-library, analytics. Example: /dashboard/backer?tab=surveys jumps straight to your survey hub.', tip: 'Bookmark /dashboard/backer?tab=surveys and /dashboard/backer?tab=addresses — those are the two tabs you\'ll use most during fulfillment.' },
        ],
      },
    ],
  },
  'marketplace': {
    title: 'Digital Marketplace',
    description: 'Buying digital content for immediate download.',
    steps: [
      { title: 'What is the Marketplace?', description: 'A storefront for completed digital works. Immediate purchase and instant download.', tip: 'Perfect for supporting creators and getting content right away.' },
      { title: 'Browsing', description: 'Explore Featured titles, Staff Picks, or all works. Use search for specific titles.', tip: 'Check out Staff Picks for hand-curated recommendations.' },
      { title: 'Understanding Pricing', description: 'Fixed prices in USD set by creators. You\'re directly supporting them.', tip: 'Digital often costs less than physical - no printing or shipping.' },
      { title: 'Making a Purchase', description: 'Click "Purchase" to checkout. Pay via PayPal, DivinityCoin, or Whop depending on the creator\'s chosen processor. Charged immediately.', tip: 'Unlike pledges, marketplace purchases are instant.' },
      { title: 'Your Digital Library', description: 'Purchases added to your Digital Library in your dashboard. Access anytime.', tip: 'Bookmark your Digital Library for quick access.' },
      { title: 'Reading and Downloads', description: 'Read in browser or download as PDF for offline reading.', tip: 'Downloaded files are yours to keep. Back them up!' },
    ]
  },
  'faq': {
    title: 'Frequently Asked Questions',
    description: 'Common questions about backing projects.',
    steps: [
      { title: 'What are the two campaign types?', description: '"All or Nothing" campaigns are only funded if the goal is reached — if not, no money changes hands. "Keep It All" campaigns let the creator keep all pledges regardless of the goal, and backers are charged immediately when pledging.', tip: 'The campaign type is shown on the project page before you pledge.' },
      { title: 'What if an All or Nothing project doesn\'t reach its goal?', description: 'No money changes hands. Your payment is never captured, regardless of whether the project uses PayPal, DivinityCoin, or Whop.', tip: 'All-or-nothing funding protects you if the goal isn\'t reached.' },
      { title: 'Can I get a refund after pledging?', description: 'Before campaign ends, cancel anytime in your dashboard. After the campaign closes, you can submit a refund request through the platform — the creator must approve it. Contact the creator directly if needed.', tip: 'Refund policies are set by each creator.' },
      { title: 'Is my payment information secure?', description: 'Yes! PayPal processes standard payments with PCI-DSS Level 1 certification. DivinityCoin and Whop also use PCI-compliant processing. We never store full card numbers on our servers.', tip: 'Look for the secure checkout indicator at checkout.' },
      { title: 'What if my card is declined?', description: 'We retry automatically 3 times over 9 days. You\'ll get emails to update your card details.', tip: 'Keep card info updated to avoid failed payments.' },
      { title: 'How do I contact a creator?', description: 'Use "Contact" or "Ask a question" on the project page. Backers often have priority response.', tip: 'Always mention your backer email for pledge-specific issues.' },
      { title: 'What if a creator never delivers?', description: 'Crowdfunding carries risk. Creators are legally obligated to fulfill or refund. Report concerns to our support team.', tip: 'Our verification process helps, but due diligence is important.' },
      { title: 'Can I back anonymously?', description: 'Your pledge is visible to the creator, but you can hide from public backer lists. Payment info is always private.', tip: 'Check your privacy settings in your account.' },
      { title: 'How do stretch goals work?', description: 'Bonus features added if campaign exceeds its goal. If unlocked while you\'re a backer, you get them free!', tip: 'Stretch goals make backing early more exciting!' },
    ]
  },
};

function StepCard({ step, number }: { step: Step; number: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white font-bold text-sm">
          {number}
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{step.title}</h4>
          <p className="mt-1 text-sm text-zinc-600 dark:text-muted-foreground">{step.description}</p>
          {step.tip && (
            <div className="mt-2 flex gap-2 rounded bg-blue-50 dark:bg-blue-950/30 p-2">
              <Info className="h-4 w-4 flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5" />
              <p className="text-xs text-blue-800 dark:text-blue-300">{step.tip}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BackerHandbookPage() {
  const [activeTab, setActiveTab] = useState('discover');
  const currentTab = tabContent[activeTab];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 py-8 text-white">
        <div className="container mx-auto px-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-blue-100 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <h1 className="text-xl sm:text-3xl font-bold">Backer Handbook</h1>
          <p className="mt-1 text-blue-100">Your complete guide to backing projects from start to finish</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 md:flex-shrink-0">
            <nav className="flex flex-wrap gap-1 md:sticky md:top-8 md:flex-col md:space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-100'
                        : 'text-zinc-600 hover:bg-muted dark:text-muted-foreground dark:hover:bg-zinc-800'
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </aside>

          {/* Content Area */}
          <main className="flex-1 min-w-0">
            {currentTab && (
              <>
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{currentTab.title}</h2>
                  <p className="mt-1 text-zinc-600 dark:text-muted-foreground">{currentTab.description}</p>
                </div>

                {currentTab.alert && (
                  <div className={`mb-6 rounded-lg border p-4 ${currentTab.alert.color === 'emerald' ? 'border-emerald-200 bg-emerald-50 dark:bg-emerald-950/30' : 'border-amber-200 bg-amber-50 dark:bg-amber-950/30'}`}>
                    <div className="flex gap-3">
                      <currentTab.alert.icon className={`h-5 w-5 flex-shrink-0 ${currentTab.alert.color === 'emerald' ? 'text-emerald-600' : 'text-amber-600'}`} />
                      <div>
                        <h4 className={`font-medium ${currentTab.alert.color === 'emerald' ? 'text-emerald-800 dark:text-emerald-200' : 'text-amber-800 dark:text-amber-200'}`}>{currentTab.alert.title}</h4>
                        <p className={`mt-1 text-sm ${currentTab.alert.color === 'emerald' ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>{currentTab.alert.text}</p>
                      </div>
                    </div>
                  </div>
                )}

                {currentTab.sections ? (
                  <div className="space-y-8">
                    {currentTab.sections.map((section) => (
                      <section key={section.heading}>
                        <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 border-b border-border pb-2 mb-3">
                          {section.heading}
                        </h3>
                        {section.description && (
                          <p className="mb-3 text-sm text-zinc-600 dark:text-muted-foreground">{section.description}</p>
                        )}
                        <div className="space-y-3">
                          {section.steps.map((step, index) => (
                            <StepCard key={step.title} step={step} number={index + 1} />
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                ) : currentTab.steps ? (
                  <div className="space-y-3">
                    {currentTab.steps.map((step, index) => (
                      <StepCard key={step.title} step={step} number={index + 1} />
                    ))}
                  </div>
                ) : null}
              </>
            )}

            {/* Quick Links */}
            <div className="mt-12 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-500 p-6 text-white">
              <h3 className="text-xl font-bold mb-2">Ready to Discover Projects?</h3>
              <p className="text-blue-100 mb-4">Find amazing campaigns to support today.</p>
              <div className="flex gap-3">
                <Link href="/discover" className="inline-flex items-center gap-2 rounded-lg bg-white text-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-50">
                  <Search className="h-4 w-4" /> Browse Projects
                </Link>
                <Link href="/creator-handbook" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-medium hover:bg-white/10">
                  <BookOpen className="h-4 w-4" /> Creator Handbook
                </Link>
              </div>
            </div>
          </main>
        </div>
      </div>

      <Footer />
    </div>
  );
}
