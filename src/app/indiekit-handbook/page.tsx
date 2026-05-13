'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Box,
  Truck,
  Download,
  TrendingUp,
  Mail,
  BarChart3,
  FormInput,
  ClipboardList,
  Settings,
  UserCircle,
  CheckCircle2,
  ArrowLeft,
  Sparkles,
  ChevronDown,
  ChevronRight,
  CreditCard,
  MapPin,
  Lock,
  Rocket,
  ArrowRight,
  Lightbulb,
  AlertTriangle,
  Search,
  Menu,
  X,
} from 'lucide-react';
import Link from 'next/link';
import { Footer } from "@/components/footer";

// ============================================================================
// Types
// ============================================================================

interface HowToStep {
  step: string;
  detail: string;
}

interface TabContent {
  title: string;
  description: string;
  howTo: HowToStep[];
  tips: string[];
  gotchas?: string[];
}

interface TabItem {
  id: string;
  label: string;
  icon: React.ElementType;
}

interface SectionGroup {
  id: string;
  label: string;
  tabs: TabItem[];
}

// ============================================================================
// Navigation Structure — matches the actual IndieKit dashboard tab layout
// (src/app/dashboard/indiekit/page.tsx ALWAYS_AVAILABLE_TABS +
// PRE_FULFILLMENT_TABS + FULFILLMENT_TABS + POST_FULFILLMENT_TABS).
// ============================================================================

const sections: SectionGroup[] = [
  {
    id: 'getting-started-section',
    label: 'Getting Started',
    tabs: [
      { id: 'welcome', label: 'What is IndieKit?', icon: Sparkles },
      { id: 'first-steps', label: 'First Steps', icon: Rocket },
      { id: 'phases', label: 'The Three Phases', icon: CheckCircle2 },
    ],
  },
  {
    id: 'always-section',
    label: 'Always-Available Tabs',
    tabs: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { id: 'backers', label: 'Backers', icon: Users },
      { id: 'projects', label: 'Projects', icon: FolderKanban },
      { id: 'email-marketing', label: 'Email Marketing', icon: Mail },
      { id: 'updates', label: 'Updates', icon: FileText },
      { id: 'refund-requests', label: 'Refund Requests', icon: CreditCard },
    ],
  },
  {
    id: 'pre-fulfillment-section',
    label: 'Phase 1 — Pre-Fulfillment',
    tabs: [
      { id: 'setup', label: 'Setup', icon: FormInput },
      { id: 'surveys', label: 'Surveys', icon: ClipboardList },
      { id: 'finalize', label: 'Finalize', icon: Lock },
      { id: 'teaser-pages', label: 'Teaser Pages', icon: FileText },
    ],
  },
  {
    id: 'fulfillment-section',
    label: 'Phase 2 — Fulfillment',
    tabs: [
      { id: 'payments', label: 'Payments', icon: CreditCard },
      { id: 'digital-delivery', label: 'Digital Delivery', icon: Download },
      { id: 'physical-delivery', label: 'Physical Delivery', icon: Box },
    ],
  },
  {
    id: 'post-fulfillment-section',
    label: 'Phase 3 — Post-Fulfillment',
    tabs: [
      { id: 'reports', label: 'Reports', icon: BarChart3 },
      { id: 'late-backers', label: 'Late Backers', icon: TrendingUp },
    ],
  },
  {
    id: 'settings-section',
    label: 'Account & Settings',
    tabs: [
      { id: 'settings', label: 'Settings', icon: Settings },
      { id: 'account', label: 'Account', icon: UserCircle },
    ],
  },
];

// ============================================================================
// Content — comprehensive how-to instructions for every feature
// ============================================================================

const tabContent: Record<string, TabContent> = {
  // ---- Getting Started ----
  'welcome': {
    title: 'What is IndieKit?',
    description: 'IndieKit is the toolkit creators use after a campaign funds. Think of it like the back office for your project — surveys, payments, shipping, emails, refunds, reports — all in one place. You only see it after you have a project that has been approved by the IndieCrowdfund admin team.',
    howTo: [
      { step: 'Open IndieKit', detail: 'Log in. In the top-right click your profile picture and pick Dashboard. From the dashboard sidebar click "IndieKit". The URL is /dashboard/indiekit.' },
      { step: 'Pick which project to manage', detail: 'If you have more than one project, use the project dropdown at the top of IndieKit to switch between them. Your last pick is remembered, so the next time you open IndieKit you land on the same project.' },
      { step: 'Look at the navigation on the left', detail: 'IndieKit groups tabs into "phases" — pre-fulfillment, fulfillment, post-fulfillment — plus an always-available row at the top (Dashboard, Backers, Email Marketing, Updates, Refund Requests, Settings, Account, Projects). Phase tabs only light up when you have a project in that phase. The Dashboard tab is your home base.' },
      { step: 'Read the "What\'s Next" banner', detail: 'On the Dashboard tab, the very top shows a "What\'s Next" banner that points you to the most important thing to do right now. Click the action button and IndieKit jumps to the right tab.' },
    ],
    tips: [
      'Bookmark /dashboard/indiekit so you can jump in without clicking through the dashboard.',
      'Always start each session on the Dashboard tab — it tells you the one thing to do next.',
      'If a tab looks greyed out or hidden, your project is not in that phase yet. Finish the current phase first.',
    ],
  },
  'first-steps': {
    title: 'First Steps After Your Campaign Funds',
    description: 'Your campaign just hit its goal — congratulations. Here is exactly what to do, in order, the first time you open IndieKit.',
    howTo: [
      { step: '1. Open Dashboard', detail: 'Read the "What\'s Next" banner. It will point you to the most urgent next action — usually building or sending a survey.' },
      { step: '2. Build your survey (Setup → Surveys)', detail: 'Open the Surveys tab in the Pre-Fulfillment row. Add the questions you need: shipping address, T-shirt size, color preference, dedication, etc. Drag-and-drop to reorder. Click Save when done.' },
      { step: '3. Add post-campaign add-ons (optional, in Setup)', detail: 'Want to sell extras after the campaign — second copy, sticker pack, upgrade tier? Use the Setup tab to define add-on items. Backers can buy them when they fill out their survey.' },
      { step: '4. Send the survey', detail: 'Once the questions look right, click "Send Survey" inside the Surveys tab. Backers get an email with a link. Watch the completion percentage on the same tab.' },
      { step: '5. Wait for completions, send reminders', detail: 'Aim for 90%+ survey completion. Use Email Marketing to send a "you haven\'t finished your survey" reminder to backers tagged "Incomplete Survey".' },
      { step: '6. Move to Finalize', detail: 'When most backers have responded, open the Finalize tab. This is where you lock orders (no more changes), charge any extra amounts owed (add-ons, shipping), and lock shipping addresses.' },
      { step: '7. Switch to Fulfillment', detail: 'Once Finalize is done, the Fulfillment phase tabs (Payments, Digital Delivery, Physical Delivery) become your daily home. Charge cards, deliver digital files, ship boxes.' },
    ],
    tips: [
      'Do steps 2 and 3 BEFORE sending the survey so backers see all the add-ons in one go.',
      'Send the first survey email within a week of funding while excitement is still high.',
      'A 90%+ completion rate is normal and worth chasing — un-surveyed backers can stall fulfillment for months.',
    ],
  },
  'phases': {
    title: 'The Three Phases of Fulfillment',
    description: 'IndieKit splits your post-funding work into three phases. Tabs from each phase only show up in the navigation when your project is actually in that phase. This keeps the screen tidy and tells you what to focus on.',
    howTo: [
      { step: 'Phase 1 — Pre-Fulfillment', detail: 'Tabs: Setup, Surveys, Finalize, Teaser Pages. This is where you build and send your backer survey, define add-ons, lock orders, charge final amounts, and lock addresses. Goal: every backer has answered the survey and paid any extra owed.' },
      { step: 'Phase 2 — Fulfillment', detail: 'Tabs: Payments, Digital Delivery, Physical Delivery. This is where you actually charge cards, deliver digital files, and ship physical packages. Goal: every backer is marked Delivered.' },
      { step: 'Phase 3 — Post-Fulfillment', detail: 'Tabs: Reports, Late Backers. After most backers are Delivered, you wrap up. Reports gives you the full breakdown of revenue, costs, and refunds. Late Backers lets you keep selling to people who missed the campaign.' },
      { step: 'Always-available tabs', detail: 'These never go away regardless of phase: Dashboard (home base), Backers (the searchable list of everyone who pledged), Projects (switch projects), Email Marketing (campaigns to your subscriber list and backers), Updates (project updates that go to backers and the public project page), Refund Requests (handle backer refund requests), Settings, and Account.' },
    ],
    tips: [
      'You can do work in earlier phases at any time — adding a late backer in Phase 3 still creates a survey to send.',
      'The Dashboard tab\'s "What\'s Next" banner always knows which phase you\'re in.',
      'Don\'t skip Phase 1\'s Finalize step. Locking orders and addresses is what makes Phase 2 safe to run.',
    ],
  },

  // ---- Always-Available Tabs ----
  'dashboard': {
    title: 'Dashboard Tab',
    description: 'The home page of IndieKit. Tells you the most urgent thing to do, shows headline numbers, and surfaces recent activity. Start here every session.',
    howTo: [
      { step: 'Read the "What\'s Next" banner at the top', detail: 'The banner is dynamic — it points to whichever next action matters most based on your current phase and progress. Examples: "Send your survey", "12 backers have errored payments — review them", "Start shipping", "Run final reports".' },
      { step: 'Look at the Key Metrics row', detail: 'Four big number cards: Total Backers (campaign + late backers + add-ons), Surveys Completed % (target 90%+), Add-ons Purchased % (how many backers bought extras), and Fulfilled % (orders marked shipped/delivered).' },
      { step: 'Check the Fulfillment Pipeline', detail: 'A horizontal flow showing how many orders are in each state: Not Pushed, Push Errored, Pushed, Shipped. Aim to move every order to Shipped before closing the project.' },
      { step: 'Review Charge Status', detail: 'Breakdown of payment states: Not Charged, Charge Errored, Charged, PayPal Collected. Errored charges need attention — usually expired cards.' },
      { step: 'Scan recent activity', detail: 'The bottom of the Dashboard shows the last 5–10 events: surveys completed, charges processed, packages shipped. The full history lives in the Reports tab.' },
    ],
    tips: [
      'Make checking the Dashboard a daily habit during active fulfillment.',
      'When the "What\'s Next" banner says "All caught up!" you\'re ahead of schedule.',
      'A high "Charge Errored" number is the #1 cause of fulfillment delay — clear those first.',
    ],
  },
  'backers': {
    title: 'Backers Tab',
    description: 'The full list of everyone who pledged to your project, plus late-backer add-on buyers. Every action on a single backer happens here — view their reward, see their address, message them, lock their order, charge their card, mark shipped.',
    howTo: [
      { step: 'Search and filter', detail: 'Top of the tab: search by email, name, or pledge ID. Filter pills cover status (All / Survey Pending / Survey Complete / Charged / Shipped / Delivered / Refunded / Cancelled), reward tier, country, add-on, and SKU. Combine filters by clicking multiple pills.' },
      { step: 'Sort the list', detail: 'Click any column header to sort: pledge date, amount, name, status. Click again to reverse.' },
      { step: 'Click a backer to open the detail dialog', detail: 'See everything: pledge info, reward + add-ons, shipping address, payment status, survey responses, message history, fulfillment notes.' },
      { step: 'Take bulk actions on selected backers', detail: 'Tick the checkboxes on multiple rows then click an action button: Send Survey Reminder, Lock Orders, Lock Addresses, Charge Cards, Mark as Shipped, Push to Fulfillment, Export. Bulk actions show a confirmation preview before running.' },
      { step: 'Add a manual backer', detail: 'For one-off late additions (someone who paid you outside the platform), click "+ Add Backer" and fill in their email, reward tier, address, and amount. They get a survey and show up in the list like any other backer.' },
      { step: 'Push selected orders to fulfillment', detail: 'After Phase 1\'s Finalize step, click rows then "Push to Fulfillment" to send them to your connected fulfillment service (Shopify, ShipStation, etc.). The Physical Delivery tab handles the integration setup.' },
    ],
    tips: [
      'Filter by "Survey Pending" then bulk-send a reminder — fastest way to chase the last 10% of completions.',
      'When a backer messages you about their order, search their email here and pull up everything you need before replying.',
      'Adding a manual backer creates a real fulfillment row — they get the same survey, charges, and shipping notifications as campaign backers.',
    ],
    gotchas: [
      'Bulk "Charge Cards" can\'t un-do itself. Use the preview screen to verify the total before confirming.',
      'Pushing to fulfillment before SKU mapping is set up causes errors — visit Settings to map SKUs first.',
    ],
  },
  'projects': {
    title: 'Projects Tab',
    description: 'A list of every project on your account. Use it to switch between projects without leaving IndieKit, or to see the high-level status of each one at a glance.',
    howTo: [
      { step: 'See all your projects', detail: 'Each row shows the project image, title, current phase, total backers, total raised, and a quick-action menu (Open, Edit, View Public Page).' },
      { step: 'Switch the active project', detail: 'Click "Open" on any row. IndieKit reloads with that project as the active one. The change applies to every other tab too.' },
      { step: 'Edit a project', detail: 'Click "Edit" to jump back to the project builder (/projects/<id>/edit). Useful for fixing a typo on the project page or updating risk language mid-campaign.' },
      { step: 'View the public page', detail: 'Click "View Public Page" to see how backers see your project right now.' },
    ],
    tips: [
      'If you run multiple campaigns at once, this is the tab you\'ll bounce off most.',
      'Project edits are limited after launch — title and reward tiers are locked, but story / FAQ / risks can still be tweaked.',
    ],
  },
  'email-marketing': {
    title: 'Email Marketing Tab',
    description: 'Where you compose, schedule, and send email campaigns to your subscriber list and your backers. Drag-and-drop builder, segment targeting, scheduling, open/click tracking. Each creator gets their own creator email handle (e.g. yourname@indiecrowdfund.com) so emails come from your brand, not from IndieCrowdfund directly.',
    howTo: [
      { step: 'Set up your creator email handle', detail: 'First time only: visit Settings → Creator Email and pick a handle. This becomes your sender address (yourhandle@indiecrowdfund.com). Without this, you can\'t send campaign emails.' },
      { step: 'Pick a template or start blank', detail: 'On the Email Marketing tab, click "Start a Draft" to open the email dialog. Pre-built templates: launch announcement, pre-launch reminder, 48 hours to launch, post-funding thanks, survey reminder, and others. Or start from a blank email.' },
      { step: 'Compose in the rich-text editor', detail: 'Headings, paragraphs, bold/italic, links, images (upload directly or paste a URL), bullet/numbered lists, alignment. The editor outputs clean inline-styled HTML so emails render correctly across mail clients.' },
      { step: 'Personalize with variables', detail: 'Use {{FIRST_NAME}}, {{PROJECT_NAME}}, {{CREATOR_NAME}}, {{PROJECT_URL}} in your subject and body — they\'re replaced with real values per recipient when the email sends.' },
      { step: 'Choose recipients', detail: 'Audience picker: All subscribers, Backers only, Pre-launch sign-ups, or a saved Segment (e.g., "International backers", "Tier-2 only"). Segments are also saved on this tab.' },
      { step: 'Send a test email', detail: 'Always send a test to yourself first — click "Send Test", enter your email, hit Send. Check formatting, links, and personalization variables on a real client (Gmail, Apple Mail, Outlook).' },
      { step: 'Send now, or schedule', detail: 'Send Now goes out at queue speed (typically a few hundred per minute). Schedule For lets you pick a future date/time — IndieKit will send automatically when that time comes.' },
      { step: 'Watch the results', detail: 'After send, the campaign card shows: sent count, delivered, opened (open-rate %), clicked (click-rate %), unsubscribed, bounced. Click the campaign for a deeper drill-down.' },
    ],
    tips: [
      'Always send a test to yourself before broadcasting — small typos and broken images become very visible at scale.',
      'Best send times: Tuesday/Wednesday/Thursday between 10am and 2pm in your audience\'s timezone.',
      'Avoid sending more than once a week to the same audience or you\'ll burn the list.',
      'Use saved Segments instead of re-filtering every time — saves clicks and keeps targeting consistent across campaigns.',
    ],
    gotchas: [
      'If your creator email handle is not set up, sends will fail with a "Set up your creator email" error.',
      'Bounced emails are automatically marked unsubscribed — they won\'t get future sends from your handle.',
      'Schedules are in your account timezone, not the recipient\'s.',
    ],
  },
  'updates': {
    title: 'Updates Tab',
    description: 'Project updates that publish to the public project page AND email to backers. Use these to share progress, photos, milestones, delays, anything that interests backers and the broader audience. Updates show up on the project\'s Updates tab and create push notifications.',
    howTo: [
      { step: 'Click "+ New Update"', detail: 'Opens the update editor. Required fields: title, body. Optional: feature image, visibility (Public / Backers Only).' },
      { step: 'Write the body in the rich-text editor', detail: 'Headings, images, links, lists. Same editor as Email Marketing — outputs clean inline-styled HTML.' },
      { step: 'Pick visibility', detail: 'Public updates show on the project page for anyone (logged-in or not) and email all backers. Backers Only updates only email backers and only show on the project page when a backer is logged in. Use Backers Only for survey reminders, address requests, or anything not for public eyes.' },
      { step: 'Publish or save draft', detail: 'Save Draft keeps the update in the list but does not send. Publish triggers the email + adds it to the project page. Once published, the email cannot be unsent.' },
      { step: 'See engagement', detail: 'Each published update shows: views, comments, email open count, click count.' },
    ],
    tips: [
      'Post 1–2 updates per week during active campaign, 1–2 per month during fulfillment.',
      'Updates with photos or video get 3x the engagement of text-only.',
      'When something delays your timeline, post an update IMMEDIATELY. Backers forgive honesty; they don\'t forgive silence.',
    ],
  },
  'refund-requests': {
    title: 'Refund Requests Tab',
    description: 'Where you review and act on backer refund requests. Backers can submit a refund request from their backer dashboard at any time after the campaign ends. You decide whether to approve.',
    howTo: [
      { step: 'See the queue', detail: 'Each request shows: backer name + email, pledge amount, requested refund amount (full or partial), reason the backer wrote, the date submitted, and an approve / deny / message button.' },
      { step: 'Review the request', detail: 'Click the row to expand. You see the full pledge history, original payment method, processor, and any prior messages with this backer.' },
      { step: 'Approve, deny, or ask for more info', detail: 'Approve refunds the requested amount through the original processor (PayPal, DivinityCoin, Whop). Deny closes the request with an optional reason. "Message" opens an inbox thread to ask the backer questions before deciding.' },
      { step: 'Track the refund status', detail: 'Approved refunds move to a "Processing" state until the processor confirms. Most processors complete in 5–10 business days. The request card shows the actual refund timestamp once done.' },
    ],
    tips: [
      'Reply to refund requests within 48 hours — silent denial damages backer trust more than the refund itself.',
      'Partial refunds are possible if the backer only wants part of the order back (e.g., kept the digital but returned the physical).',
      'A high refund rate (>5%) is a signal that fulfillment communication is missing the mark — review your update cadence.',
    ],
    gotchas: [
      'Refunds via DivinityCoin / PayPal / Whop go through their dispute infrastructure — read each processor\'s refund window before approving an old pledge.',
      'Refund requests are independent of chargebacks — if a backer files a chargeback with their bank, that flows through your Refund Requests too but with a "Chargeback" tag.',
    ],
  },

  // ---- Phase 1: Pre-Fulfillment ----
  'setup': {
    title: 'Setup Tab (Pre-Fulfillment)',
    description: 'Your one-time configuration before you can send surveys: define the post-campaign add-ons backers can buy, set shipping zones and rates, and connect your fulfillment service if you ship physical goods.',
    howTo: [
      { step: 'Define your add-ons', detail: 'Click "+ Add Add-on" to create extras backers can buy in the survey: extra copy, accessory, upgrade tier, sticker pack, etc. Each has a name, price (USD), description, optional image, and inventory limit (or unlimited).' },
      { step: 'Configure shipping zones', detail: 'Set up regions you ship to (Domestic, Canada, EU, UK, ROW) with a base rate per zone and an optional per-extra-item rate. Backers see this calculated in their survey based on their address.' },
      { step: 'Connect a fulfillment service', detail: 'If you ship physical goods through a service, link it here: Shopify, ShipStation, Shippo, or EasyPost. The integration uses an API key you create in that service\'s admin. Once linked, you can push orders directly from the Backers tab.' },
      { step: 'Map reward + add-on SKUs', detail: 'Inside Setup → SKU Mapping: tell IndieKit what SKU each reward tier and add-on corresponds to in your fulfillment service. Required before pushing orders or you\'ll get errors.' },
    ],
    tips: [
      'Test the shipping calculator after setting zones — pledge a $0 order to yourself and verify the totals.',
      'Define every add-on BEFORE sending the survey. Adding new add-ons after the fact means re-emailing backers to update their orders.',
      'Use round-number prices ($5, $10, $20) for add-ons — backers buy more when math is easy.',
    ],
    gotchas: [
      'Pushing to fulfillment without SKU mapping fails with "SKU not found" errors. Map first.',
      'Changing shipping rates after the survey is sent doesn\'t retroactively update existing responses — only new responses use the new rates.',
    ],
  },
  'surveys': {
    title: 'Surveys Tab (Pre-Fulfillment)',
    description: 'Build, send, and manage backer surveys. Surveys collect shipping addresses, reward customizations (size, color, etc.), and a chance for backers to buy your add-ons. Most projects send one survey per fulfillment cycle.',
    howTo: [
      { step: 'Build the survey', detail: 'Drag-and-drop builder. Standard blocks: shipping address, single-select question, multi-select question, free-text, item-variant question (size/color per reward tier). Mark each block required or optional.' },
      { step: 'Add item-variant questions', detail: 'For each reward tier that has variants — e.g., a t-shirt tier with sizes — add an Item Variant block. Pick the reward tier it applies to, the variant type (Size, Color), and the options (S/M/L/XL). Backers see the right variant question for their tier automatically.' },
      { step: 'Add intro + outro text', detail: 'Optional but recommended. Intro: thank backers, explain what you\'ll do with their info, set the address-lock deadline. Outro: tell them what happens next.' },
      { step: 'Preview', detail: 'Click "Preview" to see the survey exactly as a backer will. Test required fields by trying to submit empty.' },
      { step: 'Send the survey', detail: 'Click "Send Survey". Backers get a personalized email with their pre-filled order and a link to complete the survey. The link is unique per backer — no login required.' },
      { step: 'Monitor responses', detail: 'The Surveys tab shows live counts: Sent, Started, Completed, Pending. Click "Send Reminder" to email un-completed backers. Aim for 90%+ before moving to Finalize.' },
      { step: 'Lock the survey', detail: 'When responses are in, click "Lock Survey" inside the Finalize tab. Backers can no longer modify answers. This is the gate to Phase 2.' },
    ],
    tips: [
      'Keep the survey short — 5–8 questions max. Long surveys hurt completion rates.',
      'Always include a free-text "Anything else?" question. Backers love having a chance to talk to you.',
      'Send the first survey within a week of funding while excitement is high.',
    ],
    gotchas: [
      'Once a survey is locked, opening it again to add a question creates a new survey send — you\'ll re-email everyone. Avoid by getting the questions right the first time.',
      'Item-variant questions only show for backers whose reward tier matches. Test the preview with each tier in mind.',
    ],
  },
  'finalize': {
    title: 'Finalize Tab (Pre-Fulfillment)',
    description: 'The gate between Pre-Fulfillment and Fulfillment. This tab walks you through the irreversible steps that make Phase 2 safe: lock orders, charge final amounts owed (add-ons + shipping), and lock shipping addresses. Don\'t open it until 90%+ of backers have completed their survey.',
    howTo: [
      { step: 'Step 1 — Lock Orders', detail: 'Click "Lock Orders". This freezes everyone\'s reward + add-on + variant selections. Backers cannot change tier or add-ons after this. Run only after surveys hit 90%+ completion.' },
      { step: 'Step 2 — Preview Charges', detail: 'Click "Preview Charges". IndieKit shows you a list of every backer who owes more (add-ons + shipping above what was pledged) along with the amount. Review the totals carefully.' },
      { step: 'Step 3 — Charge Cards', detail: 'Click "Charge Cards" to run the charges. Cards on file (saved during the original pledge for AoN, or a new payment method captured in survey) get charged in batch. Errored charges (expired cards, declined) move to "Charge Errored" status — handle from the Backers tab.' },
      { step: 'Step 4 — Lock Addresses', detail: 'Click "Lock Addresses" to freeze shipping addresses. Backers can no longer change their shipping address from the survey link. Recommended: send a "last chance to update" email via Email Marketing 24–48 hours before locking.' },
    ],
    tips: [
      'Send a heads-up email before each lock step. Backers understand "last chance" but resent surprise locks.',
      'Charge errors are normal — typically 5–10% of cards expire between pledge time and final charge. Work them down before opening Phase 2.',
      'If a card errors, you can re-attempt charge from the Backers tab after the backer updates their card.',
    ],
    gotchas: [
      'Locking orders is irreversible without a manual unlock from support. Make sure surveys are complete first.',
      'Charging before all surveys are in means missing add-ons and shipping for the un-surveyed backers — you\'ll have to chase them later.',
    ],
  },
  'teaser-pages': {
    title: 'Teaser Pages Tab (Pre-Fulfillment)',
    description: 'Public landing pages for projects that haven\'t launched yet. Use them to collect email signups before the campaign goes live so you have an audience ready at launch. Each project has one teaser page; URL is /projects/<vanity>/<slug>/prelaunch.',
    howTo: [
      { step: 'Enable the teaser', detail: 'Toggle "Active" on the Teaser Pages tab. The teaser becomes live at the prelaunch URL. Visitors see your pitch, video, hero image, and an email signup form.' },
      { step: 'Customize the teaser content', detail: 'Headline, sub-headline, hero image, video URL (YouTube/Vimeo), bullet list of what backers will get, and a "what happens next" section. All optional but the more you fill in, the better the page converts.' },
      { step: 'Choose what subscribers get on launch', detail: 'You can promise an early-bird discount, exclusive reward tier, or just the launch notification email. Whatever you promise, deliver it.' },
      { step: 'Track signups', detail: 'The tab shows total signups, daily growth chart, and a downloadable CSV of email addresses. Signups also appear in your Email List so you can include them in pre-launch emails.' },
      { step: 'Launch the campaign', detail: 'When you\'re ready, switch the project from PRELAUNCH to LIVE. Subscribers automatically get a "We\'re live" email with the project link — sent through the Email Marketing pipeline.' },
    ],
    tips: [
      'Teaser pages convert 5–10x better with a video than without. Even a 30-second phone selfie works.',
      'Promise something specific at launch — "First 100 to back get a free signed bookplate" — vague promises don\'t drive signups.',
      'Run the teaser for 2–4 weeks before launching. Less than a week and you don\'t have time to build an audience; more than 6 weeks and momentum dies.',
    ],
  },

  // ---- Phase 2: Fulfillment ----
  'payments': {
    title: 'Payments Tab (Fulfillment)',
    description: 'The control center for charging cards on file — both the post-survey final charges and any extra after-the-fact charges (a backer adds another item, shipping needs adjusting, etc.). Also where you handle PayPal capture for PayPal-processor projects.',
    howTo: [
      { step: 'See pending charges', detail: 'List of every backer with money owed: add-on overage, shipping balance, manual extra charge. Each row shows the amount, what it\'s for, and the card on file.' },
      { step: 'Run a single charge', detail: 'Click a row → click "Charge Now". Result is shown immediately: success or error code (declined, expired, insufficient funds, do-not-honor).' },
      { step: 'Bulk charge', detail: 'Tick rows then "Charge Selected". IndieKit runs them in order with a small delay between each so the processor doesn\'t flag the batch as suspicious.' },
      { step: 'Retry errored charges', detail: 'Errored charges show a clear reason. For expired cards, message the backer to update payment. Once they update, click "Retry" to charge again.' },
      { step: 'Add a manual charge', detail: 'Click "+ New Charge" to charge a backer for something outside the standard flow — extra postage, gift card, late add-on. Enter amount and reason. Charges the card on file.' },
      { step: 'Capture PayPal authorizations', detail: 'For PayPal-processor projects with deferred capture, the Payments tab also shows pending captures. Click "Capture" once you\'re ready to ship.' },
    ],
    tips: [
      'Run charges in waves of 100–200 at a time during business hours when the processor\'s fraud team is responsive.',
      'A "do not honor" decline usually means the bank flagged the transaction — message the backer to call their bank or use a different card.',
      'PayPal authorizations expire after 29 days — capture before then or you\'ll need to re-authorize.',
    ],
    gotchas: [
      'You cannot charge a card that\'s been refunded or charged-back. The row will be locked.',
      'Manual charges still go through the processor\'s normal settlement window — they don\'t pay out instantly.',
    ],
  },
  'digital-delivery': {
    title: 'Digital Delivery Tab (Fulfillment)',
    description: 'Upload digital reward files (PDFs, music, video, art packs) and assign them to reward tiers. When you mark them released, every eligible backer is notified by email and the files appear in their Downloads tab.',
    howTo: [
      { step: 'Upload a file', detail: 'Click "+ Upload File". Pick a file (PDF, MP3, MP4, ZIP, etc.). The file is stored in encrypted object storage. Add a name, description, and optional cover image.' },
      { step: 'Assign to reward tiers', detail: 'On the file row, click "Assign". Tick which reward tiers should receive this file. A backer at any of the ticked tiers gets access. You can assign one file to multiple tiers.' },
      { step: 'Release to backers', detail: 'When you\'re ready to deliver, click "Release". Backers are emailed with a notification ("Your digital rewards are ready"). The files show up in their Downloads tab at /dashboard/backer?tab=downloads.' },
      { step: 'Track downloads', detail: 'Each file shows download count, latest download timestamp, and a list of which backers have downloaded vs not. Useful for follow-up.' },
      { step: 'Update a file (re-release)', detail: 'Replace the underlying file by clicking "Update". Backers who already downloaded keep their old version; new downloads get the updated file. Optional: notify everyone of the update.' },
    ],
    tips: [
      'Digital reward delivery is the cheapest, fastest way to keep backers happy mid-fulfillment. Even a "behind-the-scenes PDF" delivered while physical goods are still in production helps.',
      'Watermark PDFs with the backer\'s email if you\'re worried about leaks — IndieKit doesn\'t do this automatically but most PDF tools support it.',
      'Don\'t release digital rewards until at least 90% of surveys are complete; otherwise late survey takers won\'t auto-receive the files.',
    ],
    gotchas: [
      'Files larger than 2 GB may fail to upload from the browser. Use a smaller compressed version or split the file.',
      'Once released, a file cannot be unreleased — you can only delete it, which removes it from backers\' libraries too.',
    ],
  },
  'physical-delivery': {
    title: 'Physical Delivery Tab (Fulfillment)',
    description: 'Push physical orders to your fulfillment service, monitor shipments, add tracking numbers, mark orders shipped or delivered. The integration was set up in the Setup tab; here\'s where you actually use it.',
    howTo: [
      { step: 'Push selected orders', detail: 'After Phase 1 Finalize, you have a queue of orders ready to ship. Tick orders → click "Push to Fulfillment". They go to your connected service (Shopify / ShipStation / Shippo / EasyPost) as new orders to print labels for.' },
      { step: 'Handle push errors', detail: 'Some orders may fail to push — usually missing SKU mapping or invalid address. The Physical Delivery tab shows them with the error reason. Fix the underlying issue (Settings → SKU Mapping for SKU errors, Backers tab for address errors), then re-push.' },
      { step: 'Add tracking numbers', detail: 'When your fulfillment service ships an order, it sends back a tracking number. IndieKit auto-syncs these for connected services. For unconnected services or hand-shipped orders, click an order and paste the tracking number manually.' },
      { step: 'Mark as shipped / delivered', detail: 'Connected services auto-mark orders as Shipped when the carrier scans them. For manual fulfillment, click "Mark Shipped" yourself. Backers automatically receive the tracking notification email.' },
      { step: 'Bulk export shipping list', detail: 'Click "Export CSV" to download all addresses for a batch — useful for label printers, customs forms, or hand-fulfillment.' },
    ],
    tips: [
      'Test with a small batch (5–10 orders) when first pushing to fulfillment. Check that addresses, SKUs, and tracking flow correctly before pushing all 1,000.',
      'Carriers (USPS, UPS, FedEx) sometimes scan late — a "Shipped" order might not show "In Transit" tracking for 24–48 hours. Don\'t panic.',
      'For international shipments, double-check customs declarations. Some services autofill incorrectly.',
    ],
    gotchas: [
      'A push error on one order doesn\'t block the rest of the batch from pushing — they\'re processed independently.',
      'Marking an order as Delivered does NOT trigger another email; only Shipped does. Delivery notifications come from the carrier directly.',
    ],
  },

  // ---- Phase 3: Post-Fulfillment ----
  'reports': {
    title: 'Reports Tab (Post-Fulfillment)',
    description: 'The full breakdown of everything that happened during fulfillment: revenue, refunds, fees, ship vs. unship rates, payment processor cuts, and the bottom-line "what did I actually clear" number. Use this for accounting and for planning your next campaign.',
    howTo: [
      { step: 'Read the headline numbers', detail: 'Top of the page: Total Revenue (campaign + add-ons + late backers), Processing Fees (split per processor), Platform Fees, Refunds Issued, and Net Payout (what actually hit your bank).' },
      { step: 'Filter by date range', detail: 'Default is the entire fulfillment cycle. Use the date range picker to look at just a quarter or just one month — useful for tax reporting.' },
      { step: 'Per-tier and per-add-on breakdown', detail: 'Sales by reward tier and by add-on. Shows: units sold, revenue, average order value. Spot which add-ons converted best for next campaign\'s pricing.' },
      { step: 'Fulfillment metrics', detail: 'Survey response rate, charge success rate, ship rate, refund rate. Each compared to the platform median so you know if your numbers are normal.' },
      { step: 'Export for accounting', detail: 'Click "Export Full Report" → CSV containing every transaction, refund, and fee. Hand to your bookkeeper or import into Quickbooks/Xero.' },
    ],
    tips: [
      'A 95%+ ship rate is excellent. 90% is normal. Below 85% means you have backers stuck in some failed state — go check the Backers tab.',
      'Compare reports across multiple campaigns to learn which add-ons actually moved the needle for you.',
    ],
  },
  'late-backers': {
    title: 'Late Backers Tab (Post-Fulfillment)',
    description: 'After the campaign ends, the project page can stay open as a "late pledge" or "pre-order" funnel. Late backers pay full price (no early-bird discounts, usually a small premium), get the same survey, and ship in the next fulfillment wave or solo.',
    howTo: [
      { step: 'Enable late pledges', detail: 'Toggle "Accept Late Backers" on. Visitors to the project page now see "Pledge as Late Backer" instead of a closed campaign. You can also set an end date if you want to close it eventually.' },
      { step: 'Set late-pledge pricing', detail: 'Either keep tier prices identical to campaign, or add a per-tier markup (10–25% is common — late backers pay more because they didn\'t take the early-bird risk).' },
      { step: 'Decide on shipping wave', detail: 'Late backers can either ship in the same batch as campaign backers (if you haven\'t shipped yet) or in a separate wave (if you have). Choose on the Late Backers tab.' },
      { step: 'Promote', detail: 'Use Email Marketing to email your subscriber list, post a "still available" update, share on social. Late pledge revenue often equals 10–30% of campaign revenue.' },
      { step: 'Manage like campaign backers', detail: 'Late backers show up in the Backers tab tagged "Late". Same survey, same charge flow, same shipping. The Reports tab breaks them out separately.' },
    ],
    tips: [
      'Late pledge windows of 30–60 days after fulfillment are typical. After that, interest dies.',
      'Even a 10% markup tells campaign backers their early commitment was rewarded — they\'ll appreciate it for next time.',
      'Don\'t open late pledges until you\'re sure you can fulfill them. Two waves of fulfillment is doable; three is exhausting.',
    ],
    gotchas: [
      'Late backers don\'t get stretch goal rewards unless you explicitly include them in the late-pledge tiers.',
      'If you ship late backers separately, make sure your Reports tab cost calculations include the second-wave shipping cost — it can eat into margin.',
    ],
  },

  // ---- Account & Settings ----
  'settings': {
    title: 'Settings Tab',
    description: 'Project-level configuration that persists across phases: payment processor account, payout bank, chargeback protection card, fulfillment integrations, SKU mapping, creator email handle, notification preferences.',
    howTo: [
      { step: 'Payments section', detail: 'Verify your payment processor is connected and your payout bank account is on file. Without these, fulfillment charges will fail.' },
      { step: 'Creator Email section', detail: 'Set your creator email handle (yourname@indiecrowdfund.com). All Email Marketing campaigns and Inbox replies send from this address. Configure sender display name + reply-to here too.' },
      { step: 'Fulfillment integrations', detail: 'Connect or re-authorize Shopify, ShipStation, Shippo, EasyPost. Each takes an API key from the service\'s admin. Once connected, the Backers tab can push orders directly.' },
      { step: 'SKU mapping', detail: 'For each reward tier and add-on, tell IndieKit what SKU it corresponds to in your fulfillment service. Required before any push. Use the bulk-edit if you have many tiers.' },
      { step: 'Notification preferences', detail: 'Toggle email notifications: refund requests, daily summary, chargeback alerts, payment failures. Default settings are sensible — only change if you\'re drowning in email.' },
    ],
    tips: [
      'Re-check Settings before each Phase 1 → Phase 2 transition. A missing chargeback card or stale Shopify token will block fulfillment.',
      'Use the same SKU naming convention across all your campaigns — saves time mapping next time.',
    ],
  },
  'account': {
    title: 'Account Tab',
    description: 'Your personal account settings — separate from Settings (which is per-project). Profile picture, vanity URL, password, two-factor, sessions, account deletion.',
    howTo: [
      { step: 'Update your profile', detail: 'Display name, bio, avatar, social links. These show on your creator profile page and on every project page you create.' },
      { step: 'Set or change your vanity URL', detail: 'Pick a unique URL slug — e.g., "yourname" makes your profile /yourname and your projects /projects/yourname/<slug>. Once set, can be changed but it breaks any old links.' },
      { step: 'Change password', detail: 'Standard password change — old password + new password twice. Strong passwords required.' },
      { step: 'Enable two-factor authentication (2FA)', detail: 'Highly recommended for accounts that handle payouts. Pick TOTP (Google Authenticator, Authy, 1Password) or SMS. Once enabled, every login asks for the code.' },
      { step: 'Manage active sessions', detail: 'See every device currently logged into your account. Revoke any you don\'t recognize. Useful after a stolen laptop or shared computer.' },
      { step: 'Delete account', detail: 'Last resort — irreversible. Schedules a 30-day deletion of your data. Active campaigns must be wrapped up first.' },
    ],
    tips: [
      'Turn on 2FA today. It\'s a 30-second setup and stops the most common account takeover vectors.',
      'Use a unique vanity URL across IndieCrowdfund + your other social platforms. Discoverability compounds.',
      'Vanity URL changes break old shared links — bookmarks, email signatures, etc. Set it once and leave it.',
    ],
  },
};

// ============================================================================
// Components
// ============================================================================

function HowToCard({ howTo }: { howTo: HowToStep }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <ArrowRight className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
        <div>
          <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{howTo.step}</h4>
          <p className="mt-1 text-sm text-zinc-600 dark:text-muted-foreground leading-relaxed">{howTo.detail}</p>
        </div>
      </div>
    </div>
  );
}

function TipsList({ tips, label, icon: Icon, colorClass }: {
  tips: string[];
  label: string;
  icon: React.ElementType;
  colorClass: string;
}) {
  return (
    <div className={`rounded-xl p-5 ${colorClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className="h-4 w-4" />
        <h4 className="font-semibold text-sm uppercase tracking-wide">{label}</h4>
      </div>
      <ul className="space-y-2">
        {tips.map((tip, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed">
            <span className="flex-shrink-0 mt-1">&bull;</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CollapsibleSection({
  section,
  isOpen,
  onToggle,
  activeTab,
  onTabSelect
}: {
  section: SectionGroup;
  isOpen: boolean;
  onToggle: () => void;
  activeTab: string;
  onTabSelect: (tabId: string) => void;
}) {
  const hasActiveTab = section.tabs.some(tab => tab.id === activeTab);

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-3 py-2 text-sm font-semibold rounded-lg transition-colors ${
          hasActiveTab
            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100'
            : 'text-zinc-700 hover:bg-muted dark:text-muted-foreground dark:hover:bg-zinc-800'
        }`}
      >
        <span>{section.label}</span>
        {isOpen ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
      </button>
      {isOpen && (
        <div className="mt-1 ml-2 space-y-0.5">
          {section.tabs.map((tab) => {
            const TabIcon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabSelect(tab.id)}
                className={`w-full flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors text-left ${
                  isActive
                    ? 'bg-emerald-600 text-white'
                    : 'text-zinc-600 hover:bg-muted dark:text-muted-foreground dark:hover:bg-zinc-800'
                }`}
              >
                <TabIcon className="h-3.5 w-3.5 flex-shrink-0" />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Page
// ============================================================================

export default function IndieKitHandbookPage() {
  const [activeTab, setActiveTab] = useState('welcome');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [openSections, setOpenSections] = useState<Set<string>>(() => {
    const initialOpen = new Set<string>();
    initialOpen.add('getting-started-section');
    return initialOpen;
  });

  const currentTab = tabContent[activeTab];

  const toggleSection = (sectionId: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  };

  const handleTabSelect = (tabId: string) => {
    setActiveTab(tabId);
    setMobileNavOpen(false);
    for (const section of sections) {
      if (section.tabs.some(tab => tab.id === tabId)) {
        setOpenSections(prev => new Set(prev).add(section.id));
        break;
      }
    }
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 py-10 text-white">
        <div className="container mx-auto px-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-emerald-100 hover:text-white mb-4 transition-colors">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight">IndieKit Handbook</h1>
          <p className="mt-2 text-lg text-emerald-100 max-w-2xl">
            Your complete guide to managing fulfillment, backer communication, surveys, shipping, and everything in between.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link href="/dashboard/indiekit" className="inline-flex items-center gap-2 rounded-lg bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-medium hover:bg-white/30 transition-colors">
              <LayoutDashboard className="h-4 w-4" /> Open IndieKit
            </Link>
            <Link href="/creator-handbook" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-medium hover:bg-white/10 transition-colors">
              <FileText className="h-4 w-4" /> Creator Handbook
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile Navigation Toggle */}
      <div className="lg:hidden sticky top-0 z-20 bg-background border-b border-border px-4 py-3">
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-muted-foreground"
        >
          {mobileNavOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          {mobileNavOpen ? 'Close Navigation' : 'Browse Sections'}
        </button>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className={`${mobileNavOpen ? 'block fixed inset-0 top-[105px] z-10 bg-background p-4 overflow-y-auto lg:relative lg:inset-auto lg:top-auto lg:z-auto lg:p-0' : 'hidden'} lg:block w-64 flex-shrink-0`}>
            <nav className="sticky top-8 max-h-[calc(100vh-8rem)] overflow-y-auto pr-2">
              {sections.map((section) => (
                <CollapsibleSection
                  key={section.id}
                  section={section}
                  isOpen={openSections.has(section.id)}
                  onToggle={() => toggleSection(section.id)}
                  activeTab={activeTab}
                  onTabSelect={handleTabSelect}
                />
              ))}

              {/* Workflow Quick Reference */}
              <div className="mt-6 rounded-xl bg-muted/50 dark:bg-zinc-900 p-4 border border-border">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground dark:text-muted-foreground mb-3">Fulfillment Workflow</h4>
                <div className="space-y-2">
                  {[
                    { icon: Mail, label: 'Send & Remind', color: 'text-blue-500' },
                    { icon: Lock, label: 'Lock Orders', color: 'text-amber-500' },
                    { icon: CreditCard, label: 'Charge Cards', color: 'text-purple-500' },
                    { icon: MapPin, label: 'Lock Addresses', color: 'text-orange-500' },
                    { icon: Truck, label: 'Start Shipping', color: 'text-emerald-500' },
                    { icon: CheckCircle2, label: 'Shipped', color: 'text-green-600' },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-muted-foreground">
                      <step.icon className={`h-3.5 w-3.5 flex-shrink-0 ${step.color}`} />
                      <span>{step.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </nav>
          </aside>

          {/* Content Area */}
          <main className="flex-1 min-w-0">
            {currentTab && (
              <>
                {/* Section Header */}
                <div className="mb-8">
                  <h2 className="text-xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{currentTab.title}</h2>
                  <p className="mt-2 text-lg text-zinc-600 dark:text-muted-foreground leading-relaxed">{currentTab.description}</p>
                </div>

                {/* How To Steps */}
                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4 flex items-center gap-2">
                    <Search className="h-5 w-5 text-emerald-600" />
                    How to Use
                  </h3>
                  <div className="space-y-3">
                    {currentTab.howTo.map((step) => (
                      <HowToCard key={step.step} howTo={step} />
                    ))}
                  </div>
                </div>

                {/* Tips & Gotchas Grid */}
                <div className={`grid gap-4 ${currentTab.gotchas ? 'md:grid-cols-2' : 'md:grid-cols-1'}`}>
                  <TipsList
                    tips={currentTab.tips}
                    label="Tips"
                    icon={Lightbulb}
                    colorClass="bg-emerald-50 dark:bg-emerald-950/30 text-emerald-900 dark:text-emerald-100"
                  />
                  {currentTab.gotchas && (
                    <TipsList
                      tips={currentTab.gotchas}
                      label="Watch Out"
                      icon={AlertTriangle}
                      colorClass="bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-100"
                    />
                  )}
                </div>
              </>
            )}

            {/* CTA Banner */}
            <div className="mt-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 p-8 text-white">
              <h3 className="text-2xl font-bold mb-2">Ready to Start Fulfilling?</h3>
              <p className="text-emerald-100 mb-5 max-w-xl">
                Open IndieKit from your Creator Dashboard and follow the workflow steps to get your rewards to your backers.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link href="/dashboard/indiekit" className="inline-flex items-center gap-2 rounded-lg bg-white text-emerald-600 px-5 py-2.5 text-sm font-semibold hover:bg-emerald-50 transition-colors">
                  <LayoutDashboard className="h-4 w-4" /> Open IndieKit
                </Link>
                <Link href="/creator-handbook" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-5 py-2.5 text-sm font-medium hover:bg-white/10 transition-colors">
                  <FileText className="h-4 w-4" /> Creator Handbook
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
