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
  { id: 'divinitycoin', label: 'Divinity Payments', icon: Coins },
  { id: 'paypal', label: 'Paying with PayPal', icon: CreditCard },
  { id: 'whop', label: 'Paying with Whop', icon: ShoppingBag },
  { id: 'rewards', label: 'Rewards & Add-ons', icon: Gift },
  { id: 'after', label: 'After You Pledge', icon: Package },
  { id: 'dashboard', label: 'Your Backer Dashboard', icon: LayoutDashboard },
  { id: 'marketplace', label: 'Digital Shop', icon: BookOpen },
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
    description: 'How to discover campaigns and figure out which ones to back.',
    steps: [
      { title: 'Browse the Crowdfunds Page', description: 'Open /crowdfunds. You\'ll see every live campaign, plus tabs for Pre-Launch (projects accepting email signups before they launch) and Recently Funded. Filter by category (Comics, Books, Music, Movies, Games, etc.). Sort by Most Funded, Newest, Ending Soon, or Trending.', tip: 'Ending Soon often shows the most exciting momentum — backers love a last-minute push.' },
      { title: 'Use Search', description: 'Top-right search bar. Type a project title, creator name, or keyword (e.g., "noir comic", "indie rpg"). Results include live, ended, and pre-launch projects.', tip: 'Search for creators you\'ve backed before to see their new work first.' },
      { title: 'Read the Project Page', description: 'Each project has tabs: Story (the pitch, hero video, and full description), Rewards (the tiers you can pledge for), Updates (creator news and behind-the-scenes posts), Comments (questions and discussion with the creator and other backers), Backers (the public list, if backers chose to show up), and FAQ (creator-written Q&A). Check the Risks & Challenges section in the Story tab — honest creators explain potential obstacles upfront.', tip: 'A project with no updates and no FAQ entries is a yellow flag — the creator may not be very engaged yet.' },
      { title: 'Check Updates and Comments', description: 'A project with regular updates from the creator and prompt replies in Comments is one where the creator is paying attention. Both signal that fulfillment is more likely to go smoothly.', tip: 'Read the most recent update first — if it was written months ago on a still-funding project, that\'s a yellow flag too.' },
      { title: 'Follow Before Backing', description: 'Not ready? Click the heart to follow. The project lands in My Projects → Saved in your dashboard. You get notified about updates and the launch date if it\'s pre-launch.', tip: 'Following pre-launch projects gets you the launch email — early-bird tiers usually go fastest in the first 24 hours.' },
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
    alert: { icon: Shield, title: 'Secure Payment Processing', text: 'Campaign payments are processed securely through Divinity Payments, PayPal, or Whop — depending on the creator\'s chosen processor. You can pay with your credit or debit card at checkout regardless of which processor is used. Your card details are encrypted and never stored on our servers.', color: 'emerald' },
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
    title: 'Paying with Divinity Payments',
    description: 'Divinity Payments is an alternative payment processor - pay with your credit or debit card, processed through Divinity Payments\'s secure system.',
    alert: { icon: Coins, title: 'Seamless Card Payment (Not Cryptocurrency)', text: 'Divinity Payments is a payment sub-processor, not a cryptocurrency. Enter your card details at checkout and payment is handled securely through Divinity Payments\'s certified payment system. Supports all content types including NSFW/adult projects.', color: 'amber' },
    steps: [
      { title: 'What is Divinity Payments?', description: 'Divinity Payments is an alternative payment sub-processor used by some creators on IndieCrowdfund. It is NOT a cryptocurrency or wallet system. When a creator uses Divinity Payments, you simply pay with your credit or debit card at checkout.', tip: 'Learn more at our "What is Divinity Payments?" page.' },
      { title: 'How It Works', description: 'At checkout, you\'ll see a secure card payment form. Enter your card details (Visa, Mastercard, Amex, Discover) and complete your pledge. Divinity Payments handles the payment processing behind the scenes.', tip: 'You\'ll see card brand logos (Visa, Mastercard, etc.) confirming accepted card types.' },
      { title: 'Check Which Payment Processor the Project Uses', description: 'Some creators choose Divinity Payments as their payment processor, while others may use Whop. You\'ll see the processor indicator on the project page and at checkout.', tip: 'Creators choose their processor based on their needs - some content types require Divinity Payments or Whop.' },
      { title: 'Secure Payment', description: 'Your card details are entered directly into a PCI-compliant payment form. IndieCrowdfund never sees or stores your card information. The payment is encrypted end-to-end.', tip: 'Look for the lock icon and "Secure Payment" header with card brand logos.' },
      { title: 'Immediate Charge for Funded Projects or Keep It All Campaigns', description: 'For campaigns that have already reached their goal, your card is charged immediately. Keep It All campaigns also charge immediately when you pledge. For All or Nothing campaigns still in progress, charges are held until the campaign funds.', tip: 'You\'ll see clear messaging about when you\'ll be charged before confirming.' },
      { title: 'Refunds', description: 'If a campaign fails or your pledge is refunded, the refund is processed back to your original payment method. For closed campaigns, backers can submit a refund request which the creator must approve.', tip: 'Refund processing times depend on your card issuer, typically 5-10 business days.' },
    ]
  },
  'whop': {
    title: 'Paying with Whop',
    description: 'Whop is a third payment processor option some creators use on IndieCrowdfund. Pay by credit/debit card — Whop handles the processing.',
    alert: { icon: ShoppingBag, title: 'Card Payments via Whop', text: 'Whop is a regulated payment platform that accepts Visa, Mastercard, Amex, and Discover. Like PayPal and Divinity Payments, the creator chooses Whop as their processor and you check out with your card. IndieCrowdfund never sees or stores your card details.', color: 'emerald' },
    steps: [
      { title: 'What is Whop?', description: 'Whop is one of three payment processors a creator can pick on IndieCrowdfund (PayPal, Divinity Payments, Whop). For you as a backer, the experience is the same: enter your card at a secure checkout. There is no Whop account requirement.', tip: 'Look for the "Powered by Whop" indicator on the project page or at checkout to see which processor a creator is using.' },
      { title: 'How to Tell Which Processor a Project Uses', description: 'Each project page and checkout displays the processor it uses. Some content categories (e.g., adult/NSFW or certain digital goods) require Whop or Divinity Payments instead of PayPal.', tip: 'If the processor matters to you (e.g., refund policy, accepted regions), check before pledging.' },
      { title: 'Checkout Flow', description: 'At pledge time, click "Back this project" → choose your reward → continue to checkout → the Whop card form appears. Enter card number, expiration, CVC, and your billing postal code. Click Pledge.', tip: 'Whop\'s form supports Apple Pay and Google Pay where available — look for the wallet buttons above the card form.' },
      { title: 'When You\'re Charged (All-or-Nothing vs Keep-It-All)', description: 'Same rules as the other processors. All-or-Nothing: card authorized at pledge, captured only if the goal is reached. Keep-It-All: charged immediately at pledge time. Already-funded campaigns charge immediately too.', tip: 'The campaign type and timing are shown clearly on the project page before you confirm.' },
      { title: 'Security', description: 'Whop is PCI-DSS compliant. Card data is tokenized at the browser, sent directly to Whop, and never touches IndieCrowdfund servers. The lock icon and "Secure Payment" header on the form confirm this.', tip: 'Never enter card details on a page that doesn\'t show the processor name and a lock icon in the URL bar.' },
      { title: 'Refunds via Whop', description: 'Refunds for failed All-or-Nothing campaigns are automatic — the authorization is released. For other refund cases (creator-approved post-campaign refunds), Whop returns the money to your original card. Bank processing typically takes 5–10 business days.', tip: 'If a refund hasn\'t arrived after 10 business days, contact support with your pledge ID and the date you were notified of the refund.' },
      { title: 'Where Whop Pledges Show Up in Your Dashboard', description: 'Whop pledges appear in My Projects → Backed exactly like PayPal or Divinity Payments pledges. The processor is visible in the pledge details. Receipts are emailed and also accessible from the pledge card.', tip: 'Filter your Analytics tab by source if you want to see how much you\'ve spent through each processor over time.' },
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
    description: 'What happens from confirmation to receiving your rewards — including how to cancel, change your pledge, or ask for a refund.',
    steps: [
      { title: 'Confirmation Email', description: 'Within a few minutes of pledging you\'ll get an email with your full pledge breakdown — reward tier, add-ons, total, payment method, project title. Save it.', tip: 'If you don\'t see the email after 5 minutes, check your spam folder. Add no-reply@indiecrowdfund.com to your contacts.' },
      { title: 'Your Backer Dashboard', description: 'Open /dashboard/backer to see every pledge, manage addresses, track shipment status, complete surveys, and message creators. Bookmark it.', tip: 'The Stats Overview cards at the top of the dashboard pulse when you have something pending — usually a survey to fill out.' },
      { title: 'Changing or Cancelling Your Pledge (before campaign ends)', description: 'While the campaign is still LIVE, open My Projects → Backed → click "Manage Pledge" on the project. You can switch reward tiers, add or remove add-ons, change shipping address, or cancel entirely. Cancellations during a live campaign release any authorization with no charge.', tip: 'Cancel before the campaign ends if you change your mind — once the campaign closes, you\'ll have to use the refund request flow instead.' },
      { title: 'Following Updates', description: 'Creators post Updates from the project page. You\'ll get an email for every update (unless you turned that off in Notifications), and they show up in the Updates panel of the project.', tip: 'Read updates carefully — they often contain calls to action like "complete your survey" or "tell us your preferred edition".' },
      { title: 'Completing Surveys', description: 'After the campaign ends, the creator sends a survey to collect your shipping address, size/color preferences, dedications, and any add-on choices. Open Fulfillment → Surveys in your dashboard, click Complete Survey, fill it out. Most creators charge final amounts (extra add-ons + shipping) shortly after surveys close — make sure your card is still valid.', tip: 'Complete the survey within the first week of receiving it. Creators ship in waves, and late surveys miss the wave.' },
      { title: 'Tracking Fulfillment', description: 'Each pledge card in My Projects → Backed shows your current status: Not Started → In Progress → Shipped → Delivered. When marked Shipped you\'ll usually have a tracking number — click it to see carrier status.', tip: 'If the status says Shipped but you have no tracking number after 48 hours, check the project Updates or message the creator. Sometimes the creator forgot to add the tracking number.' },
      { title: 'Asking for a refund (after the campaign closes)', description: 'If you want a refund after the campaign has closed, open My Projects → Backed → click "Request Refund" on the pledge. Enter the amount (full or partial) and a brief reason. The request goes to the creator, who can approve, deny, or ask for more info. Approved refunds typically clear in 5–10 business days.', tip: 'Communicate with the creator first — many issues (wrong color, missed survey window) are easier to fix than refund.' },
      { title: 'Receiving Your Rewards', description: 'When physical rewards arrive, open the pledge in Backed → tick "Mark as Received". A review dialog opens — rate Overall, Delivery, Quality, and Communication, plus an optional title and review body. Reviews help future backers and tell the creator how they did.', tip: 'Even a 30-second review (just stars and a sentence) is helpful. Long, detailed reviews are even better.' },
    ]
  },
  'dashboard': {
    title: 'Your Backer Dashboard — Walk-Through',
    description: 'A simple guided tour of every tab in your dashboard. Open /dashboard/backer in another window and follow along. Each tab does one job. Here is what each one is for.',
    alert: { icon: LayoutDashboard, title: 'Four Groups of Tabs', text: 'The dashboard has four groups of tabs on the left: My Projects (stuff you backed, saved, or follow), Communication (messages and notifications), Fulfillment (surveys, addresses, downloads, reader), and Insights (your spending). Click any tab to open it. Or type the URL like /dashboard/backer?tab=surveys to jump straight there.', color: 'emerald' },
    sections: [
      {
        heading: 'The Top of the Page',
        description: 'Before you click any tab, the top of /dashboard/backer shows a quick snapshot. Glance at this first.',
        steps: [
          { title: 'The four big number cards', description: 'You see four cards: Projects Backed (how many you\'ve supported, with how many funded), Total Invested (how much you have spent, with the average per project), Successfully Funded (how many of your projects funded and were delivered), and Rewards Pending (how many rewards are still waiting to ship). The Rewards Pending card glows if it has anything in it.', tip: 'A glowing "Rewards Pending" card almost always means you have a survey to fill out. Open the Surveys tab next.' },
          { title: 'The yellow address banner', description: 'If you have no shipping address saved AND you have a physical reward coming, a yellow banner shows up with a button: "Add Shipping Address." Click it. Without an address, creators cannot ship to you.', tip: 'Add your home address right away the first time you pledge.' },
          { title: 'The right-side sidebar', description: 'On the right of the page: a little chart of your spending the last 6 months, a list of up to 5 Upcoming Deliveries (sorted by date), and a Recommended For You list of new projects you might like.', tip: 'Click any Upcoming Delivery card to jump to that pledge in the Backed tab.' },
        ],
      },
      {
        heading: 'Group 1 — My Projects',
        description: 'Everything about projects you have a relationship with: pledged, saved, organized, or following.',
        steps: [
          { title: 'Backed', description: 'Every project you have pledged to. Each card shows the cover image, project title, creator, funding bar, what you pledged, which reward tier you picked, when delivery is expected, and where the order is right now (Not Started → In Progress → Shipped → Delivered). Buttons on each card: View Project, Manage Pledge, Message Creator, and Complete Survey (if one is open). When your package arrives, click "Mark as Received" and a review window pops up.', tip: 'When your reward arrives: open Backed → find the project → click "Mark as Received" → rate it 1-5 stars on Overall, Delivery, Quality, and Communication → click Save. Your review helps future backers and the creator.' },
          { title: 'Saved', description: 'A grid of every project you tapped the heart on. Like a wish list. Each card shows the cover, the funding bar, and how much time is left. Two buttons: "Back this project" (turns it into a pledge) and "Unsave" (removes it from the list).', tip: 'Browsing Crowdfunds and like something but not ready to pay? Click the heart. It lands here. Come back on payday.' },
          { title: 'Collections', description: 'Folders for grouping projects together — like making playlists. Click "+ Create Collection" → type a name like "Tabletop 2026" → pick a color → choose Public or Private. Then on any project page, click "Add to Collection." Edit, delete, or share a collection from its menu.', tip: 'Make a Public collection of your favorite projects and share the link on social media. It actually drives real pledges to creators you love.' },
          { title: 'Following', description: 'Every creator you follow. Each row shows their bio, how many projects they have, how many backers, and their recent work. Toggle notifications on or off per creator (new project launches, updates). Click Unfollow to remove. Below that, an activity feed shows what creators you follow are doing right now.', tip: 'Visit a creator page → click "Follow" → come back to this tab → turn ON "New project notifications." You will get an email the moment they launch — early-bird tiers go fast.' },
        ],
      },
      {
        heading: 'Group 2 — Communication',
        description: 'How you talk to creators, and how the platform talks to you.',
        steps: [
          { title: 'Messages', description: 'Like an email inbox, but for messages with creators. Conversations on the left, the message thread on the right. A red dot in the sidebar means you have unread messages. Click a conversation, read, type a reply, hit Send. Most creators reply faster to backers than to non-backers.', tip: 'Need to fix something about a pledge? Open Messages → find the creator → start your message with the project name and your pledge ID. Example: "Re: Pledge #12345 — need to update my shipping address."' },
          { title: 'Notifications', description: 'Two sets of switches. Global ones: turn email updates on/off, pick how often you get the email digest (daily / weekly / monthly), turn push notifications and marketing emails on/off. Per-project ones: turn updates, comments, surveys, shipping, and messages on/off for each project you backed.', tip: 'Keep shipping notifications ON for every project so you know when packages are coming. Turn marketing OFF if your inbox is overflowing. Switch the global digest to Weekly to cut email volume.' },
        ],
      },
      {
        heading: 'Group 3 — Fulfillment',
        description: 'Everything between "campaign funded" and "thing arrives at your door (or shows up on your hard drive)."',
        steps: [
          { title: 'Surveys', description: 'A list of every creator survey you owe answers on. The top of the tab shows your completion percent and counts (total / done / pending). Pending surveys are listed first. Each survey card shows the project, the creator, your reward, what you pledged, and how many questions are left. If a survey has a deadline, the card shows it clearly — after the deadline, you may not be able to change your address.', tip: 'New pledge funded? Check this tab within a week. Click "Complete Survey" → answer the questions about size, color, and shipping address → submit. If you fill it out late, you might miss the shipping wave.' },
          { title: 'Addresses', description: 'Where you keep your shipping addresses. Click "+ Add Address" → type your full name, street, city, state, ZIP, country, phone → give it a label (Home / Work / Other) → Save. Click the star to set a default address (auto-fills on new pledges). A green check means the address has been validated.', tip: 'Set a default address BEFORE your next pledge. Moving? Add the new address first and set it as default. Only delete the old address after every package using it has actually shipped.' },
          { title: 'Downloads', description: 'The "all my files in one place" page. Two sections. Top: your Digital Shop purchases — cover tiles for anything you bought from the Digital Shop. Bottom: Crowdfunding Files — every PDF, art pack, MP3, ZIP, or other file creators have released to backers, grouped by project. New files have a "New" tag. Click any cover or file to download it.', tip: 'Download files right when they go live. Some creators rotate or expire links later. Keep a backup folder on your computer with a folder per project.' },
          { title: 'Digital Library', description: 'A built-in PDF reader for backed and Digital Shop books. When you click "Read" on a cover in Downloads, it opens here. You can switch between Grid and List view, search, sort (newest / name / how-far-you-read), and filter (all / source / read or unread). The reader has zoom, page turning, bookmarks, full-screen, and auto-saved reading position. Some browsers also let you upload your own PDFs to read alongside.', tip: 'Reading a long book? Use bookmarks to mark cliffhanger pages or art you want to come back to. Your spot saves automatically, so you can pick up where you left off on another device.' },
        ],
      },
      {
        heading: 'Group 4 — Insights',
        description: 'Step back and see how much you have spent and where it went.',
        steps: [
          { title: 'Analytics', description: 'A dashboard of your spending. Total spent split by Physical / Digital / Add-ons / Shipping. A monthly chart for the last 6 months. A category breakdown (Comics, Tabletop, Film, Tech, etc.). A year-over-year chart. Success rate (backed vs funded vs failed). Average delivery time. A time-range filter at the top (all time / 1 year / 6 months / etc.) and an "Export CSV" button to download the raw data.', tip: 'Before the holidays, switch the time range to "6 months" and look at the Category Breakdown. You might find that 60% of your spending went to one category — useful for budgeting next quarter.' },
        ],
      },
      {
        heading: 'Quick URLs',
        description: 'Every tab has its own URL. Bookmark the ones you use most.',
        steps: [
          { title: 'How URLs work', description: 'Add ?tab=<name> to /dashboard/backer to jump to a tab. Valid names: backed, saved, collections, following, messages, notifications, surveys, addresses, downloads, digital-library, analytics. Example: /dashboard/backer?tab=surveys takes you straight to surveys.', tip: 'Bookmark /dashboard/backer?tab=surveys and /dashboard/backer?tab=addresses. Those two tabs are where you spend most of your time during fulfillment.' },
        ],
      },
    ],
  },
  'marketplace': {
    title: 'Digital Shop',
    description: 'A store for finished digital books, comics, and other downloadable content. Different from pledging — when you buy here, you get the file right now.',
    steps: [
      { title: 'What is the Digital Shop?', description: 'A storefront for completed digital works that creators have published — books, comics, art packs, music. Unlike crowdfunding pledges (which can take months to deliver), Digital Shop purchases are delivered instantly to your account.', tip: 'Use the Digital Shop when you want something right now. Use crowdfunding when you want to support a creator making something new.' },
      { title: 'Browsing the store', description: 'Open /shop to see Featured titles, Staff Picks, and the full catalog. Filter by category (Comics, Books, Art, Music) or use the search bar to look up a specific title.', tip: 'Staff Picks are hand-chosen by IndieCrowdfund — usually a great starting point.' },
      { title: 'Understanding pricing', description: 'Each item has a fixed price in US dollars set by the creator. The price you see is the price you pay — no shipping, no extra fees.', tip: 'Digital usually costs less than physical because there\'s no printing or shipping cost.' },
      { title: 'Making a purchase', description: 'Click "Purchase" → enter your card details → confirm. Your card is charged immediately. The processor used (Divinity Payments, PayPal, or Whop) depends on the creator\'s setup, but the experience is the same: a secure card form, then a confirmation page.', tip: 'You\'ll get an email receipt right away, plus an in-app notification.' },
      { title: 'Where your purchase appears', description: 'Digital Shop purchases land in TWO places in your backer dashboard. (1) Downloads tab (/dashboard/backer?tab=downloads) shows them as cover-art tiles alongside any crowdfunding files you\'ve received — this is the easy "all my files in one spot" view. (2) Digital Library tab (/dashboard/backer?tab=digital-library) is the in-browser reader: open a book here to read with bookmarks, zoom, and reading-progress tracking.', tip: 'Use Downloads to see everything. Use Digital Library when you actually want to read.' },
      { title: 'Reading and downloading', description: 'In the Digital Library, click a book cover to open the reader. To save the PDF locally, use the Download button — the file is yours forever, even if the creator removes the title later.', tip: 'Always download a backup copy of anything important. Cloud copies can vanish.' },
    ]
  },
  'faq': {
    title: 'Frequently Asked Questions',
    description: 'Common questions about backing projects.',
    steps: [
      { title: 'What are the two campaign types?', description: '"All or Nothing" campaigns are only funded if the goal is reached — if not, no money changes hands. "Keep It All" campaigns let the creator keep all pledges regardless of the goal, and backers are charged immediately when pledging.', tip: 'The campaign type is shown on the project page before you pledge.' },
      { title: 'What if an All or Nothing project doesn\'t reach its goal?', description: 'No money changes hands. Your payment is never captured, regardless of whether the project uses Divinity Payments, PayPal, or Whop.', tip: 'All-or-nothing funding protects you if the goal isn\'t reached.' },
      { title: 'Can I get a refund after pledging?', description: 'Before campaign ends, cancel anytime in your dashboard. After the campaign closes, you can submit a refund request through the platform — the creator must approve it. Contact the creator directly if needed.', tip: 'Refund policies are set by each creator.' },
      { title: 'Is my payment information secure?', description: 'Yes! PayPal processes standard payments with PCI-DSS Level 1 certification. Divinity Payments and Whop also use PCI-compliant processing — card data is tokenized in your browser and never touches IndieCrowdfund servers.', tip: 'Look for the secure checkout indicator at checkout.' },
      { title: 'What if my card is declined?', description: 'We retry automatically 3 times over 9 days. You\'ll get emails to update your card details.', tip: 'Keep card info updated to avoid failed payments.' },
      { title: 'How do I contact a creator?', description: 'Use "Contact" or "Ask a question" on the project page. Backers often have priority response.', tip: 'Always mention your backer email for pledge-specific issues.' },
      { title: 'What if a creator never delivers?', description: 'Crowdfunding carries risk. Creators are legally obligated to fulfill or refund. Report concerns to our support team.', tip: 'Our verification process helps, but due diligence is important.' },
      { title: 'What happens if I file a chargeback or credit-card dispute?', description: 'File a chargeback or credit-card dispute against IndieCrowdfund or any of our payment processors and your account is permanently banned the moment the dispute is filed, regardless of outcome. You lose every pledge, reward, and digital download tied to that account, and any future accounts under the same email, payment method, IP, or device are also banned. Our ToS makes it explicit: rewards are not guaranteed, you back at your own risk, and a delayed or scaled-back campaign is not grounds for a chargeback.', tip: 'The only carve-outs are actual unauthorized-use fraud (card stolen) and regulator/law-enforcement directives. Everything else is the risk you accepted at checkout. See the full Chargeback Handling Policy at /terms?tab=chargebacks.' },
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
                <Link href="/crowdfunds" className="inline-flex items-center gap-2 rounded-lg bg-white text-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-50">
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
