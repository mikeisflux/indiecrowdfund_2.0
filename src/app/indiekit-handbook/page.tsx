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
  AlertCircle,
  Info,
  ArrowLeft,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { Footer } from "@/components/footer";

// Tab definitions organized by row
const tabs = [
  { id: 'getting-started', label: 'Getting Started', icon: Sparkles },
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'backers', label: 'Backers', icon: Users },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'updates', label: 'Updates', icon: FileText },
  { id: 'timeline', label: 'Timeline', icon: Clock },
  { id: 'support', label: 'Support', icon: HeadphonesIcon },
  { id: 'sku-mapping', label: 'SKU Mapping', icon: Link2 },
  { id: 'packages', label: 'Packages', icon: Box },
  { id: 'products', label: 'Products', icon: BoxIcon },
  { id: 'shipping', label: 'Shipping', icon: Truck },
  { id: 'digital', label: 'Digital', icon: Download },
  { id: 'addons', label: 'Add-ons', icon: ShoppingCart },
  { id: 'preorders', label: 'Pre-Orders', icon: TrendingUp },
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'emails', label: 'Email Campaigns', icon: Mail },
  { id: 'email-list', label: 'Email List', icon: UsersRound },
  { id: 'teaser', label: 'Teaser Pages', icon: FileText },
  { id: 'segments', label: 'Segments', icon: Layers },
  { id: 'counts', label: 'Counts', icon: BarChart3 },
  { id: 'export', label: 'Export', icon: FileDown },
  { id: 'survey-builder', label: 'Survey Builder', icon: FormInput },
  { id: 'manage-survey', label: 'Manage Survey', icon: ClipboardList },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'account', label: 'Account', icon: UserCircle },
  { id: 'workflow', label: 'Workflow', icon: CheckCircle2 },
];

interface FieldInfo {
  name: string;
  required?: boolean;
  description: string;
  tips?: string;
}

// Getting Started fields
const gettingStartedFields: FieldInfo[] = [
  {
    name: 'What is IndieKit?',
    description: 'IndieKit is your complete fulfillment and project management system. It\'s a comprehensive backend for managing crowdfunding campaigns from collection through fulfillment, including backer management, surveys, digital distribution, shipping, payments, and communication.',
    tips: 'Access IndieKit from your Creator Dashboard after your campaign is funded or from the sidebar navigation.',
  },
  {
    name: 'When to Use IndieKit',
    description: 'IndieKit becomes available after your campaign funds. Use it to manage all post-campaign activities including survey collection, add-on sales, digital file distribution, shipping coordination, and backer communications.',
    tips: 'The sooner you set up your survey and add-ons after funding, the smoother your fulfillment process will be.',
  },
  {
    name: 'Project Selection',
    description: 'If you have multiple projects, use the project selector dropdown at the top of IndieKit to switch between them. Each project has its own separate fulfillment data.',
    tips: 'Your last selected project is remembered, so you\'ll return to it when you come back to IndieKit.',
  },
  {
    name: 'Workflow Sidebar',
    description: 'The left sidebar shows your fulfillment workflow progress. Each step shows its status (Pending, In Progress, Completed, Locked) and the count of items requiring action.',
    tips: 'Complete steps in order: Surveys → Lock Orders → Charge Cards → Lock Addresses → Start Shipping → Shipped.',
  },
  {
    name: 'Quick Stats Sidebar',
    description: 'The right sidebar displays key metrics at a glance: fulfillment progress (X/Y backers fulfilled), survey completion rates, and a feedback button.',
    tips: 'Monitor these stats daily during active fulfillment to track your progress.',
  },
];

// Overview Tab fields
const overviewFields: FieldInfo[] = [
  {
    name: 'What\'s Next Banner',
    description: 'A contextual action banner that guides you to your next most important task. It automatically updates based on your fulfillment state.',
    tips: 'The banner shows survey reminders if surveys are pending, shipping actions if orders need fulfillment, or a completion summary when done.',
  },
  {
    name: 'Total Raised Breakdown',
    description: 'See your total funds raised split between campaign pledges and pre-order sales. This gives you a complete picture of your project\'s financial status.',
    tips: 'Pre-order funds are shown separately to help you track post-campaign sales.',
  },
  {
    name: 'Fulfillment Status Flow',
    description: 'Visual breakdown of backer statuses: Not Pushed, Pushed, and Shipped. Track how many orders are at each stage of fulfillment.',
    tips: 'Aim to move backers through each status as efficiently as possible to minimize fulfillment time.',
  },
  {
    name: 'Key Metrics Cards',
    description: 'Quick stats showing Total Backers, Surveys Completed, Add-ons Purchased, and Orders Fulfilled. Click any card to navigate to the relevant tab.',
    tips: 'Green checkmarks indicate completed milestones, while amber alerts show items needing attention.',
  },
  {
    name: 'Charge Details Breakdown',
    description: 'For projects using card payments, see the breakdown: Not Charged, Errored, Charged, and PayPal Collected. Essential for tracking payment collection.',
    tips: 'Address errored charges promptly - these are often expired cards or insufficient funds that can be recovered.',
  },
  {
    name: 'Recent Activity Timeline',
    description: 'A live feed of recent actions: survey completions, orders pushed, shipments marked, and more. Filter by activity type to focus on specific events.',
    tips: 'Review the timeline daily during active fulfillment to catch any issues early.',
  },
  {
    name: 'Send Survey Reminders',
    description: 'One-click button to send reminder emails to all backers who haven\'t completed their survey. Essential for maximizing survey completion rates.',
    tips: 'Send reminders weekly at first, then more frequently as your shipping deadline approaches.',
  },
];

// Backers Tab fields
const backersFields: FieldInfo[] = [
  {
    name: 'Backer Search',
    description: 'Search backers by name or email address. Instantly find any backer in your project to view their details or take action.',
    tips: 'Use partial matches - typing "john" will find all Johns in your backer list.',
  },
  {
    name: 'Status Filter',
    description: 'Filter backers by fulfillment status: All, Not Pushed, Push Errored, Pushed, or Shipped. Quickly focus on backers at specific fulfillment stages.',
    tips: 'Regularly check "Push Errored" to address any fulfillment issues that need manual intervention.',
  },
  {
    name: 'Bulk Selection',
    description: 'Select multiple backers using checkboxes to perform bulk actions. Use "Select All" to select all visible backers for batch operations.',
    tips: 'Combine filters with bulk selection to take action on specific groups (e.g., all "Not Pushed" backers).',
  },
  {
    name: 'Backer Detail View',
    description: 'Click any backer row to open a detailed view showing: contact info, pledge amount, reward tier, add-ons purchased, survey responses, shipping address, and fulfillment status.',
    tips: 'The detail view is your one-stop shop for all backer information when handling support requests.',
  },
  {
    name: 'Address Information',
    description: 'View and verify each backer\'s shipping address. Addresses marked with warnings may have validation issues that need review.',
    tips: 'Lock addresses only after verifying they\'re correct - this prevents backers from making changes.',
  },
  {
    name: 'Payment Status',
    description: 'See each backer\'s payment method and charge status: whether their card has been charged, failed, or is pending. Includes the last 4 digits of their card.',
    tips: 'For failed charges, you can manually retry or contact the backer to update their payment method.',
  },
  {
    name: 'Rewards & Items',
    description: 'View exactly what each backer is receiving: their reward tier, all add-ons they purchased, and any variants or custom options they selected.',
    tips: 'Cross-reference this with your packing list to ensure accurate order fulfillment.',
  },
  {
    name: 'Push to Fulfillment',
    description: 'Send selected backer orders to your connected fulfillment partner (Shopify, ShipStation, etc.). Orders must have complete surveys and locked addresses.',
    tips: 'Push orders in batches rather than all at once to catch any issues before committing everything.',
  },
  {
    name: 'Export Backers',
    description: 'Download your backer list as a CSV file for use in external tools, shipping labels, or record keeping.',
    tips: 'Export includes all backer data including addresses, rewards, and custom survey responses.',
  },
];

// Projects Tab fields
const projectsFields: FieldInfo[] = [
  {
    name: 'Project List',
    description: 'View all your projects in one place. Each project card shows the title, status, funding amount, and quick stats.',
    tips: 'Use this to quickly compare progress across multiple projects.',
  },
  {
    name: 'Select Active Project',
    description: 'Click a project card to set it as the active project for IndieKit. All tabs will then show data for that specific project.',
    tips: 'The currently selected project is highlighted with a border and shown in the top project selector.',
  },
  {
    name: 'Project Status',
    description: 'See each project\'s current status: Draft, Submitted, Approved, Live, Funded, or Completed. Status badges are color-coded for quick reference.',
    tips: 'Only Funded or Completed projects have fulfillment data available in IndieKit.',
  },
  {
    name: 'Quick Statistics',
    description: 'Each project card displays key stats: total raised, backer count, fulfillment percentage, and survey completion rate.',
    tips: 'These stats help you prioritize which project needs the most attention.',
  },
];

// Updates Tab fields
const updatesFields: FieldInfo[] = [
  {
    name: 'Create Update',
    description: 'Write project updates to communicate with your backers. Use the rich text editor to add formatting, images, and links.',
    tips: 'Regular updates keep backers engaged and reduce support requests. Aim for at least bi-weekly updates during fulfillment.',
  },
  {
    name: 'Update Visibility',
    description: 'Choose who can see each update: Public (visible to everyone) or Backers Only (visible only to people who backed your project).',
    tips: 'Use Backers Only for fulfillment details and shipping schedules. Use Public for general progress that might attract pre-orders.',
  },
  {
    name: 'Draft & Published States',
    description: 'Save updates as drafts to work on them over time, then publish when ready. Easily switch between draft and published states.',
    tips: 'Write drafts throughout the week and polish before publishing to maintain consistent update quality.',
  },
  {
    name: 'Edit & Delete',
    description: 'Edit published updates to fix typos or add information. Delete updates that are no longer relevant.',
    tips: 'Editing an update doesn\'t re-notify backers, so major changes should be posted as new updates.',
  },
  {
    name: 'Email Notifications',
    description: 'When publishing, choose whether to send email notifications to all backers (or just visible backers for Backers Only updates).',
    tips: 'Not every update needs an email - save email notifications for important announcements.',
  },
  {
    name: 'Comments & Views',
    description: 'Track how many backers have viewed each update and see any comments they\'ve left.',
    tips: 'Low view counts may indicate backers aren\'t checking updates - send a dedicated email reminder.',
  },
];

// Timeline Tab fields
const timelineFields: FieldInfo[] = [
  {
    name: 'Activity Log',
    description: 'Complete chronological history of all fulfillment activities for your project. Every action is logged with timestamps.',
    tips: 'The timeline is your audit trail - invaluable for tracking down when specific events occurred.',
  },
  {
    name: 'Activity Type Filter',
    description: 'Filter events by type: Survey, Payment, Shipping, Digital, Address, or Support. Focus on specific activity categories.',
    tips: 'Filter by "Payment" to quickly review all charge attempts and results.',
  },
  {
    name: 'Date Range Filter',
    description: 'View activities within a specific date range. Useful for reviewing what happened during a particular period.',
    tips: 'Use date filters when investigating support issues to see what happened around the time a backer reported a problem.',
  },
  {
    name: 'Event Types Tracked',
    description: 'The timeline logs: survey reminders sent, survey completions, orders pushed, cards charged/failed, digital downloads, address updates, shipments, refunds, and support interactions.',
    tips: 'Each event includes relevant details like backer email, amounts, and status changes.',
  },
  {
    name: 'Load More',
    description: 'Timeline loads in batches for performance. Click "Load More" to see older events.',
    tips: 'The most recent events are shown first - scroll down or load more to see historical data.',
  },
];

// Support Tab fields
const supportFields: FieldInfo[] = [
  {
    name: 'Backer Search',
    description: 'Search for any backer by name or email to quickly access their information when handling support requests.',
    tips: 'Keep this tab open when responding to support emails for quick reference.',
  },
  {
    name: 'Backer Details',
    description: 'View complete backer information: contact details, pledge amount, rewards, survey responses, shipping address, and fulfillment status.',
    tips: 'This consolidated view helps you answer support questions without switching between tabs.',
  },
  {
    name: 'Internal Notes',
    description: 'Add private notes to any backer record. Notes are only visible to your team, never to backers.',
    tips: 'Document any special requests, issues, or communication history for future reference.',
  },
  {
    name: 'Send Email',
    description: 'Send a direct email to the backer from within IndieKit. Emails are logged in the communication history.',
    tips: 'Use templated responses for common questions to save time while maintaining personalization.',
  },
  {
    name: 'Communication History',
    description: 'View the complete history of emails and interactions with each backer.',
    tips: 'Review history before responding to avoid repeating previous communications.',
  },
  {
    name: 'Order Information',
    description: 'See exactly what the backer ordered, their survey responses, and current fulfillment status all in one place.',
    tips: 'Essential for handling "where\'s my order" inquiries quickly and accurately.',
  },
];

// SKU Mapping Tab fields
const skuMappingFields: FieldInfo[] = [
  {
    name: 'What is SKU Mapping?',
    description: 'SKU Mapping connects your crowdfunding rewards to your Shopify products. This is essential for pushing orders to Shopify for fulfillment.',
    tips: 'Complete SKU mapping before trying to push orders - unmapped items will cause push errors.',
  },
  {
    name: 'Map Rewards',
    description: 'For each reward tier in your campaign, select the corresponding Shopify product SKU. This tells Shopify which product to fulfill.',
    tips: 'Make sure Shopify product SKUs match exactly - case-sensitive matching.',
  },
  {
    name: 'Map Add-ons',
    description: 'Map each add-on item to its Shopify SKU, just like rewards. Add-ons are handled separately from main reward tiers.',
    tips: 'If an add-on has variants, map each variant separately.',
  },
  {
    name: 'Validate Mappings',
    description: 'The validation check verifies all your mappings are correct and the SKUs exist in Shopify. Green checkmarks indicate valid mappings.',
    tips: 'Always validate after making changes to catch errors before pushing orders.',
  },
  {
    name: 'Skip Items',
    description: 'For items that shouldn\'t be fulfilled through Shopify (like digital downloads), mark them as "Skip" so they don\'t cause errors.',
    tips: 'Digital files should always be marked as skip since they\'re handled by the Digital tab.',
  },
  {
    name: 'Product Name Verification',
    description: 'When you enter a SKU, the system shows the Shopify product name so you can verify you\'ve selected the correct product.',
    tips: 'Double-check product names to avoid shipping the wrong items.',
  },
];

// Packages Tab fields
const packagesFields: FieldInfo[] = [
  {
    name: 'Package List',
    description: 'View all backer orders grouped as packages ready for fulfillment. Each package represents one shipment.',
    tips: 'Packages are created from locked orders - unlock orders if you need to make changes.',
  },
  {
    name: 'Status Filter',
    description: 'Filter packages by status: All, Ready, Pushed, Shipped, or Errored. Focus on packages at specific fulfillment stages.',
    tips: 'Check "Errored" regularly to address any fulfillment issues that need attention.',
  },
  {
    name: 'Segment Filter',
    description: 'Filter packages by backer segment if you\'ve created segments. Useful for shipping different reward tiers at different times.',
    tips: 'Ship your simplest rewards first to work out any process issues before tackling complex orders.',
  },
  {
    name: 'Group Packages',
    description: 'Group multiple packages together for efficient batch processing. Grouped packages can be pushed to fulfillment together.',
    tips: 'Group by shipping destination or reward type for more efficient warehouse picking.',
  },
  {
    name: 'Push to Fulfillment',
    description: 'Send packages to your connected fulfillment service (Shopify, ShipStation, Shippo, etc.). This creates orders in your fulfillment system.',
    tips: 'Push in batches and verify the first batch arrives correctly before pushing more.',
  },
  {
    name: 'Fulfillment Services',
    description: 'Connect to fulfillment partners: Shopify, ShipStation, Shippo, EasyPost, or Stamps.com. Each service has its own connection settings.',
    tips: 'Set up your fulfillment service connection in the Settings tab before trying to push packages.',
  },
  {
    name: 'Track Shipments',
    description: 'View tracking numbers and shipment status for packages that have been pushed. Track deliveries directly from IndieKit.',
    tips: 'Tracking information syncs from your fulfillment service automatically.',
  },
  {
    name: 'Last Refreshed',
    description: 'Shows when package data was last synced from your fulfillment service. Click refresh to pull the latest status.',
    tips: 'Refresh after making changes in your fulfillment service to see updated statuses.',
  },
];

// Products Tab fields
const productsFields: FieldInfo[] = [
  {
    name: 'Product List',
    description: 'View all physical products associated with your project. Products are derived from your reward tiers and add-ons.',
    tips: 'This list should match what you\'ll be shipping to backers.',
  },
  {
    name: 'Product Details',
    description: 'See product specifications including name, description, images, and variants if applicable.',
    tips: 'Keep product information accurate for proper fulfillment.',
  },
  {
    name: 'Inventory Link',
    description: 'Products can be linked to your Shopify inventory through SKU Mapping for unified inventory management.',
    tips: 'Accurate inventory helps prevent overselling and fulfillment issues.',
  },
  {
    name: 'Product Categorization',
    description: 'Products are categorized by their source: Reward Tiers, Add-ons, or Stretch Goals.',
    tips: 'Use categories to organize your fulfillment process by product type.',
  },
];

// Shipping Tab fields
const shippingFields: FieldInfo[] = [
  {
    name: 'Shipping Zones',
    description: 'Define geographic regions for shipping: US, Canada, EU, UK, Australia, Rest of World, etc. Each zone can have different rates.',
    tips: 'Create zones that match your actual shipping rate structures.',
  },
  {
    name: 'Base Rates',
    description: 'Set the base shipping cost for each zone. This is the minimum shipping charge for any order to that destination.',
    tips: 'Research actual carrier rates to set realistic base prices.',
  },
  {
    name: 'Per-Item Costs',
    description: 'Add additional charges per item shipped. Useful when shipping multiple items significantly increases costs.',
    tips: 'Consider package size limits - sometimes multiple packages are cheaper than one large one.',
  },
  {
    name: 'Weight-Based Tiers',
    description: 'Create weight-based shipping tiers for more accurate pricing based on order weight.',
    tips: 'Weigh your products to determine accurate tier thresholds.',
  },
  {
    name: 'Free Shipping Thresholds',
    description: 'Set order minimums for free shipping. Encourage larger orders by offering free shipping above a certain amount.',
    tips: 'Set thresholds just above your average order value to encourage upsells.',
  },
  {
    name: 'Customs Requirements',
    description: 'Configure customs declaration requirements for international zones. Some regions require specific documentation.',
    tips: 'Include accurate HS codes and product values for smooth customs clearance.',
  },
  {
    name: 'Edit & Delete Zones',
    description: 'Modify zone settings or remove zones you don\'t need. Changes apply to future calculations.',
    tips: 'Back up your shipping configuration before making major changes.',
  },
];

// Digital Tab fields
const digitalFields: FieldInfo[] = [
  {
    name: 'Upload Files',
    description: 'Upload digital files (PDFs, ebooks, audio, images, etc.) that will be distributed to backers. Files are securely stored and served.',
    tips: 'Compress files when possible to improve download speeds for backers.',
  },
  {
    name: 'File Management',
    description: 'View, rename, or delete uploaded files. See file sizes and upload dates.',
    tips: 'Use clear, descriptive filenames so backers know what they\'re downloading.',
  },
  {
    name: 'Distribution Rules',
    description: 'Create rules that determine which backers get which files. Rules can be based on reward tier, add-ons purchased, or specific segments.',
    tips: 'Test distribution rules with a small group before sending to all backers.',
  },
  {
    name: 'Rule Criteria',
    description: 'Rules can use multiple criteria: reward tier, specific add-on purchase, backer segment, or all backers.',
    tips: 'More specific rules take precedence over general rules.',
  },
  {
    name: 'Send Blast',
    description: 'Notify all eligible backers that their digital files are available. Sends an email with download links.',
    tips: 'Only send the blast when all files are uploaded and rules are configured correctly.',
  },
  {
    name: 'Download Links',
    description: 'Each backer gets unique, secure download links. Links can be time-limited or unlimited.',
    tips: 'Unique links help prevent unauthorized sharing of your content.',
  },
  {
    name: 'Download Tracking',
    description: 'See which backers have downloaded their files and how many times. Monitor distribution success.',
    tips: 'Follow up with backers who haven\'t downloaded after a reasonable time.',
  },
  {
    name: 'Email Notifications',
    description: 'Configure automatic email notifications when new files become available for a backer.',
    tips: 'Include clear instructions in the email about how to access downloads.',
  },
];

// Add-ons Tab fields
const addonsFields: FieldInfo[] = [
  {
    name: 'Create Add-ons',
    description: 'Create optional extras that backers can purchase during the survey process. Add-ons appear alongside their reward selection.',
    tips: 'Popular add-ons: extra copies, exclusive variants, accessories, and complementary products.',
  },
  {
    name: 'Add-on Details',
    description: 'Configure each add-on with: title, description, price, image, quantity limits, and availability settings.',
    tips: 'High-quality images significantly increase add-on sales.',
  },
  {
    name: 'Duplicate Add-ons',
    description: 'Copy an existing add-on to quickly create variations. All fields are duplicated and can be edited.',
    tips: 'Use duplicate when creating size or color variants of the same product.',
  },
  {
    name: 'Pricing',
    description: 'Set prices for each add-on. Prices can be adjusted at any time before backers purchase.',
    tips: 'Add-ons are typically priced slightly higher than campaign equivalents since they\'re extras.',
  },
  {
    name: 'Sales Tracking',
    description: 'View total add-on revenue, number of backers who purchased add-ons, and total add-on items sold.',
    tips: 'Track which add-ons are most popular to inform future campaign planning.',
  },
  {
    name: 'Activate/Deactivate',
    description: 'Toggle add-ons on or off. Inactive add-ons aren\'t shown to backers but their data is preserved.',
    tips: 'Deactivate add-ons when inventory runs out rather than deleting them.',
  },
  {
    name: 'Inventory Management',
    description: 'Set quantity limits for add-ons. The system automatically stops sales when inventory is depleted.',
    tips: 'Set conservative limits and increase if demand exceeds expectations.',
  },
];

// Pre-Orders Tab fields
const preordersFields: FieldInfo[] = [
  {
    name: 'Pre-Order Overview',
    description: 'Track backers who pledge after your campaign has already funded. Pre-orders are charged immediately since the campaign is guaranteed.',
    tips: 'Pre-orders can significantly increase your total funding - promote them actively.',
  },
  {
    name: 'Pre-Order Backers',
    description: 'View all backers who joined via pre-order, separate from campaign backers. Same backer management features apply.',
    tips: 'Pre-order backers may have different fulfillment timelines than campaign backers.',
  },
  {
    name: 'Separate Tracking',
    description: 'Pre-order fulfillment is tracked separately from campaign fulfillment. This helps manage different shipping waves.',
    tips: 'Consider fulfilling pre-orders in a separate wave after campaign backers.',
  },
  {
    name: 'Pre-Order Statistics',
    description: 'See dedicated stats for pre-orders: total raised, backer count, and popular reward tiers.',
    tips: 'Compare pre-order vs campaign data to understand different customer behaviors.',
  },
];

// Inbox Tab fields
const inboxFields: FieldInfo[] = [
  {
    name: 'Message Center',
    description: 'Central hub for all backer messages and support conversations. Similar to an email inbox but integrated with backer data.',
    tips: 'Check your inbox daily during active fulfillment to maintain good response times.',
  },
  {
    name: 'Conversation Threads',
    description: 'Messages are organized by conversation thread with each backer. View the full history in context.',
    tips: 'Thread context helps you give consistent responses without asking backers to repeat themselves.',
  },
  {
    name: 'Reply Options',
    description: 'Reply directly to messages. Your reply is sent to the backer\'s email and logged in the conversation.',
    tips: 'Keep responses professional but friendly - backers appreciate personal attention.',
  },
  {
    name: 'Status Filters',
    description: 'Filter messages by status: Unread, Read, Replied, or Archived. Focus on what needs attention.',
    tips: 'Archive conversations only after fully resolving the issue.',
  },
  {
    name: 'Star Important',
    description: 'Star conversations that need follow-up or special attention. Starred items are easy to find later.',
    tips: 'Star messages that require action you can\'t take immediately.',
  },
  {
    name: 'Compose New',
    description: 'Start a new conversation with any backer. Search by name or email to find the recipient.',
    tips: 'Use compose for proactive outreach about specific issues.',
  },
  {
    name: 'Backer Context',
    description: 'While viewing a message, see the backer\'s pledge info, survey status, and fulfillment status alongside.',
    tips: 'Context helps you understand and resolve issues faster.',
  },
];

// Emails Tab fields
const emailsFields: FieldInfo[] = [
  {
    name: 'Campaign Templates',
    description: 'Pre-built email templates for common campaign communications: launch announcements, survey reminders, shipping updates, thank you messages, and more.',
    tips: 'Start with templates and customize for your project\'s voice.',
  },
  {
    name: 'Template Categories',
    description: 'Templates organized by campaign phase: Before Launch, Campaign Active, Surveys, Shipping, and Post-Campaign.',
    tips: 'Use the appropriate category to find relevant templates quickly.',
  },
  {
    name: 'Custom Email Composition',
    description: 'Create completely custom emails using the rich text editor. Add formatting, links, and images.',
    tips: 'Keep emails concise and scannable - most people skim rather than read thoroughly.',
  },
  {
    name: 'Segment Targeting',
    description: 'Send emails to specific backer segments: all backers, specific reward tiers, backers with incomplete surveys, etc.',
    tips: 'Targeted emails have higher engagement than blanket broadcasts.',
  },
  {
    name: 'Schedule Emails',
    description: 'Schedule emails to send at a future date and time. Perfect for coordinating announcements with other activities.',
    tips: 'Send important emails Tuesday-Thursday for best open rates.',
  },
  {
    name: 'Preview & Test',
    description: 'Preview emails before sending and send test emails to yourself to verify formatting and links.',
    tips: 'Always send a test email first - broken links and typos happen.',
  },
  {
    name: 'Track Performance',
    description: 'See email open rates and click rates. Monitor which emails resonate with your backers.',
    tips: 'Low open rates? Try different subject lines. Low clicks? Improve your call-to-action.',
  },
];

// Email List Tab fields
const emailListFields: FieldInfo[] = [
  {
    name: 'Subscriber List',
    description: 'View all email addresses in your campaign list, including backers and followers who signed up via your prelaunch page.',
    tips: 'Your email list is a valuable asset - treat it with care.',
  },
  {
    name: 'Export List',
    description: 'Download your email list as a CSV for use in external email marketing tools.',
    tips: 'Export before major campaigns to have a backup.',
  },
  {
    name: 'Filter Active/Inactive',
    description: 'Filter between active subscribers and those who have unsubscribed or bounced.',
    tips: 'Remove bounced emails to improve deliverability of future campaigns.',
  },
  {
    name: 'Import External Lists',
    description: 'Import email addresses from other sources to add to your campaign communications.',
    tips: 'Only import emails from people who have opted in to hear from you.',
  },
];

// Teaser Pages Tab fields
const teaserPagesFields: FieldInfo[] = [
  {
    name: 'Create Teaser Page',
    description: 'Build a prelaunch page to generate interest before your campaign goes live. Collect email signups from potential backers.',
    tips: 'Launch your teaser page 2-4 weeks before campaign launch to build momentum.',
  },
  {
    name: 'Follower Collection',
    description: 'Capture email addresses from interested visitors. These become your launch-day audience.',
    tips: 'Offer an incentive (early-bird pricing, exclusive reward) to encourage signups.',
  },
  {
    name: 'Page Customization',
    description: 'Customize your teaser page content: title, description, images, and call-to-action.',
    tips: 'Show enough to generate interest but leave them wanting more.',
  },
  {
    name: 'Track Followers',
    description: 'See how many people have followed your project and when they signed up.',
    tips: 'Growing follower count indicates strong launch-day potential.',
  },
  {
    name: 'Manage Visibility',
    description: 'Control when your teaser page is visible. Hide it after campaign launch if desired.',
    tips: 'Keep teaser pages active for SEO benefit even after launch.',
  },
];

// Segments Tab fields
const segmentsFields: FieldInfo[] = [
  {
    name: 'Create Segments',
    description: 'Group backers by shared characteristics for targeted actions. Segments are dynamic - backers are automatically added when they match criteria.',
    tips: 'Well-defined segments make fulfillment and communication much more efficient.',
  },
  {
    name: 'Segment Types',
    description: 'Available segment criteria: Pledge Level, Add-on Purchase, Survey Status, Shipping Region, Payment Status, or Custom criteria.',
    tips: 'Combine multiple criteria for highly specific segments.',
  },
  {
    name: 'View Segment Members',
    description: 'See all backers currently in each segment. List updates automatically as backers match or unmatch criteria.',
    tips: 'Review segment membership before taking bulk actions.',
  },
  {
    name: 'Email Segments',
    description: 'Send targeted emails to specific segments. Essential for relevant communication that doesn\'t annoy unrelated backers.',
    tips: 'Segment-specific updates have higher engagement than broadcast emails.',
  },
  {
    name: 'Duplicate Segments',
    description: 'Copy an existing segment to create variations with similar criteria.',
    tips: 'Duplicate when creating related segments like "US Backers" and "Canada Backers".',
  },
  {
    name: 'Segment for Fulfillment',
    description: 'Use segments to organize fulfillment waves: ship one segment at a time for manageable batches.',
    tips: 'Segment by simplest rewards first to work out process issues.',
  },
];

// Counts Tab fields
const countsFields: FieldInfo[] = [
  {
    name: 'Total Backers',
    description: 'The complete count of all backers for your project, including campaign backers and pre-orders.',
    tips: 'Compare to your campaign goal to measure success.',
  },
  {
    name: 'Surveys Completed',
    description: 'Number and percentage of backers who have completed their surveys.',
    tips: 'Aim for 90%+ survey completion before starting fulfillment.',
  },
  {
    name: 'Pre-Order Backers',
    description: 'Count of backers who pledged after the campaign funded (pre-orders).',
    tips: 'Track pre-order growth to measure ongoing demand.',
  },
  {
    name: 'Add-on Statistics',
    description: 'Backers with add-ons, total add-on items sold, and total add-on revenue.',
    tips: 'Calculate average add-on value per backer to gauge upsell effectiveness.',
  },
  {
    name: 'Pledge Level Breakdown',
    description: 'Distribution chart showing how many backers selected each reward tier.',
    tips: 'Identify your most popular tiers for future campaign planning.',
  },
  {
    name: 'Survey Status Breakdown',
    description: 'Breakdown of survey statuses: Not Started, In Progress, Completed.',
    tips: 'Focus outreach on "Not Started" backers first.',
  },
  {
    name: 'Shipping Region Breakdown',
    description: 'Distribution of backers by shipping destination. Helps plan international fulfillment.',
    tips: 'Consider shipping by region to optimize carrier relationships.',
  },
  {
    name: 'Payment Status Breakdown',
    description: 'Overview of payment statuses: Pending, Charged, Failed, Refunded.',
    tips: 'Address failed payments promptly to recover lost pledges.',
  },
];

// Export Tab fields
const exportFields: FieldInfo[] = [
  {
    name: 'Export Backers',
    description: 'Download complete backer data including contact info, pledges, rewards, and fulfillment status.',
    tips: 'Export regularly as a backup of your backer data.',
  },
  {
    name: 'Export Surveys',
    description: 'Download all survey responses in a structured format.',
    tips: 'Use survey exports to identify custom requests or special instructions.',
  },
  {
    name: 'Export Shipping',
    description: 'Download shipping addresses formatted for your fulfillment workflow or label printing.',
    tips: 'Verify address format matches your shipping label requirements.',
  },
  {
    name: 'Export Add-ons',
    description: 'Download add-on purchase data showing which backers bought which extras.',
    tips: 'Cross-reference with fulfillment to ensure add-ons are included.',
  },
  {
    name: 'Export Fulfillment Status',
    description: 'Download current fulfillment status for all backers - useful for tracking and reporting.',
    tips: 'Export before and after fulfillment waves to track progress.',
  },
  {
    name: 'Format Options',
    description: 'Choose between CSV or Excel format for your exports.',
    tips: 'CSV works with more tools; Excel preserves formatting and formulas.',
  },
  {
    name: 'Download History',
    description: 'See previous exports and re-download if needed.',
    tips: 'Keep exports organized by date for version control.',
  },
];

// Survey Builder Tab fields
const surveyBuilderFields: FieldInfo[] = [
  {
    name: 'Drag-and-Drop Builder',
    description: 'Visually build your survey by dragging question types into the order you want. Reorder anytime before publishing.',
    tips: 'Put the most important questions first in case backers abandon mid-survey.',
  },
  {
    name: 'Question Types',
    description: 'Available types: Short Text, Long Text, Single Select, Multiple Select, Address, Email, Phone, Date, Number, and File Upload.',
    tips: 'Use the most appropriate type - it affects validation and data quality.',
  },
  {
    name: 'Required vs Optional',
    description: 'Mark questions as required or optional. Required questions must be answered before survey submission.',
    tips: 'Only require what you truly need - too many required questions increases abandonment.',
  },
  {
    name: 'Help Text',
    description: 'Add explanatory text below any question to guide backers on how to answer.',
    tips: 'Good help text reduces support questions and improves response quality.',
  },
  {
    name: 'Item-Specific Questions',
    description: 'Add questions that only appear for backers who selected specific rewards. Perfect for customization options.',
    tips: 'Use for size/color selection, personalization, or tier-specific preferences.',
  },
  {
    name: 'Variants',
    description: 'Create variant options (size, color, material) for rewards. Backers select their preference during survey.',
    tips: 'Define variants clearly - "Small, Medium, Large" not "S, M, L" for clarity.',
  },
  {
    name: 'Conditional Logic',
    description: 'Show or hide questions based on previous answers. Creates a dynamic, personalized survey experience.',
    tips: 'Use sparingly - complex logic can confuse backers.',
  },
  {
    name: 'Preview Survey',
    description: 'See exactly what backers will see before publishing your survey.',
    tips: 'Always preview and test before sending to backers.',
  },
];

// Manage Survey Tab fields
const manageSurveyFields: FieldInfo[] = [
  {
    name: 'Survey Status',
    description: 'See your survey\'s current state: Draft, Active, or Closed. Control when backers can access it.',
    tips: 'Keep surveys open until you\'re ready to ship - late responders happen.',
  },
  {
    name: 'Completion Rates',
    description: 'View what percentage of backers have completed the survey, with detailed breakdowns.',
    tips: 'Rates below 80% need active reminder campaigns.',
  },
  {
    name: 'Send Reminders',
    description: 'Send bulk reminders to backers who haven\'t completed their survey. Customize reminder messaging.',
    tips: 'Send weekly reminders, increasing frequency as deadline approaches.',
  },
  {
    name: 'View Responses',
    description: 'See individual survey responses from each backer. Review custom answers and special requests.',
    tips: 'Flag unusual responses for manual review during fulfillment.',
  },
  {
    name: 'Edit After Launch',
    description: 'Make changes to the survey even after backers have started responding. Be careful - changes affect data consistency.',
    tips: 'Only edit for critical fixes - adding questions mid-survey creates incomplete data.',
  },
  {
    name: 'Toggle Survey On/Off',
    description: 'Temporarily disable survey access if needed. Backers will see a message that survey is currently closed.',
    tips: 'Close surveys during fulfillment to prevent last-minute changes.',
  },
  {
    name: 'Export Responses',
    description: 'Download all survey responses for offline analysis or fulfillment processing.',
    tips: 'Export before starting fulfillment for your packing reference.',
  },
];

// Settings Tab fields
const settingsFields: FieldInfo[] = [
  {
    name: 'General Settings',
    description: 'Configure project basics: name, currency, and timezone. These affect how data is displayed throughout IndieKit.',
    tips: 'Set timezone to your warehouse location for accurate fulfillment scheduling.',
  },
  {
    name: 'Survey Settings',
    description: 'Configure survey behavior: reminder frequency, deadline dates, and confirmation messages.',
    tips: 'Set a firm deadline and communicate it clearly to improve completion rates.',
  },
  {
    name: 'Shipping Defaults',
    description: 'Set default shipping zones and rates that apply to new configurations.',
    tips: 'Configure defaults based on your most common shipping scenario.',
  },
  {
    name: 'Payment Settings',
    description: 'Configure payment processor settings, fee handling, and charge timing.',
    tips: 'Review payment settings before charging cards to avoid surprises.',
  },
  {
    name: 'Notification Preferences',
    description: 'Control which email notifications you receive: new pledges, survey completions, support messages, etc.',
    tips: 'Enable notifications you\'ll act on; disable noise.',
  },
  {
    name: 'Shopify Integration',
    description: 'Connect your Shopify store for inventory sync and order fulfillment. Requires Shopify API credentials.',
    tips: 'Test the connection with a single order before bulk pushing.',
  },
  {
    name: 'ShipStation Integration',
    description: 'Connect ShipStation for shipping label generation and carrier rate shopping.',
    tips: 'ShipStation works well for multi-carrier shipping strategies.',
  },
  {
    name: 'Shippo Integration',
    description: 'Connect Shippo for multi-carrier shipping and international fulfillment.',
    tips: 'Shippo offers competitive international shipping rates.',
  },
  {
    name: 'EasyPost Integration',
    description: 'Connect EasyPost for shipping label generation across multiple carriers.',
    tips: 'EasyPost provides a unified API for different carriers.',
  },
  {
    name: 'Team Management',
    description: 'Add team members and set their permissions: view-only, fulfillment, or full admin access.',
    tips: 'Give team members only the access they need for their role.',
  },
];

// Account Tab fields
const accountFields: FieldInfo[] = [
  {
    name: 'Account Profile',
    description: 'View and edit your account information: name, email, and profile picture.',
    tips: 'Keep your contact info current for important platform communications.',
  },
  {
    name: 'Email Settings',
    description: 'Manage your email preferences and notification settings at the account level.',
    tips: 'Use a dedicated email for creator activities to stay organized.',
  },
  {
    name: 'Password Management',
    description: 'Change your account password. Use a strong, unique password.',
    tips: 'Enable two-factor authentication for better security.',
  },
  {
    name: 'Connected Services',
    description: 'View which third-party services are connected to your account.',
    tips: 'Regularly review and revoke access for services you no longer use.',
  },
  {
    name: 'API Keys',
    description: 'Generate API keys for advanced integrations with external tools.',
    tips: 'Keep API keys secure - they provide full access to your account.',
  },
  {
    name: 'Account Security',
    description: 'Review security settings, login history, and active sessions.',
    tips: 'Check login history periodically for unauthorized access.',
  },
];

// Workflow Sidebar fields
const workflowFields: FieldInfo[] = [
  {
    name: 'Workflow Overview',
    description: 'The left sidebar guides you through the fulfillment process step by step. Complete each step in order for smooth fulfillment.',
    tips: 'The workflow is designed to prevent common fulfillment mistakes - follow it!',
  },
  {
    name: 'Step 1: Send & Remind (Surveys)',
    description: 'First, collect information from backers via surveys. The survey gathers shipping addresses, reward preferences, and custom options.',
    tips: 'Don\'t rush this step - high survey completion is essential for smooth fulfillment.',
  },
  {
    name: 'Step 2: Lock Orders',
    description: 'Once surveys are collected, lock orders to prevent further changes. This finalizes what each backer will receive.',
    tips: 'Only lock when you\'re confident survey responses are final.',
  },
  {
    name: 'Step 3: Charge Cards',
    description: 'Process additional payments for add-ons or shipping costs collected via survey. Cards are charged in bulk.',
    tips: 'Review charge preview carefully before processing - charges cannot be easily reversed.',
  },
  {
    name: 'Step 4: Lock Addresses',
    description: 'Lock shipping addresses after verification. Prevents backers from making last-minute address changes.',
    tips: 'Send a "last chance to update address" email before locking.',
  },
  {
    name: 'Step 5: Start Shipping',
    description: 'Push orders to your fulfillment partner. This creates orders in Shopify, ShipStation, or your chosen service.',
    tips: 'Start with a small batch to verify everything works correctly.',
  },
  {
    name: 'Step 6: Mark Shipped',
    description: 'As packages ship, mark them complete. Backers receive shipping notifications with tracking info.',
    tips: 'Update promptly - backers appreciate knowing their order is on the way.',
  },
  {
    name: 'Workflow Status Badges',
    description: 'Each step shows its status: Pending (not started), In Progress (active), Completed (done), or Locked (waiting for previous step).',
    tips: 'Locked steps unlock automatically when prerequisites are met.',
  },
  {
    name: 'Action Count Badges',
    description: 'Steps show a count of items requiring action: surveys pending, cards to charge, orders to ship, etc.',
    tips: 'Work to drive all counts to zero for full fulfillment.',
  },
];

function FieldCard({ field }: { field: FieldInfo }) {
  return (
    <div className="rounded-lg border border-border bg-card/80 backdrop-blur-sm p-5 hover:shadow-lg transition-all duration-300">
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{field.name}</h4>
        {field.required !== undefined && (
          field.required ? (
            <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
              <AlertCircle className="h-3 w-3" />
              Required
            </span>
          ) : (
            <span className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
              Optional
            </span>
          )
        )}
      </div>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{field.description}</p>
      {field.tips && (
        <div className="mt-3 flex gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 p-3">
          <Info className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
          <p className="text-sm text-emerald-800 dark:text-emerald-300">{field.tips}</p>
        </div>
      )}
    </div>
  );
}

function SectionHeader({ title, description, icon: Icon }: { title: string; description: string; icon?: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
            <Icon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        )}
        <h3 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{title}</h3>
      </div>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">{description}</p>
    </div>
  );
}

export default function IndieKitHandbookPage() {
  const [activeTab, setActiveTab] = useState('getting-started');

  const tabContent: Record<string, { title: string; description: string; icon: React.ComponentType<{ className?: string }>; fields: FieldInfo[] }> = {
    'getting-started': { title: 'Getting Started with IndieKit', description: 'Learn the basics of IndieKit and how to navigate the fulfillment system.', icon: Sparkles, fields: gettingStartedFields },
    'overview': { title: 'Overview Tab', description: 'Your fulfillment dashboard with key metrics, activity timeline, and next actions.', icon: LayoutDashboard, fields: overviewFields },
    'backers': { title: 'Backers Tab', description: 'Manage all your project backers, view details, and take fulfillment actions.', icon: Users, fields: backersFields },
    'projects': { title: 'Projects Tab', description: 'Switch between your projects and view quick statistics.', icon: FolderKanban, fields: projectsFields },
    'updates': { title: 'Updates Tab', description: 'Create and publish project updates to communicate with your backers.', icon: FileText, fields: updatesFields },
    'timeline': { title: 'Timeline Tab', description: 'Complete activity log of all fulfillment events for your project.', icon: Clock, fields: timelineFields },
    'support': { title: 'Support Tab', description: 'Handle backer support requests with full context and communication tools.', icon: HeadphonesIcon, fields: supportFields },
    'sku-mapping': { title: 'SKU Mapping Tab', description: 'Connect your crowdfunding rewards to Shopify products for fulfillment.', icon: Link2, fields: skuMappingFields },
    'packages': { title: 'Packages Tab', description: 'Manage shipment packages and push orders to fulfillment services.', icon: Box, fields: packagesFields },
    'products': { title: 'Products Tab', description: 'View all physical products associated with your project.', icon: BoxIcon, fields: productsFields },
    'shipping': { title: 'Shipping Tab', description: 'Configure shipping zones, rates, and fulfillment options.', icon: Truck, fields: shippingFields },
    'digital': { title: 'Digital Tab', description: 'Manage digital file distribution and downloads for backers.', icon: Download, fields: digitalFields },
    'addons': { title: 'Add-ons Tab', description: 'Create and manage optional extras backers can purchase during survey.', icon: ShoppingCart, fields: addonsFields },
    'preorders': { title: 'Pre-Orders Tab', description: 'Track and manage backers who pledge after campaign funding.', icon: TrendingUp, fields: preordersFields },
    'inbox': { title: 'Inbox Tab', description: 'Central message hub for backer communications and support.', icon: Inbox, fields: inboxFields },
    'emails': { title: 'Email Campaigns Tab', description: 'Design and send targeted email campaigns to your backers.', icon: Mail, fields: emailsFields },
    'email-list': { title: 'Email List Tab', description: 'Manage your subscriber and backer email list.', icon: UsersRound, fields: emailListFields },
    'teaser': { title: 'Teaser Pages Tab', description: 'Create prelaunch pages to build audience before campaign launch.', icon: FileText, fields: teaserPagesFields },
    'segments': { title: 'Segments Tab', description: 'Create backer segments for targeted actions and communications.', icon: Layers, fields: segmentsFields },
    'counts': { title: 'Counts Tab', description: 'Statistical overview and breakdowns of your campaign metrics.', icon: BarChart3, fields: countsFields },
    'export': { title: 'Export Tab', description: 'Download campaign data for analysis and fulfillment processing.', icon: FileDown, fields: exportFields },
    'survey-builder': { title: 'Survey Builder Tab', description: 'Create and customize your backer survey with drag-and-drop.', icon: FormInput, fields: surveyBuilderFields },
    'manage-survey': { title: 'Manage Survey Tab', description: 'Administer your survey, send reminders, and view responses.', icon: ClipboardList, fields: manageSurveyFields },
    'settings': { title: 'Settings Tab', description: 'Configure IndieKit project settings and integrations.', icon: Settings, fields: settingsFields },
    'account': { title: 'Account Tab', description: 'Manage your creator account settings and security.', icon: UserCircle, fields: accountFields },
    'workflow': { title: 'Fulfillment Workflow', description: 'Step-by-step guide to the fulfillment process sidebar.', icon: CheckCircle2, fields: workflowFields },
  };

  const currentTab = tabContent[activeTab];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-emerald-500/5 relative overflow-hidden">
      {/* Back Link */}
      <div className="container mx-auto px-4 pt-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Home
        </Link>
      </div>

      {/* Floating Orbs */}
      <div className="floating-orb w-96 h-96 bg-emerald-500/10 -top-48 -right-48" style={{ animationDelay: "0s" }} />
      <div className="floating-orb w-80 h-80 bg-teal-500/10 top-1/3 -left-40" style={{ animationDelay: "2s" }} />
      <div className="floating-orb w-64 h-64 bg-primary/10 bottom-40 right-1/4" style={{ animationDelay: "4s" }} />

      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 py-12 text-center text-white relative overflow-hidden">
        <h1 className="text-4xl font-bold">IndieKit Handbook</h1>
        <p className="mt-2 text-emerald-100">
          Complete guide to fulfillment and backer management
        </p>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Tab Navigation - Scrollable */}
        <div className="mb-8 overflow-x-auto">
          <div className="flex flex-wrap gap-2 rounded-xl bg-card/80 backdrop-blur-sm p-2 shadow-sm border border-border min-w-max">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {currentTab && (
            <>
              <SectionHeader
                title={currentTab.title}
                description={currentTab.description}
                icon={currentTab.icon}
              />
              <div className="grid gap-4 md:grid-cols-2">
                {currentTab.fields.map((field) => (
                  <FieldCard key={field.name} field={field} />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Quick Links Section */}
        <div className="mt-16 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-500 p-8 text-white">
          <h3 className="text-2xl font-bold mb-4">Ready to Start Fulfilling?</h3>
          <p className="text-emerald-100 mb-6">
            Access IndieKit from your Creator Dashboard to begin managing your campaign fulfillment.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/dashboard/indiekit"
              className="inline-flex items-center gap-2 rounded-lg bg-white text-emerald-600 px-6 py-3 font-medium hover:bg-emerald-50 transition-colors"
            >
              <LayoutDashboard className="h-5 w-5" />
              Open IndieKit
            </Link>
            <Link
              href="/creator-handbook"
              className="inline-flex items-center gap-2 rounded-lg border border-white/30 text-white px-6 py-3 font-medium hover:bg-white/10 transition-colors"
            >
              <FileText className="h-5 w-5" />
              Creator Handbook
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
