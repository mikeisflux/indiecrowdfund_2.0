# IndieKit 2.0 Development Plan

> **Purpose:** This document outlines the complete migration plan from IndieKit 1.0 to IndieKit 2.0.
> The new version will be built as a separate tab (`/dashboard/indiekit-v2`) while keeping the original intact for reference.
> Working code will be copied and modified - nothing will be deleted from the original.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [New Architecture](#new-architecture)
3. [Workflow Reorganization](#workflow-reorganization)
4. [Tab Consolidation Plan](#tab-consolidation-plan)
5. [Feature Checklist](#feature-checklist)
6. [Migration Strategy](#migration-strategy)
7. [Implementation Phases](#implementation-phases)

---

## Current State Analysis

### Problems with IndieKit 1.0

| Issue | Impact |
|-------|--------|
| **26 tabs** | Overwhelming, users don't know where to find features |
| **Fragmented workflow** | Fulfillment steps spread across 3+ tabs |
| **Redundant views** | Overview and Counts show same data |
| **Unclear naming** | "Digital" vs "Digital Delivery", "Manage Survey" vs "Survey Builder" |
| **No phase guidance** | Users don't understand pre-fulfillment vs fulfillment vs post-fulfillment |
| **Settings scattered** | Configuration in multiple places |

### Current Tab Structure (26 tabs in 4 rows)

```
Row 1: Overview | Backers | Projects | Updates | Timeline | Support | SKU Mapping
Row 2: Packages | Products | Shipping | Digital | Add-ons | Pre-Orders
Row 3: Inbox | Email Campaigns | Email List | Teaser Pages | Segments
Row 4: Counts | Export | Survey Builder | Manage Survey | Settings | Account
```

---

## New Architecture

### Design Principles

1. **Workflow-oriented** - Organize by fulfillment phase, not by feature
2. **Consolidated** - Reduce from 26 tabs to ~14 tabs
3. **Guided** - Clear "what's next" prompts at every step
4. **Accessible** - Common tools always available regardless of phase

### New Tab Structure (14 tabs)

```
ALWAYS AVAILABLE (top navigation bar):
Dashboard | Backers | Support Center | Email Marketing | Updates | Settings

PHASE-BASED (main content area with phase selector):
┌─────────────────┬─────────────────┬─────────────────┐
│ PRE-FULFILLMENT │   FULFILLMENT   │ POST-FULFILLMENT│
└─────────────────┴─────────────────┴─────────────────┘

PRE-FULFILLMENT tabs:
- Setup (Products, SKU Mapping, Survey Builder)
- Surveys (Send, Track Responses)
- Finalize (Lock Orders, Lock Addresses)

FULFILLMENT tabs:
- Payments (Charge Cards)
- Digital Delivery
- Physical Delivery (Packages)

POST-FULFILLMENT tabs:
- Reports (Analytics, Export, Timeline)
```

---

## Workflow Reorganization

### Correct Fulfillment Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRE-FULFILLMENT                                    │
│                    (Setup, Collection & Finalization)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│  SETUP:                                                                      │
│  1. Products/Inventory    → Set up items available for add-ons              │
│  2. SKU Mapping           → Link rewards to inventory items                 │
│  3. Survey Builder        → Create survey with add-on offerings             │
│                                                                              │
│  COLLECTION:                                                                 │
│  4. Send Surveys          → Collect backer choices & addresses              │
│  5. Track Responses       → Monitor completion rates                        │
│                                                                              │
│  FINALIZATION:                                                               │
│  6. Lock Orders           → Finalize what each backer is getting            │
│  7. Lock Addresses        → Finalize where to ship                          │
└─────────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                            FULFILLMENT                                       │
│                         (Payment & Delivery)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│  PAYMENT:                                                                    │
│  8. Charge Cards          → Collect payment for add-ons                     │
│                                                                              │
│  DIGITAL DELIVERY (instant):                                                 │
│  9. Digital Delivery      → Send digital files immediately after payment    │
│                                                                              │
│  PHYSICAL DELIVERY (takes time):                                             │
│  10. Packages             → Push to fulfillment, generate labels, ship      │
│  11. Track Shipments      → Monitor delivery status                         │
└─────────────────────────────────────────────────────────────────────────────┘
                                     ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                          POST-FULFILLMENT                                    │
│                            (Reporting)                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  12. Analytics/Reports    → Completion reports, campaign wrap-up            │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tab Consolidation Plan

### Tabs to MERGE

| Old Tabs | New Tab | Rationale |
|----------|---------|-----------|
| Overview + Counts | **Dashboard** | Same data, one authoritative view |
| Survey Builder + Manage Survey | **Surveys** | One place for all survey needs |
| Email Campaigns + Email List + Segments | **Email Marketing** | All email tools together |
| Inbox + Support | **Support Center** | All inbound communication |
| Timeline + Export | **Reports** | All data/history in one place |
| Products + SKU Mapping | **Inventory/Setup** | Product management together |

### Tabs to RENAME

| Old Name | New Name | Rationale |
|----------|----------|-----------|
| Digital | **Digital Delivery** | Clearer purpose |
| Manage Survey | **Survey Responses** | Clearer distinction from builder |
| Pre-Orders | **Late Backers** | Industry standard term |
| Add-ons | **Survey Add-ons** | Clarify these come from surveys |

### Tabs to MOVE to "Always Available"

| Tab | Reason |
|-----|--------|
| Support Center | Issues come in at any phase |
| Email Marketing | Communication needed throughout |
| Updates | Announcements are ongoing |
| Settings | Configuration always accessible |

---

## Feature Checklist

### ALWAYS AVAILABLE FEATURES

#### Dashboard (merge: Overview + Counts)
- [ ] **Stats Cards**
  - [ ] Total Backers count
  - [ ] Surveys Completed (count + %)
  - [ ] Purchased Add-ons (count + %)
  - [ ] Fulfilled (count + %)
- [ ] **Revenue Display**
  - [ ] Total raised (campaign + pre-orders breakdown)
  - [ ] Horizontal stacked bar chart
  - [ ] Detailed breakdown table
- [ ] **Fulfillment Status Flow**
  - [ ] Not Pushed → Push Errored → Pushed → Shipped (with counts)
  - [ ] Visual arrows connecting stages
- [ ] **Charge Details Breakdown**
  - [ ] Not Charged / Errored / Charged / PayPal Collected
- [ ] **Recent Activity Feed**
  - [ ] Last 5 timeline entries
  - [ ] Activity icons by type
  - [ ] Link to full timeline
- [ ] **What's Next Banner**
  - [ ] Dynamic messaging based on workflow state
  - [ ] Action button for next step
- [ ] **Pie/Bar Charts** (from Counts)
  - [ ] Pledge Level Breakdown
  - [ ] Survey Status Breakdown
  - [ ] Shipping Region Breakdown
  - [ ] Payment Status Breakdown

#### Backers
- [ ] **Search & Filters**
  - [ ] Text search (name/email)
  - [ ] Rewards filter (multi-select)
  - [ ] Add-ons filter (multi-select)
  - [ ] SKU Mapping filter
  - [ ] Status dropdown
  - [ ] Location/Country filter
  - [ ] Pledge Amount range ($min-$max)
  - [ ] Pledge Date range
  - [ ] Survey Status filter
  - [ ] Clear all filters
  - [ ] Results counter
- [ ] **Bulk Actions**
  - [ ] Select all checkbox
  - [ ] Individual row checkboxes
  - [ ] Send Survey Reminder
  - [ ] Charge Cards
  - [ ] Lock Orders
  - [ ] Lock Addresses
  - [ ] Push to Fulfillment
  - [ ] Mark as Shipped
- [ ] **Backers Table**
  - [ ] Avatar/name/email column
  - [ ] Reward column
  - [ ] Amount column
  - [ ] Survey status badges
  - [ ] Order status badges
  - [ ] Row click → detail dialog
  - [ ] Per-row dropdown actions
- [ ] **Export Button** (CSV download)
- [ ] **Backer Detail Dialog**
  - [ ] Full backer info
  - [ ] Order history
  - [ ] Balance breakdown
  - [ ] Address display
  - [ ] Survey responses
  - [ ] Notes section
  - [ ] Edit capabilities

#### Support Center (merge: Inbox + Support)
- [ ] **Email Inbox**
  - [ ] Thread list view
  - [ ] Unread/Read/Replied/Archived status
  - [ ] Star toggle
  - [ ] Search threads
  - [ ] Filter by project
  - [ ] Thread detail view
  - [ ] Reply/Forward functionality
  - [ ] Email handle setup (@indiecrowdfund)
- [ ] **Support Tickets**
  - [ ] Open issues list
  - [ ] Issue status tracking
  - [ ] Priority levels
  - [ ] Resolution workflow
- [ ] **Quick Actions**
  - [ ] Mark read/unread
  - [ ] Archive/unarchive
  - [ ] Delete thread

#### Email Marketing (merge: Email Campaigns + Email List + Segments)
- [ ] **Campaigns Sub-tab**
  - [ ] Campaign templates (9+ scenarios)
  - [ ] Draft/Scheduled/Sending/Sent status
  - [ ] Recipients count
  - [ ] Open/click rates
  - [ ] Edit/Send/Delete actions
- [ ] **Subscribers Sub-tab**
  - [ ] Total subscriber count
  - [ ] Import/Export buttons
  - [ ] Search/filter
  - [ ] Status (subscribed/unsubscribed/bounced)
  - [ ] Add subscriber manually
- [ ] **Segments Sub-tab**
  - [ ] Segment list
  - [ ] Condition builder
  - [ ] Preview matching backers
  - [ ] Edit/Delete segments
- [ ] **Email Composer Dialog**
  - [ ] Subject input
  - [ ] HTML body editor
  - [ ] Recipient selector
  - [ ] Schedule options
  - [ ] Send test email
  - [ ] Preview button

#### Updates
- [ ] Updates list
- [ ] Title/date/excerpt display
- [ ] Create new update button
- [ ] Update editor (title, body, schedule)
- [ ] Preview button
- [ ] Publish/Save draft

#### Settings
- [ ] **General Settings Section**
  - [ ] Project name
  - [ ] Project description
  - [ ] Project image
- [ ] **Survey Settings Section**
  - [ ] Allow address changes toggle
  - [ ] Send confirmation email toggle
  - [ ] Lock after fulfillment toggle
  - [ ] Send reminders toggle
- [ ] **Shipping Settings Section**
  - [ ] Domestic shipping toggle
  - [ ] International shipping toggle
  - [ ] Address validation toggle
- [ ] **Payment Settings Section**
  - [ ] Auto retry failed charges toggle
  - [ ] Send receipts toggle
  - [ ] Failed payment notifications toggle
- [ ] **Notification Settings Section**
  - [ ] Survey completions toggle
  - [ ] Failed payments toggle
  - [ ] New pre-orders toggle
  - [ ] Daily summary toggle
- [ ] **Integrations Section**
  - [ ] Stripe connection
  - [ ] Shopify connection
  - [ ] ShipStation connection
  - [ ] Shippo connection
  - [ ] EasyPost connection
  - [ ] Stamps.com connection
- [ ] **Bank Account Section** (DivinityCoin)
  - [ ] Bank name input
  - [ ] Account holder input
  - [ ] Account number input
  - [ ] Routing number input
  - [ ] Account type selector
- [ ] **Team Section**
  - [ ] Team member list
  - [ ] Invite member
  - [ ] Role management
- [ ] **API Keys Section**
  - [ ] Generate API key
  - [ ] View/revoke keys

#### Account Settings
- [ ] Profile info display
- [ ] Link to main dashboard profile
- [ ] Quick overview card

#### Projects (project switcher)
- [ ] Project list
- [ ] Status badges
- [ ] Stats display
- [ ] Click to select
- [ ] Link to edit project

---

### PRE-FULFILLMENT FEATURES

#### Setup (merge: Products + SKU Mapping + Survey Builder)

**Products/Inventory Sub-section:**
- [ ] Product list from Shopify
- [ ] Inventory levels
- [ ] Product images
- [ ] Sync status

**SKU Mapping Sub-section:**
- [ ] Unmapped items list (amber highlight)
- [ ] Mapped SKUs table
- [ ] Map SKU dialog
  - [ ] Campaign item display
  - [ ] Shopify SKU input
  - [ ] Quantity per order
- [ ] Refresh mappings button
- [ ] Edit/Delete mappings

**Survey Builder Sub-section:**
- [ ] Add question button
- [ ] Question list
  - [ ] Question text
  - [ ] Question type (text/checkbox/radio/select)
  - [ ] Required toggle
  - [ ] Options (for choice questions)
  - [ ] Edit/Delete buttons
- [ ] Preview survey
- [ ] Publish survey

**Add-ons Management:**
- [ ] Stats cards (revenue, backers with add-ons, active count)
- [ ] Add-on list
  - [ ] Name + availability badge
  - [ ] Description
  - [ ] Price
  - [ ] Purchased count
  - [ ] Remaining quantity
- [ ] Add new add-on button
- [ ] Edit add-on dialog
- [ ] Duplicate/Activate/Deactivate/Delete actions
- [ ] Info card (how survey add-ons work)

#### Surveys (merge: Email Campaigns survey templates + Manage Survey)

**Send Surveys Sub-section:**
- [ ] Survey email template
- [ ] Recipient selection
- [ ] Schedule send
- [ ] Track sent count

**Survey Responses Sub-section:**
- [ ] Total responses count
- [ ] Response rate (%)
- [ ] Average completion time
- [ ] Responses table
  - [ ] Backer name
  - [ ] Date completed
  - [ ] Responses summary
  - [ ] View full response
- [ ] Export responses button

**Survey Reminders:**
- [ ] Send reminder to non-respondents
- [ ] Reminder email template
- [ ] Track reminder count

#### Finalize

**Lock Orders Sub-section:**
- [ ] Eligible backers count
- [ ] Lock orders button
- [ ] Confirmation dialog
- [ ] Explanation of what locking does

**Lock Addresses Sub-section:**
- [ ] Eligible backers count
- [ ] Address completion status
- [ ] Lock addresses button
- [ ] Confirmation dialog
- [ ] Address validation option

---

### FULFILLMENT FEATURES

#### Payments

**Charge Cards Sub-section:**
- [ ] Charge preview dialog
  - [ ] Backers with balance due
  - [ ] Total add-on amounts
  - [ ] Summary cards
- [ ] Charge button
- [ ] Progress indicator
- [ ] Error handling
- [ ] Retry failed charges

**Payment Status:**
- [ ] Not Charged count
- [ ] Errored count
- [ ] Charged count
- [ ] PayPal Collected count

#### Digital Delivery (rename from Digital)

**File Management:**
- [ ] Upload file button
- [ ] File list
  - [ ] File icon/name/size/type
  - [ ] Upload date
  - [ ] Download count
  - [ ] Status badge
- [ ] Edit/Delete/Download actions

**Distribution Rules:**
- [ ] Create distribution button
- [ ] Rule list
  - [ ] Name
  - [ ] Condition/trigger
  - [ ] Progress bar
  - [ ] Status (not_started/started/completed)
  - [ ] Distributed X of Y
  - [ ] Started at timestamp
- [ ] View/Refresh/Delete actions

**Distribution Dialog:**
- [ ] Rule name input
- [ ] Trigger condition selector (reward/add-on/survey answer)
- [ ] File to distribute selector
- [ ] Requires payment toggle

**Bulk Actions:**
- [ ] Blast notification emails
- [ ] Start all distributions

#### Physical Delivery (Packages)

**Instructions Tab:**
- [ ] 5-step process guide
- [ ] Before you begin checklist
- [ ] Get Started button

**Connect Tab:**
- [ ] Connected services table
  - [ ] Service name + status
  - [ ] Account ID
  - [ ] Connected date
  - [ ] Update/Disconnect buttons
- [ ] Add new connection button
- [ ] Connection dialog (per service)

**Process All Tab:**
- [ ] Segment filter dropdown
- [ ] Connected service display
- [ ] Refresh package groups button
- [ ] Search package group input
- [ ] Bulk actions card
  - [ ] Push all orders button
  - [ ] Re-push errored orders button
  - [ ] Update order status button
- [ ] Overall status flow visualization

**Process by Group Tab:**
- [ ] Segment filter
- [ ] Package group filter buttons (All/Incomplete/International/Domestic)
- [ ] Create group button
- [ ] Package group cards
  - [ ] Group ID/name/type badge
  - [ ] Status flow with counts
  - [ ] Last sent timestamp
  - [ ] Send to service button
  - [ ] Items table (qty/name/weight)
  - [ ] Customs validation warnings
  - [ ] Export options dropdown

**Shipping Configuration:**
- [ ] Shipping zones list
  - [ ] Zone name/emoji
  - [ ] Customs requirement badge
  - [ ] Base rate/per-item rate/free threshold
  - [ ] Weight tiers
  - [ ] Edit/Delete buttons
- [ ] Add zone button
- [ ] Zone dialog

---

### POST-FULFILLMENT FEATURES

#### Reports (merge: Timeline + Export + Counts analytics)

**Analytics Sub-section:**
- [ ] All charts from Counts tab
- [ ] Key metrics display
- [ ] Completion percentages

**Timeline Sub-section:**
- [ ] Activity list
  - [ ] Icon (colored by type)
  - [ ] Title
  - [ ] Detail/description
  - [ ] Timestamp
- [ ] Activity types: survey_completed, order_shipped, survey_reminder, digital_download, cards_charged, charge_failed

**Export Sub-section:**
- [ ] Export type selector (Backers/Fulfillment/Surveys/Financial)
- [ ] Export format selector (CSV/Excel/JSON)
- [ ] Custom field selection
  - [ ] Name, Email, Address (defaults)
  - [ ] Pledge level, Items, Add-ons (defaults)
  - [ ] Phone, Survey answers, Payment details (optional)
- [ ] Export history table
  - [ ] Name/type/format/record count
  - [ ] Created date/status
  - [ ] Re-download button

---

### ADDITIONAL FEATURES

#### Teaser Pages
- [ ] Teaser page list
- [ ] Status (active/draft/archived)
- [ ] Views count
- [ ] Signup count
- [ ] Edit/Publish/Delete actions
- [ ] Create new teaser page

#### Late Backers (rename from Pre-Orders)
- [ ] Pre-order backers count
- [ ] Pre-order revenue
- [ ] Status information
- [ ] Analytics (if campaign active)

---

### DIALOGS TO MIGRATE

1. [ ] **BackerDialog** - View/edit individual backer
2. [ ] **UploadDialog** - Upload digital files
3. [ ] **EmailDialog** - Compose emails
4. [ ] **AddonDialog** - Create/edit add-ons
5. [ ] **DistributionDialog** - Create distribution rules
6. [ ] **NPSFeedbackDialog** - Collect user feedback
7. [ ] **AddressValidationDialog** - Validate addresses
8. [ ] **ImportEmailDialog** - Import email campaigns
9. [ ] **BalanceEditorDialog** - Edit backer balances
10. [ ] **ExportDialog** - Configure export options
11. [ ] **TrackingDialog** - Add tracking numbers
12. [ ] **EditOrderDialog** - Edit order details
13. [ ] **RefundDialog** - Process refunds
14. [ ] **NotesDialog** - Add notes to backers
15. [ ] **SegmentDialog** - Create/edit segments
16. [ ] **EmailComposerDialog** - Compose emails
17. [ ] **ConfirmDialog** - Generic confirmation
18. [ ] **PackingSlipDialog** - Generate packing slips
19. [ ] **ChargePreviewDialog** - Preview charges before processing
20. [ ] **ConnectionDialog** - Connect fulfillment services
21. [ ] **CreateGroupDialog** - Create package groups
22. [ ] **ViewGroupDialog** - View package group details
23. [ ] **EditCustomsDialog** - Edit customs information
24. [ ] **SKUMappingDialog** - Map campaign items to SKUs
25. [ ] **ZoneDialog** - Create/edit shipping zones

---

### API ENDPOINTS TO USE

#### Main Data
- `GET /api/creator/indiekit` - Fetch all IndieKit data

#### Workflow Actions
- `POST /api/creator/indiekit/backers` - Bulk backer actions
  - `action: lock_orders`
  - `action: charge_cards`
  - `action: lock_addresses`
  - `action: push_to_fulfillment`
  - `action: mark_shipped`
  - `action: send_survey_reminder`

#### Add-ons
- `POST /api/creator/indiekit/addons` - Create/duplicate/activate/deactivate
- `DELETE /api/creator/indiekit/addons` - Delete add-ons

#### Fulfillment
- `POST /api/creator/indiekit/fulfillment` - Fulfillment operations
- `POST /api/creator/indiekit/shopify` - Shopify operations
- `GET/POST /api/creator/indiekit/shopify/sku-mapping` - SKU mapping
- `GET /api/creator/indiekit/shipping-providers/credentials` - Shipping credentials
- `POST/DELETE /api/creator/indiekit/shipping` - Shipping zones/services

#### Digital
- `POST /api/creator/indiekit/digital` - Upload files, blast notifications
- `POST /api/creator/indiekit/distributions` - Distribution rules

#### Export
- `GET /api/creator/indiekit/export` - Export data

#### Other
- `GET/POST /api/creator/indiekit/integrations` - Integrations
- `GET/POST /api/creator/indiekit/segments` - Segments
- `POST /api/creator/indiekit/surveys` - Survey management
- `GET /api/creator/indiekit/timeline` - Timeline entries
- `GET /api/creator/indiekit/updates` - Campaign updates
- `GET /api/creator/indiekit/settings` - Project settings
- `GET /api/creator/indiekit/address` - Address validation
- `POST /api/creator/indiekit/notes` - Add notes

---

## Migration Strategy

### Approach: Parallel Development

1. **Keep Original** - IndieKit 1.0 stays at `/dashboard/indiekit`
2. **Build New** - IndieKit 2.0 at `/dashboard/indiekit-v2`
3. **Copy & Modify** - Reuse working code, reorganize structure
4. **Test Thoroughly** - Both versions work simultaneously
5. **Gradual Migration** - Users can switch when ready
6. **Deprecate Original** - After validation period

### File Structure

```
/src/app/dashboard/
├── indiekit/                    # KEEP - Original v1.0
│   ├── page.tsx
│   ├── constants.ts
│   ├── types.ts
│   └── components/
│       ├── tabs/
│       └── dialogs/
│
└── indiekit-v2/                 # NEW - Version 2.0
    ├── page.tsx                 # New main page with phase-based UI
    ├── constants.ts             # Updated workflow constants
    ├── types.ts                 # Updated types
    └── components/
        ├── layout/              # New layout components
        │   ├── PhaseSelector.tsx
        │   ├── AlwaysAvailableNav.tsx
        │   └── WorkflowProgress.tsx
        ├── phases/              # Phase-specific views
        │   ├── PreFulfillment.tsx
        │   ├── Fulfillment.tsx
        │   └── PostFulfillment.tsx
        ├── tabs/                # Consolidated tabs (copy & modify)
        │   ├── DashboardTab.tsx        # (Overview + Counts)
        │   ├── BackersTab.tsx          # (copy with improvements)
        │   ├── SupportCenterTab.tsx    # (Inbox + Support)
        │   ├── EmailMarketingTab.tsx   # (Campaigns + List + Segments)
        │   ├── SetupTab.tsx            # (Products + SKU + Survey Builder)
        │   ├── SurveysTab.tsx          # (Send + Responses)
        │   ├── FinalizeTab.tsx         # (Lock Orders + Addresses)
        │   ├── PaymentsTab.tsx         # (Charge Cards)
        │   ├── DigitalDeliveryTab.tsx  # (Digital - renamed)
        │   ├── PhysicalDeliveryTab.tsx # (Packages)
        │   ├── ReportsTab.tsx          # (Timeline + Export + Analytics)
        │   └── SettingsTab.tsx         # (copy with cleanup)
        └── dialogs/             # Copy all dialogs
```

---

## Implementation Phases

### Phase 1: Foundation (Week 1-2)
- [ ] Create `/dashboard/indiekit-v2` route
- [ ] Build new layout with phase selector
- [ ] Create "Always Available" navigation bar
- [ ] Implement basic routing between phases
- [ ] Copy types.ts and constants.ts, update for new structure

### Phase 2: Always Available Tabs (Week 2-3)
- [ ] Build Dashboard (merge Overview + Counts)
- [ ] Copy Backers tab with improvements
- [ ] Build Support Center (merge Inbox + Support)
- [ ] Build Email Marketing (merge Campaigns + List + Segments)
- [ ] Copy Updates tab
- [ ] Copy Settings tab
- [ ] Copy Account Settings tab
- [ ] Copy Projects switcher

### Phase 3: Pre-Fulfillment Phase (Week 3-4)
- [ ] Build Setup tab (Products + SKU Mapping + Survey Builder + Add-ons)
- [ ] Build Surveys tab (Send + Responses + Reminders)
- [ ] Build Finalize tab (Lock Orders + Lock Addresses)

### Phase 4: Fulfillment Phase (Week 4-5)
- [ ] Build Payments tab (Charge Cards)
- [ ] Build Digital Delivery tab (rename + enhance)
- [ ] Build Physical Delivery tab (Packages - copy + organize)

### Phase 5: Post-Fulfillment Phase (Week 5-6)
- [ ] Build Reports tab (Timeline + Export + Analytics)
- [ ] Copy Teaser Pages tab
- [ ] Copy Late Backers tab (renamed from Pre-Orders)

### Phase 6: Dialogs & Polish (Week 6-7)
- [ ] Copy all dialog components
- [ ] Test all workflows end-to-end
- [ ] Add "What's Next" guidance throughout
- [ ] Add phase progress indicators
- [ ] Implement breadcrumb navigation

### Phase 7: Testing & Validation (Week 7-8)
- [ ] User acceptance testing
- [ ] Performance testing
- [ ] Bug fixes
- [ ] Documentation updates

---

## Success Criteria

- [ ] Tab count reduced from 26 to ~14
- [ ] Clear 3-phase workflow visible to users
- [ ] "What's next" prompts at every step
- [ ] No functionality lost from v1.0
- [ ] All API endpoints working
- [ ] All dialogs functional
- [ ] Settings fully migrated
- [ ] User can complete full fulfillment workflow without confusion

---

## Notes

- **Do NOT delete** anything from IndieKit 1.0
- **Copy working code** - don't reinvent what works
- **Test incrementally** - each phase should be testable
- **Get user feedback** early and often
- **Document changes** as you go

---

*Last Updated: January 2026*
*Document Version: 1.0*
