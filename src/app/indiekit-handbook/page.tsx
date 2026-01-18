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

const tabContent: Record<string, { title: string; description: string; fields: FieldInfo[] }> = {
  'getting-started': {
    title: 'Getting Started with IndieKit',
    description: 'Learn the basics of IndieKit and how to navigate the fulfillment system.',
    fields: [
      { name: 'What is IndieKit?', description: 'IndieKit is your complete fulfillment and project management system for managing crowdfunding campaigns from collection through fulfillment.', tips: 'Access IndieKit from your Creator Dashboard after your campaign is funded.' },
      { name: 'When to Use IndieKit', description: 'IndieKit becomes available after your campaign funds. Use it for survey collection, add-on sales, digital distribution, shipping, and backer communications.', tips: 'Set up your survey and add-ons early for smoother fulfillment.' },
      { name: 'Project Selection', description: 'Use the project selector dropdown to switch between multiple projects. Each project has separate fulfillment data.', tips: 'Your last selected project is remembered.' },
      { name: 'Workflow Sidebar', description: 'The left sidebar shows your fulfillment workflow: Surveys → Lock Orders → Charge Cards → Lock Addresses → Start Shipping → Shipped.', tips: 'Complete steps in order for best results.' },
      { name: 'Quick Stats Sidebar', description: 'The right sidebar displays fulfillment progress, survey completion rates, and a feedback button.', tips: 'Monitor these stats daily during active fulfillment.' },
    ]
  },
  'overview': {
    title: 'Overview Tab',
    description: 'Your fulfillment dashboard with key metrics and next actions.',
    fields: [
      { name: 'What\'s Next Banner', description: 'Contextual action banner guiding you to your next important task based on fulfillment state.', tips: 'Shows survey reminders, shipping actions, or completion summary.' },
      { name: 'Total Raised Breakdown', description: 'See total funds split between campaign pledges and pre-order sales.', tips: 'Pre-order funds tracked separately.' },
      { name: 'Fulfillment Status Flow', description: 'Visual breakdown: Not Pushed, Pushed, and Shipped statuses.', tips: 'Move backers through each status efficiently.' },
      { name: 'Key Metrics Cards', description: 'Stats for Total Backers, Surveys Completed, Add-ons Purchased, and Orders Fulfilled.', tips: 'Click cards to navigate to relevant tabs.' },
      { name: 'Recent Activity Timeline', description: 'Live feed of survey completions, orders pushed, shipments, and more.', tips: 'Review daily during active fulfillment.' },
    ]
  },
  'backers': {
    title: 'Backers Tab',
    description: 'Manage all project backers and take fulfillment actions.',
    fields: [
      { name: 'Backer Search', description: 'Search backers by name or email address.', tips: 'Use partial matches to find backers quickly.' },
      { name: 'Status Filter', description: 'Filter by: All, Not Pushed, Push Errored, Pushed, or Shipped.', tips: 'Check "Push Errored" regularly for issues.' },
      { name: 'Bulk Selection', description: 'Select multiple backers for batch operations.', tips: 'Combine filters with bulk selection for targeted actions.' },
      { name: 'Backer Detail View', description: 'View contact info, pledge amount, rewards, add-ons, survey responses, and shipping address.', tips: 'One-stop shop for backer information.' },
      { name: 'Push to Fulfillment', description: 'Send orders to connected fulfillment partners (Shopify, ShipStation, etc.).', tips: 'Push in batches to catch issues early.' },
    ]
  },
  'projects': {
    title: 'Projects Tab',
    description: 'Switch between projects and view statistics.',
    fields: [
      { name: 'Project List', description: 'View all your projects with title, status, and quick stats.', tips: 'Compare progress across projects.' },
      { name: 'Select Active Project', description: 'Click a project to set it as active for IndieKit.', tips: 'Currently selected project is highlighted.' },
      { name: 'Project Status', description: 'See status: Draft, Submitted, Approved, Live, Funded, or Completed.', tips: 'Only Funded/Completed projects have fulfillment data.' },
    ]
  },
  'updates': {
    title: 'Updates Tab',
    description: 'Create and publish project updates for backers.',
    fields: [
      { name: 'Create Update', description: 'Write updates with rich text formatting, images, and links.', tips: 'Post bi-weekly updates during fulfillment.' },
      { name: 'Update Visibility', description: 'Choose Public or Backers Only visibility.', tips: 'Use Backers Only for fulfillment details.' },
      { name: 'Draft & Published', description: 'Save drafts and publish when ready.', tips: 'Write drafts throughout the week.' },
      { name: 'Email Notifications', description: 'Choose whether to email backers when publishing.', tips: 'Save email notifications for important announcements.' },
    ]
  },
  'timeline': {
    title: 'Timeline Tab',
    description: 'Complete activity log of fulfillment events.',
    fields: [
      { name: 'Activity Log', description: 'Chronological history of all fulfillment activities with timestamps.', tips: 'Your audit trail for tracking events.' },
      { name: 'Activity Type Filter', description: 'Filter by: Survey, Payment, Shipping, Digital, Address, Support.', tips: 'Filter by "Payment" to review charge attempts.' },
      { name: 'Date Range Filter', description: 'View activities within specific date ranges.', tips: 'Use when investigating support issues.' },
    ]
  },
  'support': {
    title: 'Support Tab',
    description: 'Handle backer support requests.',
    fields: [
      { name: 'Backer Search', description: 'Find any backer by name or email for support.', tips: 'Keep open when handling support emails.' },
      { name: 'Internal Notes', description: 'Add private notes visible only to your team.', tips: 'Document special requests and issues.' },
      { name: 'Send Email', description: 'Email backers directly from IndieKit.', tips: 'Use templates for common questions.' },
      { name: 'Communication History', description: 'View complete interaction history with each backer.', tips: 'Review before responding.' },
    ]
  },
  'sku-mapping': {
    title: 'SKU Mapping Tab',
    description: 'Connect rewards to Shopify products.',
    fields: [
      { name: 'What is SKU Mapping?', description: 'Connects crowdfunding rewards to Shopify products for fulfillment.', tips: 'Complete before pushing orders.' },
      { name: 'Map Rewards', description: 'Select corresponding Shopify SKU for each reward tier.', tips: 'SKUs are case-sensitive.' },
      { name: 'Map Add-ons', description: 'Map each add-on to its Shopify SKU.', tips: 'Map variants separately.' },
      { name: 'Validate Mappings', description: 'Verify all mappings are correct and SKUs exist.', tips: 'Always validate after changes.' },
      { name: 'Skip Items', description: 'Mark digital items as "Skip" for Shopify fulfillment.', tips: 'Digital files handled by Digital tab.' },
    ]
  },
  'packages': {
    title: 'Packages Tab',
    description: 'Manage shipments and fulfillment services.',
    fields: [
      { name: 'Package List', description: 'View backer orders grouped as packages for fulfillment.', tips: 'Packages created from locked orders.' },
      { name: 'Status Filter', description: 'Filter: All, Ready, Pushed, Shipped, or Errored.', tips: 'Check "Errored" regularly.' },
      { name: 'Push to Fulfillment', description: 'Send packages to Shopify, ShipStation, Shippo, etc.', tips: 'Push in batches and verify first batch.' },
      { name: 'Track Shipments', description: 'View tracking numbers and delivery status.', tips: 'Tracking syncs automatically.' },
    ]
  },
  'products': {
    title: 'Products Tab',
    description: 'View physical products in your project.',
    fields: [
      { name: 'Product List', description: 'All products from reward tiers and add-ons.', tips: 'Should match what you\'re shipping.' },
      { name: 'Product Details', description: 'Name, description, images, and variants.', tips: 'Keep information accurate.' },
      { name: 'Inventory Link', description: 'Link to Shopify inventory via SKU Mapping.', tips: 'Accurate inventory prevents overselling.' },
    ]
  },
  'shipping': {
    title: 'Shipping Tab',
    description: 'Configure shipping zones and rates.',
    fields: [
      { name: 'Shipping Zones', description: 'Define regions: US, Canada, EU, UK, Australia, Rest of World.', tips: 'Match your actual rate structures.' },
      { name: 'Base Rates', description: 'Set minimum shipping cost per zone.', tips: 'Research actual carrier rates.' },
      { name: 'Per-Item Costs', description: 'Additional charges per item shipped.', tips: 'Consider package size limits.' },
      { name: 'Free Shipping Thresholds', description: 'Set order minimums for free shipping.', tips: 'Set just above average order value.' },
    ]
  },
  'digital': {
    title: 'Digital Tab',
    description: 'Manage digital file distribution.',
    fields: [
      { name: 'Upload Files', description: 'Upload PDFs, ebooks, audio, images for backer distribution.', tips: 'Compress files for faster downloads.' },
      { name: 'Distribution Rules', description: 'Define which backers get which files based on rewards/segments.', tips: 'Test rules before sending to all.' },
      { name: 'Send Blast', description: 'Notify all eligible backers that files are available.', tips: 'Only send when all files are ready.' },
      { name: 'Download Tracking', description: 'See which backers downloaded and how many times.', tips: 'Follow up with non-downloaders.' },
    ]
  },
  'addons': {
    title: 'Add-ons Tab',
    description: 'Create optional extras for survey purchase.',
    fields: [
      { name: 'Create Add-ons', description: 'Optional extras backers can purchase during survey.', tips: 'Popular: extra copies, variants, accessories.' },
      { name: 'Add-on Details', description: 'Title, description, price, image, quantity limits.', tips: 'Quality images increase sales.' },
      { name: 'Sales Tracking', description: 'Total revenue, backers with add-ons, items sold.', tips: 'Track popularity for future planning.' },
      { name: 'Activate/Deactivate', description: 'Toggle add-ons on or off.', tips: 'Deactivate when inventory runs out.' },
    ]
  },
  'preorders': {
    title: 'Pre-Orders Tab',
    description: 'Track post-funding pledges.',
    fields: [
      { name: 'Pre-Order Overview', description: 'Backers who pledge after funding are charged immediately.', tips: 'Promote pre-orders to increase funding.' },
      { name: 'Pre-Order Backers', description: 'View pre-order backers separately from campaign backers.', tips: 'May have different fulfillment timelines.' },
      { name: 'Separate Tracking', description: 'Pre-order fulfillment tracked separately.', tips: 'Consider shipping in separate waves.' },
    ]
  },
  'inbox': {
    title: 'Inbox Tab',
    description: 'Central message hub for backer communications.',
    fields: [
      { name: 'Message Center', description: 'All backer messages and support conversations.', tips: 'Check daily during fulfillment.' },
      { name: 'Conversation Threads', description: 'Messages organized by thread with full history.', tips: 'Context helps consistent responses.' },
      { name: 'Status Filters', description: 'Filter: Unread, Read, Replied, Archived.', tips: 'Archive only after resolution.' },
      { name: 'Backer Context', description: 'See pledge info and fulfillment status alongside messages.', tips: 'Resolve issues faster with context.' },
    ]
  },
  'emails': {
    title: 'Email Campaigns Tab',
    description: 'Design and send targeted emails.',
    fields: [
      { name: 'Campaign Templates', description: 'Pre-built templates: launch, survey reminders, shipping updates, thank you.', tips: 'Start with templates, then customize.' },
      { name: 'Custom Composition', description: 'Create custom emails with rich text editor.', tips: 'Keep emails concise and scannable.' },
      { name: 'Segment Targeting', description: 'Send to specific segments: all, reward tiers, incomplete surveys.', tips: 'Targeted emails get higher engagement.' },
      { name: 'Schedule & Track', description: 'Schedule emails and track open/click rates.', tips: 'Send Tuesday-Thursday for best rates.' },
    ]
  },
  'email-list': {
    title: 'Email List Tab',
    description: 'Manage subscriber list.',
    fields: [
      { name: 'Subscriber List', description: 'All emails including backers and prelaunch followers.', tips: 'Your email list is valuable - treat it well.' },
      { name: 'Export List', description: 'Download as CSV for external tools.', tips: 'Export before major campaigns.' },
      { name: 'Filter Status', description: 'Filter active vs unsubscribed/bounced.', tips: 'Remove bounced emails for better deliverability.' },
    ]
  },
  'teaser': {
    title: 'Teaser Pages Tab',
    description: 'Create prelaunch pages.',
    fields: [
      { name: 'Create Teaser Page', description: 'Build prelaunch page to collect email signups.', tips: 'Launch 2-4 weeks before campaign.' },
      { name: 'Follower Collection', description: 'Capture emails from interested visitors.', tips: 'Offer incentives for signups.' },
      { name: 'Track Followers', description: 'See follower count and signup timing.', tips: 'Growing count indicates strong launch potential.' },
    ]
  },
  'segments': {
    title: 'Segments Tab',
    description: 'Create backer segments for targeted actions.',
    fields: [
      { name: 'Create Segments', description: 'Group backers by shared characteristics. Dynamic membership.', tips: 'Well-defined segments improve efficiency.' },
      { name: 'Segment Types', description: 'Criteria: Pledge Level, Add-on, Survey Status, Region, Payment Status, Custom.', tips: 'Combine criteria for specific segments.' },
      { name: 'Email Segments', description: 'Send targeted emails to specific segments.', tips: 'Segment emails have higher engagement.' },
      { name: 'Fulfillment Segments', description: 'Organize fulfillment waves by segment.', tips: 'Ship simplest rewards first.' },
    ]
  },
  'counts': {
    title: 'Counts Tab',
    description: 'Statistical overview of campaign metrics.',
    fields: [
      { name: 'Total Backers', description: 'Complete count including campaign and pre-orders.', tips: 'Compare to goals.' },
      { name: 'Surveys Completed', description: 'Number and percentage completed.', tips: 'Aim for 90%+ before fulfillment.' },
      { name: 'Add-on Statistics', description: 'Backers with add-ons, items sold, revenue.', tips: 'Calculate average add-on value per backer.' },
      { name: 'Breakdowns', description: 'Pledge level, survey status, shipping region, payment status.', tips: 'Identify popular tiers and regions.' },
    ]
  },
  'export': {
    title: 'Export Tab',
    description: 'Download campaign data.',
    fields: [
      { name: 'Export Backers', description: 'Complete backer data: contact, pledges, rewards, status.', tips: 'Export regularly as backup.' },
      { name: 'Export Surveys', description: 'All survey responses in structured format.', tips: 'Identify custom requests.' },
      { name: 'Export Shipping', description: 'Addresses formatted for labels.', tips: 'Verify format matches requirements.' },
      { name: 'Format Options', description: 'CSV or Excel format.', tips: 'CSV works with more tools.' },
    ]
  },
  'survey-builder': {
    title: 'Survey Builder Tab',
    description: 'Create backer surveys with drag-and-drop.',
    fields: [
      { name: 'Drag-and-Drop Builder', description: 'Visually build and reorder questions.', tips: 'Important questions first.' },
      { name: 'Question Types', description: 'Short/Long Text, Single/Multiple Select, Address, Email, Phone, Date, Number, File Upload.', tips: 'Use appropriate types for validation.' },
      { name: 'Required vs Optional', description: 'Mark questions as required or optional.', tips: 'Only require what you truly need.' },
      { name: 'Item-Specific Questions', description: 'Questions for specific rewards only.', tips: 'Use for size/color selection.' },
      { name: 'Preview Survey', description: 'See exactly what backers will see.', tips: 'Always preview before publishing.' },
    ]
  },
  'manage-survey': {
    title: 'Manage Survey Tab',
    description: 'Administer surveys and view responses.',
    fields: [
      { name: 'Survey Status', description: 'Draft, Active, or Closed state.', tips: 'Keep open until ready to ship.' },
      { name: 'Completion Rates', description: 'Percentage of backers who completed.', tips: 'Below 80% needs reminders.' },
      { name: 'Send Reminders', description: 'Bulk reminders to incomplete surveys.', tips: 'Weekly, then more frequently near deadline.' },
      { name: 'View Responses', description: 'Individual survey responses from each backer.', tips: 'Flag unusual responses for review.' },
    ]
  },
  'settings': {
    title: 'Settings Tab',
    description: 'Configure IndieKit and integrations.',
    fields: [
      { name: 'General Settings', description: 'Project name, currency, timezone.', tips: 'Set timezone to warehouse location.' },
      { name: 'Survey Settings', description: 'Reminder frequency, deadlines, confirmations.', tips: 'Set firm deadline and communicate it.' },
      { name: 'Shopify Integration', description: 'Connect store for inventory and fulfillment.', tips: 'Test with single order first.' },
      { name: 'ShipStation Integration', description: 'Connect for labels and carrier rates.', tips: 'Good for multi-carrier shipping.' },
      { name: 'Team Management', description: 'Add members and set permissions.', tips: 'Give only needed access.' },
    ]
  },
  'account': {
    title: 'Account Tab',
    description: 'Manage creator account settings.',
    fields: [
      { name: 'Account Profile', description: 'Name, email, profile picture.', tips: 'Keep contact info current.' },
      { name: 'Password Management', description: 'Change password and security settings.', tips: 'Enable two-factor authentication.' },
      { name: 'Connected Services', description: 'View third-party service connections.', tips: 'Revoke unused service access.' },
      { name: 'API Keys', description: 'Generate keys for advanced integrations.', tips: 'Keep API keys secure.' },
    ]
  },
  'workflow': {
    title: 'Fulfillment Workflow',
    description: 'Step-by-step fulfillment process guide.',
    fields: [
      { name: 'Step 1: Send & Remind', description: 'Collect backer surveys for addresses and preferences.', tips: 'High completion is essential.' },
      { name: 'Step 2: Lock Orders', description: 'Finalize what each backer receives.', tips: 'Only lock when responses are final.' },
      { name: 'Step 3: Charge Cards', description: 'Process payments for add-ons and shipping.', tips: 'Review preview carefully before charging.' },
      { name: 'Step 4: Lock Addresses', description: 'Prevent last-minute address changes.', tips: 'Send "last chance" email first.' },
      { name: 'Step 5: Start Shipping', description: 'Push orders to fulfillment partners.', tips: 'Start with small batch to verify.' },
      { name: 'Step 6: Mark Shipped', description: 'Mark complete and send tracking to backers.', tips: 'Update promptly.' },
    ]
  },
};

function FieldCard({ field }: { field: FieldInfo }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow">
      <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{field.name}</h4>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{field.description}</p>
      {field.tips && (
        <div className="mt-2 flex gap-2 rounded bg-emerald-50 dark:bg-emerald-950/30 p-2">
          <Info className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
          <p className="text-xs text-emerald-800 dark:text-emerald-300">{field.tips}</p>
        </div>
      )}
    </div>
  );
}

export default function IndieKitHandbookPage() {
  const [activeTab, setActiveTab] = useState('getting-started');
  const currentTab = tabContent[activeTab];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-500 py-8 text-white">
        <div className="container mx-auto px-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-emerald-100 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <h1 className="text-3xl font-bold">IndieKit Handbook</h1>
          <p className="mt-1 text-emerald-100">Complete guide to fulfillment and backer management</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-64 flex-shrink-0">
            <nav className="sticky top-8 space-y-1 max-h-[calc(100vh-8rem)] overflow-y-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-100'
                        : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800'
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
                  <p className="mt-1 text-zinc-600 dark:text-zinc-400">{currentTab.description}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {currentTab.fields.map((field) => (
                    <FieldCard key={field.name} field={field} />
                  ))}
                </div>
              </>
            )}

            {/* Quick Links */}
            <div className="mt-12 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white">
              <h3 className="text-xl font-bold mb-2">Ready to Start Fulfilling?</h3>
              <p className="text-emerald-100 mb-4">Access IndieKit from your Creator Dashboard.</p>
              <div className="flex gap-3">
                <Link href="/dashboard/indiekit" className="inline-flex items-center gap-2 rounded-lg bg-white text-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-50">
                  <LayoutDashboard className="h-4 w-4" /> Open IndieKit
                </Link>
                <Link href="/creator-handbook" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-medium hover:bg-white/10">
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
