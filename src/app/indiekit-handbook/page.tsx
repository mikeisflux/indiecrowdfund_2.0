'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  Clock,
  HeadphonesIcon,
  Link2,
  Box,
  BoxIcon,
  Truck,
  Download,
  ShoppingCart,
  TrendingUp,
  Inbox,
  Mail,
  UsersRound,
  Layers,
  BarChart3,
  FileDown,
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
// ============================================================================

const sections: SectionGroup[] = [
  {
    id: 'getting-started-section',
    label: 'Getting Started',
    tabs: [
      { id: 'welcome', label: 'What is IndieKit?', icon: Sparkles },
      { id: 'first-steps', label: 'First Steps', icon: Rocket },
      { id: 'workflow', label: 'Fulfillment Workflow', icon: CheckCircle2 },
    ],
  },
  {
    id: 'dashboard-section',
    label: 'Dashboard & Core',
    tabs: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'backers', label: 'Backers', icon: Users },
      { id: 'projects', label: 'Projects', icon: FolderKanban },
      { id: 'updates', label: 'Updates', icon: FileText },
      { id: 'timeline', label: 'Timeline', icon: Clock },
      { id: 'support', label: 'Support', icon: HeadphonesIcon },
    ],
  },
  {
    id: 'fulfillment-section',
    label: 'Fulfillment & Products',
    tabs: [
      { id: 'packages', label: 'Packages', icon: Box },
      { id: 'products', label: 'Products', icon: BoxIcon },
      { id: 'shipping', label: 'Shipping', icon: Truck },
      { id: 'sku-mapping', label: 'SKU Mapping', icon: Link2 },
      { id: 'digital', label: 'Digital Files', icon: Download },
      { id: 'addons', label: 'Add-ons', icon: ShoppingCart },
      { id: 'preorders', label: 'Pre-Orders', icon: TrendingUp },
    ],
  },
  {
    id: 'communication-section',
    label: 'Communication & Marketing',
    tabs: [
      { id: 'inbox', label: 'Inbox', icon: Inbox },
      { id: 'emails', label: 'Email Campaigns', icon: Mail },
      { id: 'email-list', label: 'Email List', icon: UsersRound },
      { id: 'teaser', label: 'Teaser Pages', icon: FileText },
      { id: 'segments', label: 'Segments', icon: Layers },
    ],
  },
  {
    id: 'surveys-section',
    label: 'Surveys',
    tabs: [
      { id: 'survey-builder', label: 'Survey Builder', icon: FormInput },
      { id: 'manage-survey', label: 'Manage Survey', icon: ClipboardList },
    ],
  },
  {
    id: 'data-section',
    label: 'Data & Analytics',
    tabs: [
      { id: 'counts', label: 'Counts', icon: BarChart3 },
      { id: 'export', label: 'Export', icon: FileDown },
      { id: 'transaction-history', label: 'Transaction History', icon: CreditCard },
    ],
  },
  {
    id: 'settings-section',
    label: 'Settings',
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
    description: 'IndieKit is your all-in-one fulfillment and backer management toolkit. It handles everything that happens after your crowdfunding campaign funds — from collecting backer surveys and processing payments, to shipping physical products and distributing digital files.',
    howTo: [
      { step: 'Access IndieKit', detail: 'Log into your IndieCrowdfund account and go to your Creator Dashboard. Click "IndieKit" in the sidebar navigation. IndieKit becomes available once your campaign has reached its funding goal.' },
      { step: 'Select your project', detail: 'Use the project dropdown at the top of IndieKit to choose which campaign you want to manage. If you have multiple funded projects, you can switch between them at any time. Your last selected project is remembered.' },
      { step: 'Understand the layout', detail: 'IndieKit is organized into four tab rows across the top: Row 1 is Dashboard & Core (Overview, Backers, Projects, Updates, Timeline, Support, SKU Mapping). Row 2 is Fulfillment & Products (Packages, Products, Shipping, Digital, Add-ons, Pre-Orders). Row 3 is Communication (Inbox, Email Campaigns, Email List, Teaser Pages, Segments). Row 4 is Data & Settings (Counts, Export, Survey Builder, Manage Survey, Transaction History, Settings, Account).' },
      { step: 'Check the Workflow sidebar', detail: 'On the left side of the dashboard you will see the Fulfillment Workflow — a step-by-step guide showing your progress: Send & Remind, Lock Orders, Charge Cards, Lock Addresses, Start Shipping, and Shipped. Steps unlock sequentially as you complete each one.' },
    ],
    tips: [
      'Bookmark your IndieKit dashboard URL for quick access during fulfillment.',
      'IndieKit works best when you follow the workflow steps in order from top to bottom.',
      'The Overview tab is your home base — start each session there to see what needs attention.',
    ],
  },
  'first-steps': {
    title: 'First Steps After Funding',
    description: 'Your campaign just funded — congratulations! Here is exactly what to do next in IndieKit, in order.',
    howTo: [
      { step: '1. Open IndieKit and check the Overview', detail: 'Go to IndieKit and look at the "What\'s Next" banner at the top of the Overview tab. It will tell you your most important next action. Below that, review your Key Metrics: Total Backers, Surveys Completed %, Add-ons Purchased %, and Fulfilled %.' },
      { step: '2. Build your backer survey', detail: 'Click the Survey Builder tab. Add questions to collect the information you need from backers — shipping addresses, size/color preferences, and any other details. Use the drag-and-drop builder to reorder questions. Set item-specific variant questions (like Size or Color) per reward tier.' },
      { step: '3. Set up add-ons (optional)', detail: 'If you want to offer extra items backers can purchase, go to the Add-ons tab and create them. Add-ons appear in the survey so backers can buy them while filling out their information.' },
      { step: '4. Configure shipping zones', detail: 'Go to the Shipping tab and set up your shipping zones (Domestic, Canada, EU, Rest of World, etc.) with base rates and per-item pricing. This determines what backers will be charged for shipping in their survey.' },
      { step: '5. Send the survey', detail: 'Go to Email Campaigns and use the survey reminder template to notify all backers that their survey is ready. Monitor completion rates on the Manage Survey tab and send reminders to those who haven\'t completed it yet.' },
      { step: '6. Set up SKU Mapping (if using Shopify)', detail: 'If you use Shopify for fulfillment, go to the SKU Mapping tab to connect your Shopify store and map each reward tier and add-on to the correct Shopify product SKU.' },
    ],
    tips: [
      'Do steps 2-4 before sending the survey so everything is ready when backers start responding.',
      'Send your first survey email within a week of funding to maintain momentum.',
      'Aim for 90%+ survey completion before moving to the fulfillment phase.',
    ],
  },
  'workflow': {
    title: 'Fulfillment Workflow',
    description: 'IndieKit guides you through fulfillment with a six-step workflow displayed in the left sidebar. Each step unlocks after completing the previous one. Here is what each step does and when to use it.',
    howTo: [
      { step: 'Step 1: Send & Remind', detail: 'This is about collecting backer surveys. Go to the Email Campaigns tab and send a survey notification. Then use the Manage Survey tab to track completion rates. Send reminder emails to backers who haven\'t responded — you can do this from Email Campaigns using segment targeting for "Incomplete Survey" backers. Keep sending reminders until you hit 90%+ completion.' },
      { step: 'Step 2: Lock Orders', detail: 'Once survey responses are in, click "Lock Orders" in the workflow sidebar. This finalizes what each backer receives — their reward tier, add-ons, and variant selections. After locking, backers can no longer change their selections. Only lock when you are confident the data is complete.' },
      { step: 'Step 3: Charge Cards', detail: 'Click "Charge Cards" in the workflow sidebar. IndieKit will show a preview of all charges before processing. This step charges backers for any additional amounts owed — add-on purchases and shipping costs beyond what was included in their pledge. Review the charge preview carefully before confirming.' },
      { step: 'Step 4: Lock Addresses', detail: 'Click "Lock Addresses" to freeze shipping addresses. Send a "last chance to update your address" email first via Email Campaigns. After locking, backers can no longer modify their shipping information. This ensures your shipping labels are accurate.' },
      { step: 'Step 5: Start Shipping', detail: 'Click "Start Shipping" to push orders to your connected fulfillment service (Shopify, ShipStation, Shippo, EasyPost, etc.). You can also push orders from the Packages tab in batches. Start with a small test batch to verify everything is correct before pushing all orders.' },
      { step: 'Step 6: Shipped', detail: 'As orders ship and tracking numbers are added, mark orders as shipped. Backers automatically receive shipping notification emails with their tracking information. Monitor the Packages tab for any push errors or delivery issues.' },
    ],
    tips: [
      'Send a "last chance" email before each locking step so backers can make final changes.',
      'Start with a small batch (10-20 orders) when first pushing to fulfillment to catch any mapping issues.',
      'The workflow is designed to be done in order — skipping steps can cause problems.',
    ],
    gotchas: [
      'Locking orders is permanent — make sure survey data is complete before locking.',
      'Card charges can fail if a backer\'s payment method has expired. Check the "Charge Errored" status for these.',
      'If you push orders before mapping all SKUs, those orders will error. Complete SKU Mapping first.',
    ],
  },

  // ---- Dashboard & Core ----
  'overview': {
    title: 'Overview Tab',
    description: 'The Overview tab is your fulfillment command center. It shows key metrics, fulfillment status, and recent activity at a glance.',
    howTo: [
      { step: 'Read the What\'s Next banner', detail: 'At the top of the Overview tab, the What\'s Next banner suggests your most important next action based on your current fulfillment state. It might say "Send surveys to your backers", "Start shipping", or "View reports". Click the action button to jump directly to the relevant tab.' },
      { step: 'Review Post-Campaign Sales', detail: 'The Post-Campaign Sales card shows a stacked bar chart of revenue across all your projects, including pre-order sales that came in after funding.' },
      { step: 'Check the Fulfillment Status Flow', detail: 'This visual pipeline shows how many orders are in each state: Not Pushed, Push Errored, Pushed, and Shipped. Aim to move all orders to "Shipped" by the end of fulfillment.' },
      { step: 'Monitor Key Metrics', detail: 'Four metric cards show: Total Backers (campaign + pre-orders), Surveys Completed % (target 90%+), Purchased Add-ons % (how many backers bought extras), and Fulfilled % (orders shipped vs total).' },
      { step: 'Review Charge Details', detail: 'The charge breakdown shows how many backers are: Not Charged, Charge Errored, Charged, or PayPal Collected. Use this to identify payment issues that need attention.' },
      { step: 'Scan Recent Activity', detail: 'The activity feed at the bottom shows the 5 most recent events — survey completions, orders pushed, shipments, card charges, and more. For the full history, click through to the Timeline tab.' },
    ],
    tips: [
      'Check Overview daily during active fulfillment to stay on top of your progress.',
      'If "Push Errored" count is growing, check SKU Mapping for missing mappings.',
      'The Charge Details section helps you identify backers with payment issues to follow up on.',
    ],
  },
  'backers': {
    title: 'Backers Tab',
    description: 'The Backers tab is where you manage individual backers and take fulfillment actions on their orders.',
    howTo: [
      { step: 'Search for a backer', detail: 'Use the search bar at the top to find any backer by name or email. Partial matches work — typing "john" will find "John Smith" and "johnson@email.com".' },
      { step: 'Filter by status', detail: 'Use the status dropdown to filter backers by fulfillment state: All, Not Pushed, Push Errored, Pushed, or Shipped. Check "Push Errored" regularly to resolve issues.' },
      { step: 'View backer details', detail: 'Click any backer row to open their detail dialog. This shows everything: contact info, pledge amount, reward tier, add-on purchases, survey responses, shipping address, payment status, and internal notes.' },
      { step: 'Edit a backer\'s order', detail: 'In the backer detail dialog, you can edit their order — add or remove items, adjust modifier selections (size, color, etc.), and update their shipping address.' },
      { step: 'Add internal notes', detail: 'Click the notes icon on any backer to add private notes visible only to your team. Use this to document special requests, issues, or conversations.' },
      { step: 'Select backers for bulk actions', detail: 'Use the checkboxes to select multiple backers. With backers selected, you can: charge cards for the selected group, push their orders to fulfillment, or send them a targeted email.' },
      { step: 'Push orders to fulfillment', detail: 'Select the backers you want to fulfill, then click the "Push to Fulfillment" button. This sends their orders to your connected fulfillment service (Shopify, ShipStation, etc.).' },
    ],
    tips: [
      'Combine filters with search to find specific subsets — e.g., filter by "Push Errored" then search for a name.',
      'Push orders in batches of 20-50 to catch issues early rather than pushing everything at once.',
      'Use internal notes to track backer communications so your whole team has context.',
    ],
  },
  'projects': {
    title: 'Projects Tab',
    description: 'View and switch between your funded projects. Each project has its own separate fulfillment data.',
    howTo: [
      { step: 'View all projects', detail: 'The Projects tab shows all your projects in a list with their title, status badge, and quick stats. Statuses include: Draft, Pre-Launch, Active, Funded, Fulfilling, and Completed.' },
      { step: 'Switch active project', detail: 'Click any project row to set it as the active project for IndieKit. All other tabs will then show data for that project. The currently selected project is highlighted.' },
      { step: 'View project details', detail: 'Each project card shows links to view the project page or edit it. You can also see basic analytics like total raised and backer count.' },
    ],
    tips: [
      'Only Funded, Fulfilling, and Completed projects have fulfillment data in IndieKit.',
      'Your last selected project is remembered between sessions, so you don\'t need to re-select it every time.',
    ],
  },
  'updates': {
    title: 'Updates Tab',
    description: 'Create and publish project updates to keep your backers informed about progress.',
    howTo: [
      { step: 'Create a new update', detail: 'Click the "Create Update" button. Write your update using the rich text editor — you can add formatting, images, and links.' },
      { step: 'Set visibility', detail: 'Choose between "Public" (visible to everyone) or "Backers Only" (only visible to people who backed your project). Use Backers Only for sensitive fulfillment details like shipping timelines.' },
      { step: 'Save as draft or publish', detail: 'Click "Save Draft" to save without publishing, or "Publish" to make it live immediately. You can return to drafts later to finish and publish them.' },
      { step: 'Edit or delete', detail: 'Published updates can be edited or deleted from the updates list. Click the edit icon on any update to modify it.' },
    ],
    tips: [
      'Post updates at least every two weeks during fulfillment to keep backers informed and reduce support inquiries.',
      'Use Backers Only visibility for shipping timelines and production details.',
      'A short update is better than no update — even "Production is on track, shipping next month" is valuable.',
    ],
  },
  'timeline': {
    title: 'Timeline Tab',
    description: 'A complete chronological log of every fulfillment event — your audit trail.',
    howTo: [
      { step: 'Browse activity', detail: 'The Timeline shows all events in reverse chronological order with timestamps and icons: survey completions, order pushes, shipments, card charges, digital downloads, address updates, refunds, comments, and more.' },
      { step: 'Filter by type', detail: 'Use the activity type dropdown to filter by category: Survey, Payment, Shipping, Digital, Address, Support, and more. This helps you focus on specific types of events.' },
      { step: 'Filter by date', detail: 'Use the date range picker to view activity within a specific time window. Useful when investigating a support issue or tracking recent events.' },
      { step: 'Load more', detail: 'The Timeline loads recent events first. Click "Load More" at the bottom to see older activity.' },
    ],
    tips: [
      'Filter by "Payment" to quickly review all charge attempts and failures.',
      'Use date filtering when a backer contacts support — you can see exactly what happened with their order.',
      'The Timeline is read-only — it\'s a log of what happened, not a place to take actions.',
    ],
  },
  'support': {
    title: 'Support Tab',
    description: 'Look up any backer and manage support interactions.',
    howTo: [
      { step: 'Search for a backer', detail: 'Use the search to find any backer by name or email. This is designed for when a backer contacts you and you need to quickly look up their information.' },
      { step: 'View backer context', detail: 'See the backer\'s complete information: pledge amount, reward tier, survey status, shipping address, payment status, and order history — all in one place.' },
      { step: 'Add internal notes', detail: 'Document the support interaction with internal notes. These are private — backers cannot see them. Notes help your team track what was discussed and any resolutions.' },
      { step: 'Send a direct email', detail: 'Email the backer directly from IndieKit. Use templates for common questions like address changes, shipping delays, or refund requests.' },
    ],
    tips: [
      'Keep the Support tab open in a separate browser tab when handling support emails for quick lookups.',
      'Always add a note after resolving a support issue so your team has context for future interactions.',
    ],
  },

  // ---- Fulfillment & Products ----
  'packages': {
    title: 'Packages Tab',
    description: 'Manage shipment packages and push orders to fulfillment providers.',
    howTo: [
      { step: 'View package groups', detail: 'Package groups organize backer orders for fulfillment. You can view groups by segment: Ready to Ship, In Process, and Shipped.' },
      { step: 'Create a package group', detail: 'Click "Create Package Group" to organize a batch of orders. You can group by reward tier, shipping region, or custom criteria.' },
      { step: 'Push orders to fulfillment', detail: 'Select a package group and click "Push to Shopify" or "Push to Fulfillment" to send orders to your connected shipping provider. Start with a small batch to test.' },
      { step: 'Sync order status', detail: 'Click "Sync Status" to pull the latest fulfillment status from your connected provider. This updates tracking numbers and delivery status for orders that have been pushed.' },
      { step: 'Handle push errors', detail: 'If orders fail to push, they show a "Push Errored" status. Click to view the error details. Common causes: missing SKU mapping, invalid address, or connection issues with the fulfillment provider.' },
    ],
    tips: [
      'Ship simpler rewards first (fewer items, domestic addresses) to build confidence in your fulfillment process.',
      'Check for push errors after every batch push and resolve them before pushing more.',
      'Use package groups to organize waves — e.g., "Wave 1: US Backers" and "Wave 2: International".',
    ],
  },
  'products': {
    title: 'Products Tab',
    description: 'View and manage the physical and digital products associated with your rewards.',
    howTo: [
      { step: 'Browse your product catalog', detail: 'The Products tab shows all items derived from your reward tiers and add-ons. Each product displays: name, SKU, type (Physical or Digital), and status.' },
      { step: 'Add product details', detail: 'Click any product to add or edit details: weight, dimensions (length, width, height), customs code, country of origin, and customs description. These details are needed for international shipping.' },
      { step: 'Check product status', detail: 'Each product has a status indicator: Ready (all info complete), No Weight (missing weight), No Customs (missing customs info), or Error (needs attention).' },
      { step: 'Filter products', detail: 'Filter by product type (Physical/Digital) or status to find products that need attention.' },
    ],
    tips: [
      'Fill in weight and dimensions for all physical products before pushing orders — shipping providers need this data.',
      'Customs information is required for international shipping. Look up the correct HS codes for your products.',
    ],
  },
  'shipping': {
    title: 'Shipping Tab',
    description: 'Configure shipping zones, rates, and connect to shipping providers.',
    howTo: [
      { step: 'Set up shipping zones', detail: 'Configure zones for the regions you ship to: Domestic, Canada, EU, Rest of World, or custom zones. Each zone has its own pricing.' },
      { step: 'Set base rates', detail: 'For each zone, set a base shipping rate — the minimum cost for a single package. This is what backers are charged for shipping in their survey.' },
      { step: 'Set per-item costs', detail: 'Add additional charges per extra item in the same order. This covers the extra weight and space when a backer orders multiple items.' },
      { step: 'Set free shipping thresholds', detail: 'Optionally set a minimum order value for free shipping per zone. Orders above this amount get free shipping.' },
      { step: 'Configure customs', detail: 'For international zones, set customs declaration requirements. This ensures packages have the right paperwork for international transit.' },
      { step: 'Connect shipping providers', detail: 'Connect to ShipStation, EasyPost, Shippo, or Stamps.com by entering your API credentials in the provider sections. Once connected, you can push orders directly to these services for label generation.' },
    ],
    tips: [
      'Research actual carrier rates before setting your prices. Undercharging for shipping is one of the most common crowdfunding mistakes.',
      'Set your free shipping threshold just above your average order value to encourage larger orders.',
      'Connect your shipping provider before you start pushing orders from the Packages tab.',
    ],
    gotchas: [
      'Shipping rates set here are what backers are charged in the survey. Actual carrier rates may differ from what you charge.',
      'Changing shipping rates after backers have already completed surveys will NOT retroactively change what they were charged.',
    ],
  },
  'sku-mapping': {
    title: 'SKU Mapping Tab',
    description: 'Connect your IndieKit rewards and add-ons to Shopify products so orders can be pushed to fulfillment.',
    howTo: [
      { step: 'Connect your Shopify store', detail: 'Click "Connect Shopify" and follow the OAuth flow to authorize IndieKit to access your Shopify store. You can also enter your Shopify API credentials manually in Settings.' },
      { step: 'Map reward tiers to Shopify SKUs', detail: 'For each reward tier, select the corresponding Shopify product from the dropdown. IndieKit will match by SKU. If a reward includes multiple physical items, map each one.' },
      { step: 'Map add-ons to Shopify SKUs', detail: 'Similarly, map each add-on item to its corresponding Shopify SKU. If an add-on has variants (size, color), map each variant separately.' },
      { step: 'Handle modifier combos', detail: 'If backers chose variants (like "T-shirt in Large, Blue"), IndieKit creates modifier addon SKU combinations. Map each unique combination to the correct Shopify variant SKU.' },
      { step: 'Mark items to skip', detail: 'Digital-only items don\'t need to be shipped through Shopify. Click "Skip" on any item that should not be included in Shopify fulfillment orders.' },
      { step: 'Validate your mappings', detail: 'Click "Validate Mappings" to check that all SKUs exist in your Shopify store and all reward tiers are mapped. Fix any errors before pushing orders.' },
    ],
    tips: [
      'Complete ALL SKU mapping before pushing any orders. Unmapped items will cause push errors.',
      'SKUs are case-sensitive — "SHIRT-LG-BLU" is different from "shirt-lg-blu". Make sure they match exactly.',
      'After mapping, always click Validate to catch issues before they become order push errors.',
    ],
    gotchas: [
      'If you add new rewards or add-ons after initial mapping, you need to map the new items too.',
      'Deleting a product from Shopify will break its mapping. Re-map to the new product.',
    ],
  },
  'digital': {
    title: 'Digital Files Tab',
    description: 'Upload digital files and distribute them to eligible backers.',
    howTo: [
      { step: 'Upload files', detail: 'Click "Upload File" to add a digital file — PDFs, ebooks, audio files, images, or any downloadable content. Files are securely stored and backers receive time-limited download links.' },
      { step: 'Create distribution rules', detail: 'After uploading, create rules that determine which backers receive which files. Rules can be based on: reward tier (e.g., "All backers at $50+ tier"), specific add-on purchase, or custom segment.' },
      { step: 'Preview eligible backers', detail: 'Before distributing, check the "Eligible" count on each rule to see how many backers will receive the file. Compare this with the "Distributed" count to see who has already received it.' },
      { step: 'Send a distribution blast', detail: 'Click "Send Blast" on a distribution rule to email all eligible backers a notification with their download link. Or click "Start All Distributions" to process all pending rules at once.' },
      { step: 'Track downloads', detail: 'Monitor the distributed count vs eligible count for each file. Follow up with backers who haven\'t downloaded their files yet.' },
      { step: 'Delete files or rules', detail: 'Remove files you no longer need or delete distribution rules that are no longer relevant.' },
    ],
    tips: [
      'Compress large files before uploading for faster backer downloads.',
      'Test distribution rules with a small segment first to verify the right backers receive the right files.',
      'Send a reminder email to backers who haven\'t downloaded their files after a week.',
    ],
  },
  'addons': {
    title: 'Add-ons Tab',
    description: 'Create and manage optional extras that backers can purchase during the survey.',
    howTo: [
      { step: 'Create an add-on', detail: 'Click "Create Add-on" and fill in: name, description, price, and optional image. Set quantity limits if you have limited stock.' },
      { step: 'Link add-ons to rewards', detail: 'Choose which reward tiers can access each add-on. You can make add-ons available to all tiers or restrict them to specific ones.' },
      { step: 'Activate or deactivate', detail: 'Toggle add-ons on or off. Deactivated add-ons no longer appear in the survey but existing purchases are preserved.' },
      { step: 'Import from another project', detail: 'Click "Import from Project" to copy add-ons from a different project. Useful if you run multiple campaigns with similar products.' },
      { step: 'Track sales', detail: 'View total revenue, number of backers who purchased, and total items sold for each add-on.' },
      { step: 'Unlink add-ons', detail: 'Unlink individual add-ons from specific reward tiers, or use "Unlink All" to remove all associations.' },
    ],
    tips: [
      'Popular add-ons: extra copies, exclusive variants, accessories, and digital upgrades.',
      'Add high-quality images to add-ons — they significantly increase purchase rates.',
      'Set up add-ons before sending the survey so backers see them right away.',
      'Deactivate add-ons when inventory runs out rather than deleting them (preserves existing order data).',
    ],
  },
  'preorders': {
    title: 'Pre-Orders Tab',
    description: 'Track and manage post-funding pledges. After your campaign funds, new backers can still pledge and are charged immediately.',
    howTo: [
      { step: 'View pre-order metrics', detail: 'See total pre-order revenue, number of pre-order backers, and how they compare to campaign backers.' },
      { step: 'Compare returning vs new backers', detail: 'The breakdown shows how many pre-order backers are returning (backed before) vs entirely new supporters.' },
      { step: 'Review backer acquisition', detail: 'See where your pre-order backers are coming from — direct links, teaser pages, search, etc.' },
    ],
    tips: [
      'Promote pre-orders on social media and in project updates to drive additional revenue.',
      'Pre-order backers are charged immediately, unlike campaign backers who are only charged when the campaign funds.',
      'Consider shipping pre-orders in separate waves if they come in after your main fulfillment has started.',
    ],
  },

  // ---- Communication & Marketing ----
  'inbox': {
    title: 'Inbox Tab',
    description: 'Your central message hub for all backer communications.',
    howTo: [
      { step: 'View message threads', detail: 'The Inbox shows all email conversations with backers organized as threads. Each thread shows the backer\'s name, subject, and most recent message preview.' },
      { step: 'Filter by status', detail: 'Filter threads by: Unread, Read, Replied, or Archived. Focus on Unread threads first to stay responsive.' },
      { step: 'Search threads', detail: 'Use the search bar to find specific conversations by backer name, email, or message content.' },
      { step: 'Star important messages', detail: 'Click the star icon on important threads to flag them for follow-up. Starred messages are easy to find later.' },
      { step: 'Reply to messages', detail: 'Open a thread and use the composer at the bottom to reply. You can Reply, Reply All, or Forward messages.' },
      { step: 'Compose a new email', detail: 'Click the compose button to start a new email to any backer.' },
      { step: 'Set up your email handle', detail: 'Configure your creator email handle in Settings so backer replies come into your IndieKit Inbox.' },
    ],
    tips: [
      'Check your Inbox daily during active fulfillment. Quick responses build trust with backers.',
      'Archive threads only after the issue is fully resolved.',
      'Star threads that need follow-up action so you don\'t lose track of them.',
    ],
  },
  'emails': {
    title: 'Email Campaigns Tab',
    description: 'Design, send, and track email campaigns to your backers and subscribers.',
    howTo: [
      { step: 'Browse templates', detail: 'IndieKit provides pre-built email templates organized by campaign stage: Before Launch (Teaser, Countdown, Behind the Scenes), Launch Day, Post-Launch, Survey/Fulfillment stages, and more. Click any template to use it as a starting point.' },
      { step: 'Create a custom campaign', detail: 'Click "Create Campaign" to start from scratch. Add a subject line and compose your email with the rich text editor.' },
      { step: 'Choose recipients', detail: 'Select who receives the email: All Backers, a specific Segment (e.g., "US Backers" or "Incomplete Surveys"), or your full Email List including pre-launch followers.' },
      { step: 'Schedule or send immediately', detail: 'Send the campaign right away, or schedule it for a specific date and time.' },
      { step: 'Track performance', detail: 'After sending, view open rates and click rates for each campaign. Use this data to improve future emails.' },
    ],
    tips: [
      'Use the pre-built templates as starting points — they are designed for each stage of fulfillment.',
      'Targeted emails to specific segments get significantly higher engagement than blasting everyone.',
      'Tuesday through Thursday tends to get the best open rates for campaign emails.',
      'Keep emails concise and scannable — use short paragraphs, bullet points, and clear calls to action.',
    ],
  },
  'email-list': {
    title: 'Email List Tab',
    description: 'Manage your complete email subscriber list.',
    howTo: [
      { step: 'Browse subscribers', detail: 'View all email subscribers with pagination. Each entry shows the email address, source (Kickstarter, Teaser Page, Import, Pre-order), and status.' },
      { step: 'Search the list', detail: 'Use the search bar to find a specific email address.' },
      { step: 'Filter by source', detail: 'Filter to see subscribers from a specific source: campaign backers, teaser page signups, CSV imports, or pre-order customers.' },
      { step: 'Import emails', detail: 'Click "Import" to upload a CSV file of email addresses. Map your CSV columns to the required fields.' },
      { step: 'Add a single member', detail: 'Click "Add Member" to manually add an individual email address.' },
      { step: 'Export your list', detail: 'Click "Export" to download your complete email list as a CSV file for use in external email tools.' },
      { step: 'Delete members', detail: 'Remove individual subscribers or use "Delete All" to clear the list. Be careful — this is permanent.' },
    ],
    tips: [
      'Export your email list regularly as a backup.',
      'Remove bounced emails to improve deliverability for future campaigns.',
      'Your email list is one of your most valuable assets as a creator. Treat it well by sending relevant, valuable content.',
    ],
  },
  'teaser': {
    title: 'Teaser Pages Tab',
    description: 'Manage pre-launch teaser pages that collect email signups before your campaign goes live.',
    howTo: [
      { step: 'View teaser pages', detail: 'See all your pre-launch pages with their status: Draft, Submitted, Approved, or Rejected. Each shows the follower count — how many people signed up.' },
      { step: 'Check follower counts', detail: 'Monitor how many people have signed up through each teaser page. A growing count indicates strong launch potential.' },
      { step: 'Publish or unpublish', detail: 'Toggle teaser pages on and off. Published pages are visible to visitors; unpublished pages are hidden.' },
      { step: 'View the vanity URL', detail: 'Each teaser page gets a custom URL you can share on social media and in marketing materials.' },
    ],
    tips: [
      'Launch your teaser page 2-4 weeks before your campaign to build an audience.',
      'Share the teaser page URL on social media, forums, and relevant communities.',
      'Offer an incentive for early signups — like an early-bird discount or exclusive reward.',
    ],
  },
  'segments': {
    title: 'Segments Tab',
    description: 'Create dynamic backer groups based on shared characteristics for targeted communication and fulfillment.',
    howTo: [
      { step: 'Create a segment', detail: 'Click "Create Segment" and define the criteria. Choose from: Pledge Level, Add-on Purchased, Survey Status, Shipping Region, Payment Status, or Custom criteria. Combine multiple criteria for precise targeting.' },
      { step: 'View segment members', detail: 'Click any segment to see the backer count and list of members. Membership is dynamic — as backers update their information, they automatically move in or out of segments.' },
      { step: 'Email a segment', detail: 'Click the email icon on any segment to send a targeted email to just those backers. This is much more effective than emailing everyone.' },
      { step: 'Duplicate a segment', detail: 'Copy an existing segment and modify the criteria to create a similar but different group.' },
      { step: 'Edit or delete', detail: 'Update segment criteria at any time or delete segments you no longer need.' },
    ],
    tips: [
      'Create segments for each fulfillment wave: "Wave 1: US Domestic", "Wave 2: Canada/EU", "Wave 3: Rest of World".',
      'Create an "Incomplete Survey" segment and email them weekly reminders.',
      'Create a "High Value Backer" segment (high pledge amount + add-ons) for VIP treatment.',
      'Segment-targeted emails consistently get 2-3x higher engagement than mass emails.',
    ],
  },

  // ---- Surveys ----
  'survey-builder': {
    title: 'Survey Builder Tab',
    description: 'Build your backer survey with a drag-and-drop question editor. The survey collects shipping addresses, size/color preferences, and any other information you need for fulfillment.',
    howTo: [
      { step: 'Add a question', detail: 'Click "Add Question" and choose from 13 question types: Short Text, Long Text, Multiple Choice, Checkboxes, Dropdown, Address, Email, Phone, Date, Number, File Upload, Section Break, and Info Text.' },
      { step: 'Choose the right question type', detail: 'Use Address for shipping info (it auto-validates). Use Multiple Choice or Dropdown for selections like size or color. Use Checkboxes when backers can pick multiple options. Use Section Break and Info Text to organize and explain sections.' },
      { step: 'Set per-reward variant questions', detail: 'For item-specific choices like Size, Color, Style, Material, Edition, or Language — configure these as per-reward variants. This means only backers who selected that specific reward see those questions.' },
      { step: 'Add per-reward custom questions', detail: 'Add questions that only appear for backers of specific reward tiers. For example, "What name would you like engraved?" only for the Collector\'s Edition tier.' },
      { step: 'Reorder questions', detail: 'Drag and drop questions to reorder them. Put the most important questions first — address and reward choices should come before optional questions.' },
      { step: 'Mark required vs optional', detail: 'Toggle the "Required" flag on each question. Only require what you truly need — every required question increases drop-off rates.' },
      { step: 'Save your survey', detail: 'Click "Save" to store your survey. You can continue editing until you send it to backers.' },
    ],
    tips: [
      'Keep surveys as short as possible. Every additional question reduces completion rates.',
      'Put the Address question early in the survey since it\'s the most critical for fulfillment.',
      'Use Section Breaks to visually organize longer surveys — they help backers understand what\'s expected.',
      'Always test your survey by previewing it before sending to backers.',
    ],
    gotchas: [
      'Editing a survey after backers have started responding can cause data inconsistencies. Make major changes before sending.',
      'Deleting a question also deletes all responses to that question. Be careful.',
    ],
  },
  'manage-survey': {
    title: 'Manage Survey Tab',
    description: 'Monitor survey responses, send reminders, and manage the survey lifecycle.',
    howTo: [
      { step: 'Check survey status', detail: 'The survey has three states: Draft (not yet sent), Sent (backers can respond), and Locked (responses frozen). The current status is shown at the top of the tab.' },
      { step: 'View completion rates', detail: 'See the percentage of backers who have completed the survey, along with total responses vs total backers. Aim for 90%+ before moving to fulfillment.' },
      { step: 'Switch between views', detail: 'Toggle between "Item Questions" (variant selections like size/color) and "Backer Questions" (general questions like address) to review different response types.' },
      { step: 'Send reminders', detail: 'Click "Send Reminders" to send a bulk reminder email to all backers who haven\'t completed their survey yet. You can also create targeted reminder campaigns from the Email Campaigns tab.' },
      { step: 'View collected addresses', detail: 'See all shipping addresses collected through the survey. Review for completeness and flag any that look incorrect.' },
      { step: 'Lock the survey', detail: 'When you\'re satisfied with response rates, click "Lock Survey" to prevent further changes. This is typically done before locking orders in the workflow.' },
      { step: 'Delete questions', detail: 'Remove questions that are no longer needed. Note: this also deletes all responses to that question.' },
    ],
    tips: [
      'If you\'re below 80% completion, send reminders weekly, then more frequently as your shipping deadline approaches.',
      'Keep the survey open as long as possible — some backers are slow to respond but will eventually.',
      'Review addresses for obvious errors (missing apartment numbers, wrong countries) before locking.',
    ],
  },

  // ---- Data & Analytics ----
  'counts': {
    title: 'Counts Tab',
    description: 'Statistical overview of your campaign with visual breakdowns.',
    howTo: [
      { step: 'Review top-level metrics', detail: 'See four key numbers at the top: Total Backers (campaign + pre-orders), Surveys Done (count and completion %), Pre-orders count, and Backers with Add-ons (count and %).' },
      { step: 'View pledge level breakdown', detail: 'A chart showing how many backers are at each reward tier. Use this to plan production quantities and prioritize fulfillment.' },
      { step: 'View survey status breakdown', detail: 'See how many backers are in each survey state: Completed, In Progress, Not Started. Identify how many more responses you need.' },
      { step: 'View shipping region breakdown', detail: 'Geographic distribution of your backers. Use this to plan shipping waves and estimate shipping costs by region.' },
      { step: 'View payment status breakdown', detail: 'See how many backers are: Not Charged, Charged, Charge Failed, or Refunded. Identify payment issues that need attention.' },
    ],
    tips: [
      'Use the pledge level breakdown to know exactly how many of each product to manufacture.',
      'The shipping region breakdown helps you plan which regions to ship to first.',
      'Compare Total Add-on Items with your inventory to avoid overselling.',
    ],
  },
  'export': {
    title: 'Export Tab',
    description: 'Download your campaign data in CSV or JSON format.',
    howTo: [
      { step: 'Choose export type', detail: 'Select what to export: All Backers (complete backer data), Shipping Addresses (formatted for labels), or Survey Responses (all answers).' },
      { step: 'Choose format', detail: 'Select CSV (works with Excel, Google Sheets, and most tools) or JSON (for developers and custom integrations).' },
      { step: 'Select fields', detail: 'Choose which fields to include in the export: name, email, address, pledge level, items, add-ons, phone, survey answers, payment status.' },
      { step: 'Download', detail: 'Click "Export" to generate and download the file. Large exports may take a moment to process.' },
      { step: 'View export history', detail: 'Previously generated exports are shown with download links so you can re-download them later.' },
    ],
    tips: [
      'Export your backer data regularly as a backup.',
      'CSV format is universally compatible — use it unless you specifically need JSON.',
      'When exporting shipping addresses for label printing, verify the format matches your label printer\'s requirements.',
    ],
  },
  'transaction-history': {
    title: 'Transaction History Tab',
    description: 'View all financial transactions associated with your campaign.',
    howTo: [
      { step: 'Browse transactions', detail: 'See every pledge and after-sale transaction listed chronologically. Each entry shows: backer name/email, amount, transaction type (Pledge or After-sale), and payment processor.' },
      { step: 'Search transactions', detail: 'Search by backer name or email to find specific transactions quickly.' },
      { step: 'Filter by type', detail: 'Filter to see only Pledges (original campaign payments) or After-sales (add-on purchases and shipping charges).' },
      { step: 'View transaction details', detail: 'Each transaction shows the payment processor used and the Stripe Payment Intent ID for reference when debugging payment issues.' },
      { step: 'Review statistics', detail: 'See total transaction count, total revenue, and revenue breakdowns at the top of the tab.' },
    ],
    tips: [
      'Use the Stripe Payment Intent ID when contacting Stripe support about specific transactions.',
      'Filter by "After-sale" to see total add-on and shipping revenue separately from pledges.',
    ],
  },

  // ---- Settings ----
  'settings': {
    title: 'Settings Tab',
    description: 'Configure all aspects of your IndieKit project settings and integrations.',
    howTo: [
      { step: 'General settings', detail: 'Set your project name, currency, and timezone. The timezone should match your warehouse or fulfillment center location.' },
      { step: 'Survey settings', detail: 'Configure survey status, reminder frequency, deadlines, and confirmation messages.' },
      { step: 'Shipping settings', detail: 'Set base rates, per-item pricing, and free shipping thresholds (these link to the Shipping tab for detailed zone configuration).' },
      { step: 'Payment settings', detail: 'View and manage payment processor integration status.' },
      { step: 'Notification settings', detail: 'Configure which email notifications you receive — survey completions, order pushes, payment issues, etc.' },
      { step: 'Connect Shopify', detail: 'Enter your Shopify store URL and API credentials to enable order pushing and SKU mapping. Click "Validate" to test the connection.' },
      { step: 'Connect shipping providers', detail: 'Add API keys for ShipStation, Shippo, EasyPost, or Stamps.com. Each provider has its own section with credential fields and connection status.' },
      { step: 'Manage team', detail: 'Invite team members by email and set their permissions. Control who can view data, push orders, or modify settings.' },
    ],
    tips: [
      'Test every integration connection with a single order before processing in bulk.',
      'Set a firm survey deadline and communicate it clearly in reminder emails.',
      'Give team members only the access they need — start with view-only and expand as needed.',
    ],
  },
  'account': {
    title: 'Account Tab',
    description: 'Manage your creator account profile.',
    howTo: [
      { step: 'View your profile', detail: 'See your avatar, name, and email address. This is the same profile that appears on your project pages.' },
      { step: 'Edit your profile', detail: 'Click "Edit Profile" to update your name, avatar, and contact information. This links to your main dashboard profile settings.' },
      { step: 'Manage notifications', detail: 'Click the notification settings link to configure which alerts you receive.' },
    ],
    tips: [
      'Keep your contact email current — backers and the platform use it to reach you.',
      'A professional profile photo builds trust with backers.',
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
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{howTo.detail}</p>
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
            : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
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
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
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
          <h1 className="text-4xl font-bold tracking-tight">IndieKit Handbook</h1>
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
          className="flex items-center gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
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
              <div className="mt-6 rounded-xl bg-zinc-50 dark:bg-zinc-900 p-4 border border-border">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-3">Fulfillment Workflow</h4>
                <div className="space-y-2">
                  {[
                    { icon: Mail, label: 'Send & Remind', color: 'text-blue-500' },
                    { icon: Lock, label: 'Lock Orders', color: 'text-amber-500' },
                    { icon: CreditCard, label: 'Charge Cards', color: 'text-purple-500' },
                    { icon: MapPin, label: 'Lock Addresses', color: 'text-orange-500' },
                    { icon: Truck, label: 'Start Shipping', color: 'text-emerald-500' },
                    { icon: CheckCircle2, label: 'Shipped', color: 'text-green-600' },
                  ].map((step, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
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
                  <h2 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{currentTab.title}</h2>
                  <p className="mt-2 text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">{currentTab.description}</p>
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
