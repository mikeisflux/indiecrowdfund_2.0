# Backer Fulfillment & Post-Campaign Upselling

A comprehensive guide to managing pledge fulfillment, digital downloads, shipping integration, and post-campaign marketing for your crowdfunding platform.

---

## Table of Contents

1. [Dashboard Overview](#dashboard-overview)
2. [Take Action Workflow](#take-action-workflow)
3. [Timeline Page](#timeline-page)
4. [Counts Page](#counts-page)
5. [Fulfillment Workflow](#fulfillment-workflow)
6. [Shipping Integration](#shipping-integration)
7. [Shipping Rates Configuration](#shipping-rates-configuration)
8. [Digital Downloads](#digital-downloads)
9. [Backer Management](#backer-management)
10. [Backer List & Search](#backer-list--search)
11. [Backer Detail Tabs](#backer-detail-tabs)
12. [Segments & Export](#segments--export)
13. [Backer Support](#backer-support)
14. [Survey Builder](#survey-builder)
15. [Pledge Levels & Add-ons](#pledge-levels--add-ons)
16. [Product & SKU Management](#product--sku-management)
17. [Pre-Orders & Upselling](#pre-orders--upselling)
18. [Email Campaigns (Launch)](#email-campaigns-launch)
19. [Launch: Teaser Pages](#launch-teaser-pages)
20. [Launch: Members](#launch-members)
21. [Launch: Projects](#launch-projects)
22. [Project Settings](#project-settings)
23. [Account Settings](#account-settings)
24. [Team Management](#team-management)
25. [UI Layout Specifications](#ui-layout-specifications)
26. [Global UI Components](#global-ui-components)
27. [Form Elements & Validation](#form-elements--validation)
28. [Loading & Empty States](#loading--empty-states)
29. [Modals & Notifications](#modals--notifications)
30. [Best Practices](#best-practices)

---

## Dashboard Overview

The main dashboard provides at-a-glance metrics for your campaign's post-funding status.

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR (56px height)                                                   │
│  [Logo] [Project Selector] [Search] ............... [What's New●] [Account] │
├────────────┬────────────────────────────────────────────────┬───────────────┤
│            │                                                │               │
│  SIDEBAR   │           MAIN CONTENT AREA                    │  RIGHT PANEL  │
│  (200px)   │           (flexible width)                     │   (280px)     │
│            │                                                │               │
│  • Home    │  ┌─────────────────────────────────────────┐   │  Fulfillment  │
│  • Timeline│  │  Feedback Modal (centered overlay)      │   │  ───────────  │
│  • Help    │  │  480px wide × auto height               │   │  669 / 684    │
│  ────────  │  └─────────────────────────────────────────┘   │  ████████░ 97%│
│  Take Action│                                               │               │
│  • Send    │  ┌─────────────────────────────────────────┐   │  Survey       │
│  • Lock    │  │  RAISED IN BACKERKIT                    │   │  Completion   │
│  • Charge  │  │  $5,720                                 │   │  ───────────  │
│  • Ship    │  │  [Chart: 50% width] [Details: 50%]      │   │  641 / 679    │
│  ────────  │  └─────────────────────────────────────────┘   │  ███████░ 94% │
│  Backers   │                                                │               │
│  Counts    │  ┌─────────────────────────────────────────┐   │  Pre-orders   │
│  Segments  │  │  WHAT'S NEXT? (Success Banner)          │   │  ───────────  │
│  Fulfill   │  │  Full width, 120px height, teal bg      │   │  43 total     │
│  Downloads │  └─────────────────────────────────────────┘   │               │
│  Pre-orders│                                                │               │
│  Support   │                                                │               │
│  Export    │                                                │               │
│  Settings  │                                                │               │
│  ────────  │                                                │               │
│  MORE ▼    │                                                │               │
│            │                                                │               │
└────────────┴────────────────────────────────────────────────┴───────────────┘
```

### NPS Feedback Modal

A modal overlay prompts creators to rate their experience.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                              ×        │  │
│  │                     Give Us Your Feedback                             │  │
│  │                                                                       │  │
│  │   How likely are you to recommend BackerKit to a fellow project       │  │
│  │   creator?                                                            │  │
│  │                                                                       │  │
│  │   ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐ ┌───┐       │  │
│  │   │ 1 │ │ 2 │ │ 3 │ │ 4 │ │ 5 │ │ 6 │ │ 7 │ │ 8 │ │ 9 │ │10 │       │  │
│  │   └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘ └───┘       │  │
│  │                                                                       │  │
│  │   1 = Not likely to recommend    10 = Highly likely to recommend      │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Modal Styling:
- Width: 480px
- Background: white
- Border-radius: 8px
- Shadow: 0 4px 24px rgba(0,0,0,0.2)
- Padding: 32px
- Position: centered (fixed)
- Overlay: rgba(0,0,0,0.5)
- z-index: 1000

Close button (×):
- Position: top-right
- Size: 24px
- Color: #666666

Number buttons:
- Size: 40px × 40px
- Border: 2px solid #4a9b9b
- Border-radius: 50%
- Font-size: 16px bold
- Gap: 8px between buttons
- Hover: background #4a9b9b, text white
- Selected: background #4a9b9b, text white
```

### Key Metrics

| Metric | Description |
|--------|-------------|
| **Amount Raised** | Total funds collected, broken down by Campaign Backers vs Pre-order Backers |
| **Fulfillment Progress** | Percentage of orders fulfilled (e.g., 669/684 = 97%) |
| **Survey Completion** | Percentage of backers who completed their surveys (e.g., 641/679 = 94%) |
| **Purchased Add-ons** | Percentage of backers who purchased additional items (e.g., 27%) |

### Raised in BackerKit Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Raised in BackerKit                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │                                 │  │  Charge Details                 │   │
│  │  $5,720                         │  │  ─────────────────────────────  │   │
│  │  (large, 36px, teal)            │  │                                 │   │
│  │                                 │  │  ░░ Not Charged (?)        $0   │   │
│  │  ████████████████░░░░░░░░░░░░   │  │  ░░ Errored (?)            $0   │   │
│  │  Progress bar showing breakdown │  │  ██ Charged            $4,244   │   │
│  │                                 │  │  ██ PayPal Collected   $1,476   │   │
│  │  ■ Campaign Backers    $3,215   │  │                                 │   │
│  │  ■ Pre-order Backers   $2,505   │  │                                 │   │
│  │    ↑ clickable link             │  │                                 │   │
│  └─────────────────────────────────┘  └─────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Two-column layout: 50% / 50%
Gap: 24px

Charge Details Legend:
- Not Charged: light gray square (?)= tooltip explaining pending
- Errored: yellow/amber square (?)= tooltip explaining failures
- Charged: green square
- PayPal Collected: dark gray square

Dollar amounts: right-aligned, 14px
```

### Charge Details Breakdown

| Status | Color | Description |
|--------|-------|-------------|
| **Not Charged** | Light gray | Backers with pending charges not yet attempted |
| **Errored** | Yellow/Amber | Failed payment attempts requiring attention |
| **Charged** | Green | Successfully collected credit card payments |
| **PayPal Collected** | Dark gray | Payments processed via PayPal |

### Right Panel - Progress Metrics

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Fulfillment                                                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  669 / 684                                                                  │
│  (large number / total)                                                     │
│                                                                             │
│  ████████████████████████████████████████░░░░ 97%                          │
│  Progress bar: green fill, gray remainder                                   │
│                                                                             │
│  ■ Fulfilled                                                          97%   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Survey Completion                                                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  641 / 679                                                                  │
│                                                                             │
│  ██████████████████████████████████████░░░░░░ 94%                          │
│                                                                             │
│  ■ Survey Completed                                                   94%   │
│  ■ Purchased Add-ons (?)                                              27%   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Progress Bar Styling:
- Height: 8px
- Border-radius: 4px
- Background (empty): #e0e0e0
- Fill (complete): #38a169 (green)
- Width: 100% of container

Metrics:
- Large number: 24px bold
- Divider slash: 16px gray
- Total: 16px gray
- Percentage: right-aligned, 14px
```

### What's Next Success Banner

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │  What's Next?  You Did It!                                           │  │
│  │                                                                       │  │
│  │  Way to go fulfilling all those orders, whew! Do you have an         │  │
│  │  upcoming project coming up? Let us know and we can keep you up      │  │
│  │  to date on all of our latest tools that can help your project.      │  │
│  │  You have 3 upcoming projects so far.                                │  │
│  │            ↑ clickable link                                          │  │
│  │                                                                       │  │
│  │                    [Tell Us About Your Upcoming Project]              │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

Banner Styling:
- Background: #4a9b9b (teal)
- Text: white
- Padding: 24px 32px
- Border-radius: 8px
- Margin: 24px 0

"What's Next?" text: 14px uppercase, semi-bold
"You Did It!" text: 24px bold
Body text: 14px, max-width for readability
Link: white, underlined
Button: white background, teal text, 14px
```

### Take Action Sidebar

A step-by-step workflow tracker showing:

1. **Send & Remind** — Backers needing survey reminders
2. **Lock Orders** — Orders ready to be locked for fulfillment
3. **Charge Cards** — Pending charges to process
4. **Lock Addresses** — Addresses to freeze before shipping
5. **Start Shipping** — Orders ready for shipment
6. **Shipped** — Completed shipments

---

## Take Action Workflow

The Take Action sidebar provides a sequential fulfillment workflow with real-time counts for each stage.

### Sidebar Layout

```
┌────────────────────────────────────────┐
│  Take Action                           │
│  ──────────────────────────────────    │
│                                        │
│  ● Send & Remind                  19   │
│    ↓                                   │
│  ● Lock Orders                     0   │
│    ↓                                   │
│  ● Charge Cards                    0   │
│    ↓                                   │
│  ● Lock Addresses                  0   │
│    ↓                                   │
│  ● Start Shipping                 15   │
│    ↓                                   │
│  ● Shipped                       669   │
│                                        │
└────────────────────────────────────────┘

Sidebar Styling:
- Width: 200px
- Background: white
- Padding: 16px 0

Workflow Item Styling:
- Dot: 8px diameter, filled circle
- Dot colors:
  - Yellow (#f59e0b): Action needed (count > 0)
  - Green (#38a169): Completed stage
  - Gray (#a0a0a0): No action needed (count = 0)
- Connecting line: 2px solid #e0e0e0, vertical
- Label: 14px, left-aligned
- Count badge: 14px bold, right-aligned
- Count badge background: 
  - Teal pill for active counts
  - Gray for zero
- Row height: 40px
- Row padding: 8px 16px
- Clickable: entire row is link to relevant page
```

### Workflow Stages Detail

| Stage | Description | Triggers When |
|-------|-------------|---------------|
| **Send & Remind** | Backers who haven't completed surveys | Survey incomplete AND no reminder sent in X days |
| **Lock Orders** | Orders ready to prevent further changes | Survey complete AND payment collected |
| **Charge Cards** | Pending add-on/shipping charges | Has balance due > $0 |
| **Lock Addresses** | Freeze addresses before shipping | Order locked AND address not locked |
| **Start Shipping** | Ready to push to fulfillment service | Address locked AND not yet pushed |
| **Shipped** | Completed shipments | Marked shipped in fulfillment service |

### Count Badge Component

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Active count (action needed):                                              │
│  ┌──────┐                                                                   │
│  │  19  │  Background: #4a9b9b (teal)                                       │
│  └──────┘  Text: white, 12px bold                                           │
│            Padding: 4px 10px                                                │
│            Border-radius: 12px (pill shape)                                 │
│            Min-width: 24px                                                  │
│                                                                             │
│  Zero count (no action):                                                    │
│  ┌──────┐                                                                   │
│  │   0  │  Background: #e0e0e0 (gray)                                       │
│  └──────┘  Text: #666666, 12px                                              │
│                                                                             │
│  Large count (hundreds+):                                                   │
│  ┌──────┐                                                                   │
│  │ 669  │  Same styling, width expands to fit                               │
│  └──────┘                                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Timeline Page

The Timeline page shows a chronological view of campaign activity and milestones.

### Timeline Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Timeline                                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Filter: [All Activity ▼]  [Date Range: Last 30 days ▼]                    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TODAY                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 🔔 10:45 AM  Survey reminder sent to 19 backers                     │    │
│  │              View affected backers »                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 📦 9:30 AM   15 orders pushed to ShipStation                        │    │
│  │              Package Group #643455                                  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  YESTERDAY                                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 💳 3:15 PM   12 cards charged successfully ($847.00)                │    │
│  │              3 charges failed - View errors »                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ✅ 11:00 AM  Survey completed by john.doe@email.com                 │    │
│  │              Pledge #37408853                                       │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  DECEMBER 14, 2024                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 📥 2:00 PM   Digital downloads distributed to 45 backers            │    │
│  │              Flying Sparks Vol 1                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│                         [Load More Activity]                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Timeline Entry Styling:
- Background: white
- Border: 1px solid #e0e0e0
- Border-radius: 4px
- Padding: 16px
- Margin-bottom: 12px

Entry Components:
- Icon: 20px, left-aligned (varies by type)
- Time: 12px gray, after icon
- Title: 14px bold, main description
- Detail: 14px gray, secondary info
- Link: teal, clickable action

Date Headers:
- Font: 12px uppercase, bold
- Color: #666666
- Margin: 24px 0 12px 0
```

### Activity Types & Icons

| Activity | Icon | Color |
|----------|------|-------|
| Survey Reminder Sent | 🔔 | Yellow |
| Survey Completed | ✅ | Green |
| Orders Pushed | 📦 | Teal |
| Cards Charged | 💳 | Green |
| Charge Failed | ⚠️ | Red |
| Digital Download | 📥 | Teal |
| Address Updated | 📍 | Blue |
| Order Shipped | 🚚 | Green |
| Refund Issued | 💸 | Orange |
| Comment Added | 💬 | Gray |

### Filter Options

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Filter: [All Activity ▼]                                                   │
│          ┌─────────────────────────┐                                        │
│          │ All Activity            │                                        │
│          │ ────────────────────    │                                        │
│          │ Survey Activity         │                                        │
│          │ Payment Activity        │                                        │
│          │ Shipping Activity       │                                        │
│          │ Digital Downloads       │                                        │
│          │ Address Changes         │                                        │
│          │ Support Tickets         │                                        │
│          └─────────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Counts Page

The Counts page provides detailed breakdowns of backer statistics.

### Counts Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Counts                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                │
│  │                 │ │                 │ │                 │                │
│  │      684        │ │      641        │ │       43        │                │
│  │  Total Backers  │ │ Surveys Done    │ │   Pre-orders    │                │
│  │                 │ │                 │ │                 │                │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  BACKER BREAKDOWN                                                           │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  By Pledge Level                                         View All » │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  $10 - Digital Only                                           245   │    │
│  │  ████████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░  36%   │    │
│  │                                                                     │    │
│  │  $25 - Single Book                                            189   │    │
│  │  ███████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  28%   │    │
│  │                                                                     │    │
│  │  $50 - Complete Set                                           156   │    │
│  │  ██████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  23%   │    │
│  │                                                                     │    │
│  │  $100 - Collector's Edition                                    94   │    │
│  │  █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  13%   │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  By Survey Status                                        View All » │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  ✅ Survey Completed                                          641   │    │
│  │  ████████████████████████████████████████████████████████░░░  94%   │    │
│  │                                                                     │    │
│  │  ⏳ Survey Pending                                             38   │    │
│  │  █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   6%   │    │
│  │                                                                     │    │
│  │  ❌ Survey Not Sent                                             5   │    │
│  │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  <1%   │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  By Shipping Region                                      View All » │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  🇺🇸 United States                                             412   │    │
│  │  ███████████████████████████████████████░░░░░░░░░░░░░░░░░░░░  60%   │    │
│  │                                                                     │    │
│  │  🇨🇦 Canada                                                     89   │    │
│  │  █████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  13%   │    │
│  │                                                                     │    │
│  │  🇬🇧 United Kingdom                                             67   │    │
│  │  █████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  10%   │    │
│  │                                                                     │    │
│  │  🇪🇺 EU Countries                                               78   │    │
│  │  ███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  11%   │    │
│  │                                                                     │    │
│  │  🌍 Rest of World                                               38   │    │
│  │  █████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   6%   │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  By Payment Status                                       View All » │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  ✅ Fully Paid                                                 658   │    │
│  │  ████████████████████████████████████████████████████████░░░  96%   │    │
│  │                                                                     │    │
│  │  ⏳ Balance Due                                                 18   │    │
│  │  ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   3%   │    │
│  │                                                                     │    │
│  │  ❌ Payment Failed                                               8   │    │
│  │  █░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░   1%   │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Stat Card Styling:
- Width: calc(33% - 16px)
- Background: white
- Border: 1px solid #e0e0e0
- Border-radius: 8px
- Padding: 24px
- Text-align: center

Large Number:
- Font-size: 48px
- Font-weight: bold
- Color: #4a9b9b (teal)

Label:
- Font-size: 14px
- Color: #666666

Breakdown Card:
- Full width
- Margin-bottom: 24px

Progress Bar:
- Height: 8px
- Border-radius: 4px
- Background: #e0e0e0
- Fill: #4a9b9b (teal)
```

---

## Fulfillment Workflow

### Overview

The fulfillment process follows a linear progression:

```
Not Pushed → Push Errored → Pushed → Shipped
```

### Fulfillment Integration Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back                                      [Switch Fulfillment Method ▼]  │
├─────────────────────────────────────────────────────────────────────────────┤
│  FULFILLMENT INTEGRATION (Header: teal background, 80px height)             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Instructions] [1. Connect] [2a. Process All] [2b. Process by Group]       │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Tab underline indicator: 3px solid teal                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Filter by Segment                                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ All Backers with Ready To Ship Orders                              ▼ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Dropdown: full width, 48px height                                          │
│                                                                             │
├────────────────────┬────────────────────────────┬───────────────────────────┤
│  SERVICE BOX       │  ADD NEW ORDERS BOX        │  SEARCH BOX               │
│  (200px width)     │  (320px width)             │  (280px width)            │
│                    │                            │                           │
│  ShipStation       │  [🔄 Refresh Package Groups]│  Enter Package Group #    │
│  (NDM Express)     │  Button: teal, full width  │  ┌────────────────┐ [→]   │
│  🔄 Update Order → │  Last Refreshed:           │  └────────────────┘       │
│                    │  11/15/2024 10:55 AM       │                           │
└────────────────────┴────────────────────────────┴───────────────────────────┘
```

### Switch Fulfillment Method Dropdown

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                      [Switch Fulfillment Method ▼]          │
│                                      ┌─────────────────────────────────┐    │
│                                      │ ShipStation Integration         │    │
│                                      │ Self-Fulfillment                │    │
│                                      │ Third-Party Fulfillment         │    │
│                                      │ Digital Only                    │    │
│                                      └─────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘

Dropdown Styling:
- Position: top-right of page
- Button: outlined, 200px width
- Dropdown menu: right-aligned
- Menu item height: 40px
- Hover: light gray background
```

### Last Refreshed Timestamp

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Add New Orders                                                             │
│                                                                             │
│  ┌─────────────────────────────────────────────┐                            │
│  │  🔄 Refresh Package Groups                  │                            │
│  └─────────────────────────────────────────────┘                            │
│                                                                             │
│  Last Refreshed: 11/15/2024 10:55 AM                                        │
│  (gray text, 12px, centered below button)                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Purpose: Shows when package groups were last synced
Format: MM/DD/YYYY HH:MM AM/PM
Updates: After clicking Refresh Package Groups button
```

### Instructions Tab (Fulfillment)

The first tab provides step-by-step instructions for setting up fulfillment.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Instructions] [1. Connect] [2a. Process All] [2b. Process by Group]       │
│  ─────────────────────────────────────────────────────────────────────────  │
│  ↑ Active tab                                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Getting Started with Fulfillment                                           │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Follow these steps to ship your rewards to backers:                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Step 1: Connect Your Shipping Service                              │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  Connect to ShipStation, Shippo, or another service to generate     │    │
│  │  shipping labels and track packages.                                │    │
│  │                                                                     │    │
│  │  [Go to Connect Tab →]                                              │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Step 2: Configure Products                                         │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  Make sure all products have:                                       │    │
│  │  ☑ Weight set (required for shipping rates)                         │    │
│  │  ☑ Customs information (required for international)                 │    │
│  │  ☑ SKU assigned (for inventory tracking)                            │    │
│  │                                                                     │    │
│  │  ⚠ 2 products are missing weight information                        │    │
│  │                                                                     │    │
│  │  [Configure Products →]                                             │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Step 3: Validate Addresses                                         │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  Review and correct any invalid shipping addresses before           │    │
│  │  pushing orders.                                                    │    │
│  │                                                                     │    │
│  │  ✅ 672 addresses validated                                          │    │
│  │  ⚠ 12 addresses need attention                                      │    │
│  │                                                                     │    │
│  │  [Review Addresses →]                                               │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Step 4: Push Orders to Fulfillment                                 │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  Push orders in bulk or by package group. You can start with        │    │
│  │  a small test batch before processing all orders.                   │    │
│  │                                                                     │    │
│  │  Tip: We recommend starting with 5-10 orders to test your           │    │
│  │  integration before processing the full batch.                      │    │
│  │                                                                     │    │
│  │  [Process All Orders →]  [Process by Group →]                       │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Need Help?                                                                 │
│  • [View Documentation]                                                     │
│  • [Watch Video Tutorial]                                                   │
│  • [Contact Support]                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Step Card Styling:
- Background: white
- Border: 1px solid #e0e0e0
- Border-radius: 8px
- Padding: 20px
- Margin-bottom: 16px

Warning indicators:
- ⚠ Yellow: Issues need attention
- ✅ Green: Step complete
- Number badges: teal circles with white text
```

### Status Flow Component

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│    ● Not Pushed    ──→    ● Push Errored    ──→    ● Pushed    ──→    ● Shipped    │
│         1                      12                     2              669    │
│                                                                             │
│    [Red dot]           [Yellow dot]           [Yellow dot]      [Green dot] │
│    Status indicators: 12px diameter circles                                 │
│    Arrows: gray, 40px wide                                                  │
│    Numbers: 48px font size, centered below status                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
Height: 140px
```

### Process All Orders (Tab 2a)

Use this view to push all orders to your shipping service at once.

**Actions Available:**
- **Push all X orders** — Send new orders to shipping service
- **Re-push all X errored orders** — Retry failed pushes
- **Update Order Status** — Sync shipping status from your fulfillment service

**Action Buttons Layout:**
```
┌────────────────────────┐  ┌─────────────────────────────────┐
│  ✦ Push all 1 orders   │  │  ✦ Re-push all 12 errored orders │
└────────────────────────┘  └─────────────────────────────────┘
Button height: 44px
Button padding: 16px 24px
Background: teal (#4a9b9b)
Icon: white arrow/push symbol
Gap between buttons: 16px
```

### Process Orders by Package Group (Tab 2b)

For more granular control, process orders by package group.

**Package Group Tabs:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Package Group:  [Incomplete (10)] [International (8)] [Domestic (2)] [All (181)]  │
└─────────────────────────────────────────────────────────────────────────────┘
Tab style: text links with count in parentheses
Active tab: teal text with underline
Inactive tabs: gray text
Tab spacing: 24px between tabs
```

### Package Group Card Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Package Group #643455  [International]                                     │
│                         ↑ Badge: teal background, white text, rounded       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ● Not Pushed    ──→    ● Push Errored    ──→    ● Pushed    ──→    ● Shipped    │
│         0                       2                     0               0     │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Group Last Sent: Never                                                     │
│  ┌─────────────────────────────────────┐                                    │
│  │  ⇒ Send 0 to ShipStation            │  (disabled state: gray)            │
│  └─────────────────────────────────────┘                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────┬─────────────────────────────────────────────────┬────────────┐   │
│  │ Qty.  │ Name                                            │ Weight     │   │
│  ├───────┼─────────────────────────────────────────────────┼────────────┤   │
│  │   1   │ a high school girl digital                      │ 0 lb 0.0 oz│   │
│  │       │ ⚠ Not Valid for Customs (edit)                  │            │   │
│  ├───────┼─────────────────────────────────────────────────┼────────────┤   │
│  │   1   │ Justified E-Book                                │ 0 lb 0.0 oz│   │
│  │       │ ⚠ Not Valid for Customs (edit)                  │            │   │
│  ├───────┼─────────────────────────────────────────────────┼────────────┤   │
│  │   1   │ The Hidden Emperor / Into The Black Digital     │ 0 lb 0.0 oz│   │
│  │       │ ⚠ Not Valid for Customs (edit)                  │            │   │
│  ├───────┴─────────────────────────────────────────────────┼────────────┤   │
│  │                                              3 items    │ 0 lb 0.0 oz│   │
│  └─────────────────────────────────────────────────────────┴────────────┘   │
│                                                                             │
│                                    [View This Group »]                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  ⊞ Export reports for this group ▼                                          │
└─────────────────────────────────────────────────────────────────────────────┘

Card Dimensions:
- Width: calc(50% - 16px) in 2-column grid
- Min-width: 400px
- Padding: 24px
- Border: 1px solid #e0e0e0
- Border-radius: 4px
- Margin-bottom: 24px

Table Styling:
- Header row: light gray background (#f5f5f5)
- Row height: 48px minimum
- Qty column: 60px width
- Weight column: 100px width
- Name column: flexible

Warning indicators:
- Icon: red circle with exclamation
- Text: red (#c53030)
- Edit link: teal
```

### Two-Column Package Grid

```
┌──────────────────────────────────┐    ┌──────────────────────────────────┐
│  Package Group #643455           │    │  Package Group #643475           │
│  [International]                 │    │  [International]                 │
│  ────────────────────────────    │    │  ────────────────────────────    │
│  Status flow...                  │    │  Status flow...                  │
│  Item table...                   │    │  Item table...                   │
└──────────────────────────────────┘    └──────────────────────────────────┘

┌──────────────────────────────────┐    ┌──────────────────────────────────┐
│  Package Group #643486           │    │  Package Group #643488           │
│  [International]                 │    │  [International]                 │
│  ────────────────────────────    │    │  ────────────────────────────    │
│  Status flow...                  │    │  Status flow...                  │
└──────────────────────────────────┘    └──────────────────────────────────┘

Grid Layout:
- display: grid
- grid-template-columns: repeat(2, 1fr)
- gap: 32px
- Responsive: single column below 900px viewport
```

### View This Group Page (Single Package Group Detail)

When clicking "View This Group »" on a package group card, you see the full details.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Package Groups                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Package Group #643455                                                      │
│  US / Single Book                                                           │
│  ═══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│  Status: ● Pushed to ShipStation                                            │
│  Created: 11/14/2024 at 2:30 PM                                             │
│  Last Updated: 11/15/2024 at 10:45 AM                                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Summary                                                                    │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐                │
│  │      189        │ │     $945.00     │ │     1 lb 2 oz   │                │
│  │     Orders      │ │   Total Value   │ │  Avg. Weight    │                │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Package Contents                                                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  │ Product                           │ SKU          │ Qty │ Weight │        │
│  │───────────────────────────────────┼──────────────┼─────┼────────│        │
│  │ Flying Sparks Volume 1 (Physical) │ FS-VOL1-PHY  │  1  │  8 oz  │        │
│  │───────────────────────────────────┼──────────────┼─────┼────────│        │
│  │ Sticker Pack                      │ FS-STICKER   │  1  │ 0.5 oz │        │
│  │───────────────────────────────────┼──────────────┼─────┼────────│        │
│                                                                             │
│  Total Package Weight: 8.5 oz                                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Orders in This Group                                              [Export] │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  │ ☐ │ Backer           │ Address              │ Status   │ Tracking │     │
│  │───┼──────────────────┼──────────────────────┼──────────┼──────────│     │
│  │ ☐ │ John Smith       │ 123 Main St, NYC     │ ✅ Shipped│ 9400...  │     │
│  │ ☐ │ Jane Doe         │ 456 Oak Ave, LA      │ ✅ Shipped│ 9400...  │     │
│  │ ☐ │ Bob Wilson       │ 789 Pine Rd, CHI     │ ● Pushed │ —        │     │
│  │ ☐ │ Alice Johnson    │ 321 Elm St, HOU      │ ● Pushed │ —        │     │
│  │ ☐ │ Mike Brown       │ 654 Cedar Ln, PHX    │ ⚠ Error  │ —        │     │
│  │───┼──────────────────┼──────────────────────┼──────────┼──────────│     │
│                                                                             │
│  Showing 1-10 of 189 orders            « Previous  Page 1 of 19  Next »     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Actions                                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [⟳ Refresh Status]  [📤 Re-push Failed]  [📧 Send Ship Notices]   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ⊞ Export reports for this group ▼                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Page Layout:
- Max-width: 1200px
- Margin: 0 auto
- Padding: 24px

Stat Cards:
- Width: calc(33% - 16px)
- Background: #f5f5f5
- Text-align: center
- Padding: 20px

Order Table:
- Full width
- Sortable columns (click header)
- Bulk selection with checkboxes
- Pagination at bottom
```

---

## Shipping Integration

### Connect to Services (Tab 1)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Connected Services                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────┬──────────────┐   │
│  │ ShipStation (NDM Express) #5581                       │   12/20/24   │   │
│  └───────────────────────────────────────────────────────┴──────────────┘   │
│                                                                             │
│                           ┌────────────────────────┐                        │
│                           │  Add New Connection    │                        │
│                           └────────────────────────┘                        │
│                           Button: teal, centered                            │
│                           Width: 200px                                      │
│                           Height: 44px                                      │
└─────────────────────────────────────────────────────────────────────────────┘

Table Layout:
- Full width with side padding: 24px
- Row height: 56px
- Border-bottom: 1px solid #e0e0e0
- Service name column: flexible
- Date column: 120px, right-aligned
```

---

## Shipping Rates Configuration

### Overview

Configure shipping zones, rates, and weight-based pricing for domestic and international fulfillment.

### Shipping Rates Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Shipping                                                    [+ Add Zone]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  🇺🇸 United States (Domestic)                              [Edit] 🗑 │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  Base Rate: $5.00                                                   │    │
│  │  Per Item: $1.50                                                    │    │
│  │  Free shipping over: $100.00                                        │    │
│  │                                                                     │    │
│  │  Weight Tiers:                                                      │    │
│  │  0-8 oz: $4.50  │  8-16 oz: $6.00  │  1-2 lb: $8.50  │  2+ lb: $12.00│    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  🇨🇦 Canada                                                [Edit] 🗑 │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  Base Rate: $12.00                                                  │    │
│  │  Per Item: $3.00                                                    │    │
│  │                                                                     │    │
│  │  Weight Tiers:                                                      │    │
│  │  0-8 oz: $10.00  │  8-16 oz: $14.00  │  1-2 lb: $18.00  │  2+ lb: $25.00│  │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  🌍 Rest of World (International)                          [Edit] 🗑 │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  Base Rate: $18.00                                                  │    │
│  │  Per Item: $5.00                                                    │    │
│  │                                                                     │    │
│  │  ⚠ Customs information required for all items                       │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Add/Edit Zone Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Add Shipping Zone                                                     ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Zone Name *                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ European Union                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Countries *                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ [Germany ×] [France ×] [Italy ×] [Spain ×] [+ Add Country]           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Multi-select with tags                                                     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Pricing Method                                                             │
│  ○ Flat rate                                                                │
│  ○ Per item                                                                 │
│  ● Weight-based                                                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Weight Tiers                                                               │
│  ┌───────────┬───────────┬───────────┬─────────────┐                        │
│  │ Min Weight│ Max Weight│ Rate      │             │                        │
│  ├───────────┼───────────┼───────────┼─────────────┤                        │
│  │ 0 oz      │ 8 oz      │ $15.00    │ [🗑]        │                        │
│  │ 8 oz      │ 16 oz     │ $22.00    │ [🗑]        │                        │
│  │ 16 oz     │ 32 oz     │ $30.00    │ [🗑]        │                        │
│  └───────────┴───────────┴───────────┴─────────────┘                        │
│                                                                             │
│  [+ Add Weight Tier]                                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ☐ Free shipping for orders over: [$___________]                           │
│                                                                             │
│  ☑ Require customs information                                              │
│                                                                             │
│                              [Cancel]  [Save Zone]                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Modal Dimensions:
- Width: 600px
- Max-height: 80vh
- Overflow: scroll

Multi-select Tags:
- Background: #e8e8e8
- Padding: 4px 8px
- Border-radius: 4px
- × button: removes country
```

### Customs Information Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Customs Information                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Required for international shipments. Set this information on each         │
│  product to avoid fulfillment errors.                                       │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Product: Flying Sparks Volume 1                            [Edit]   │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │                                                                      │  │
│  │  HS Code:           4901.99.00                                       │  │
│  │  Country of Origin: United States                                    │  │
│  │  Description:       Printed comic book, graphic novel                │  │
│  │  Value:             $25.00                                           │  │
│  │  Weight:            8 oz                                             │  │
│  │                                                                      │  │
│  │  ✅ Valid for customs                                                │  │
│  │                                                                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Product: Collector's Edition Box Set                       [Edit]   │  │
│  │  ─────────────────────────────────────────────────────────────────   │  │
│  │                                                                      │  │
│  │  ⚠ Missing customs information:                                      │  │
│  │  • HS Code                                                           │  │
│  │  • Country of Origin                                                 │  │
│  │                                                                      │  │
│  │  ❌ Not valid for customs                                            │  │
│  │                                                                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Weight Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Edit Product Weight                                                   ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Product: Flying Sparks Volume 1                                            │
│                                                                             │
│  Weight *                                                                   │
│  ┌─────────────────┐  ┌───────────────┐                                     │
│  │       8         │  │ oz        ▼   │                                     │
│  └─────────────────┘  └───────────────┘                                     │
│  Number input         Unit selector (oz, lb, g, kg)                         │
│                                                                             │
│  Dimensions (optional)                                                      │
│  ┌────────┐ × ┌────────┐ × ┌────────┐  ┌───────────────┐                    │
│  │   9    │   │   6    │   │  0.5   │  │ in        ▼   │                    │
│  └────────┘   └────────┘   └────────┘  └───────────────┘                    │
│  Length       Width        Height       Unit                                │
│                                                                             │
│                              [Cancel]  [Save]                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Connected Services

Available shipping integrations:

| Service | Description | Setup |
|---------|-------------|-------|
| **ShipStation** | Multi-carrier shipping platform | API key connection |
| **Shippo** | Discounted shipping labels | API key connection |
| **EasyPost** | Shipping API | API key connection |
| **Pirate Ship** | USPS discounted rates | OAuth connection |
| **Self-Fulfillment** | Manual tracking entry | No setup required |
| **Third-Party Fulfillment** | External warehouse | Custom integration |

---

## Digital Downloads

### Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📥 Digital Downloads          [Learn More] [View Downloads (33)]  [Create] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Send email notifications to backers receiving digital downloads.    │  │
│  │                                                                       │  │
│  │              ┌─────────────────────────────────────┐                  │  │
│  │              │  ✉ Blast 595 Notification Emails   │                  │  │
│  │              └─────────────────────────────────────┘                  │  │
│  │              Button: teal, 280px wide, centered                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Info box: light gray background, 16px padding, centered text              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                            (?) [Start all distributions (27)]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Distribution Rule                              │ Distributed │ Status   │ │
│  ───────────────────────────────────────────────────────────────────────────│
│  FS Vol 1                                       │   625 files │ Started  │🗑│
│  If [Flying Sparks Volume 1 Digital] is in      │             │ 10/13/24 │ │
│  the order, distribute Flying Sparks Vol 1.     │             │[Refresh] │ │
│  Lockdown/Payment is not required.              │             │          │ │
│  ───────────────────────────────────────────────────────────────────────────│
│  FS Vol 2                                       │     3 files │ Started  │🗑│
│  If [Flying Sparks Volume 2 Digital] is in      │             │ 09/27/24 │ │
│  the order, distribute Flying Sparks Vol 2.     │             │[Refresh] │ │
│  Lockdown/Payment is not required.              │             │          │ │
│  ───────────────────────────────────────────────────────────────────────────│
│  FS Vol 3                                       │     3 files │ Started  │🗑│
│  If [Flying Sparks Volume 3 Digital] is in      │             │ 09/27/24 │ │
│  the order, distribute Flying Sparks Vol 3.     │             │[Refresh] │ │
│  Lockdown/Payment is not required.              │             │          │ │
│  ───────────────────────────────────────────────────────────────────────────│
│  FS Punchline                                   │     0 files │ Started  │🗑│
│  If [Flying Sparks Punchline Crossover PDF]     │             │ 09/27/24 │ │
│  is in order, distribute Punchline Crossover.   │             │[Refresh] │ │
│  Lockdown/Payment is not required.              │             │          │ │
│  ───────────────────────────────────────────────────────────────────────────│
│  Meta-Man                                       │     0 files │ Started  │🗑│
│  If [Meta-Man Special Digital] is in the        │             │ 09/27/24 │ │
│  order, distribute Meta-Man Special.            │             │[Refresh] │ │
│  Lockdown/Payment is not required.              │             │          │ │
│  ───────────────────────────────────────────────────────────────────────────│
│  Issue 0                                        │     0 files │ Started  │🗑│
│  If [Flying Sparks Issue #0 PDF] is in the      │             │ 09/27/24 │ │
│  order, distribute Flying Sparks Issue 0.       │             │[Refresh] │ │
│  Lockdown/Payment is not required.              │             │          │ │
│  ───────────────────────────────────────────────────────────────────────────│
│  CD1                                            │     0 files │ Started  │🗑│
│  If [CD1 Digital] is in the order, distribute   │             │ 09/27/24 │ │
│  CD1 file. Lockdown/Payment is not required.    │             │[Refresh] │ │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Table Dimensions:
- Distribution Rule column: 55% width
- Distributed column: 100px
- Status column: 120px (includes refresh button)
- Delete icon column: 40px
- Row height: 80px minimum (multi-line content)
- Row padding: 16px vertical

Tag styling (product names in brackets):
- Background: #e8e8e8
- Padding: 4px 8px
- Border-radius: 4px
- Font-size: 13px

Link styling (file names, "is not required"):
- Color: teal (#4a9b9b)
- Text-decoration: underline on hover

Refresh Button:
- Background: teal
- Text: white
- Padding: 4px 12px
- Border-radius: 4px
- Font-size: 12px
- Icon: 🔄 refresh icon

Delete Icon (🗑):
- Color: #c53030 (red) on hover
- Color: #a0a0a0 (gray) default
- Size: 20px
- Cursor: pointer
- Click: Confirmation modal before deletion

Status Column:
- "Started" text: 14px
- Date: 12px gray, below Started
- Format: MM/DD/YY

Distributed Column:
- Number + "files" text
- Bold number
- 0 files: gray text (indicates no matching orders yet)
```

### Create Distribution Modal

When clicking the "Create" button, a modal appears to set up a new distribution rule.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Create Distribution Rule                                              ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Rule Name *                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Flying Sparks Vol 3 Digital                                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  When should this file be distributed?                                      │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  If this product is in the order:                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Flying Sparks Volume 3 Digital                                     ▼ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Dropdown shows all digital products/SKUs                                   │
│                                                                             │
│  Then distribute this file:                                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │              📎 Drag & drop file here or click to browse              │  │
│  │                                                                       │  │
│  │              Supported: PDF, ZIP, EPUB (max 500MB)                    │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Or select existing file:                                                   │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Select from uploaded files...                                      ▼ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Distribution Requirements                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  When should backers receive this file?                                     │
│                                                                             │
│  ☐ Require survey completion                                                │
│  ☐ Require order lockdown                                                   │
│  ☐ Require payment (balance = $0)                                           │
│                                                                             │
│  ℹ If none selected, file distributes immediately when rule is started     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Notification                                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ☑ Send email notification when file is available                           │
│                                                                             │
│                                 [Cancel]  [Create Distribution]             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Modal Dimensions:
- Width: 560px
- Max-height: 80vh
- Overflow: auto

Upload Zone:
- Border: 2px dashed #e0e0e0
- Background: #f9f9f9
- Border-radius: 8px
- Height: 120px
- Hover: border-color #4a9b9b

File Progress (during upload):
- Progress bar: teal fill
- Percentage text
- Cancel button
```

---

## Backer Management

### Individual Backer View Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Pledge #37408853   [View/Edit as Backer] [Resend] [https://...] [?] [Actions▼]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │  Status                         │  │  Shipping Information    [Edit] │   │
│  │  ─────────────────────────────  │  │  ─────────────────────────────  │   │
│  │  ┌───────────────────────────┐  │  │  United States of America      │   │
│  │  │ SURVEY NOT COMPLETED      │  │  │                                │   │
│  │  └───────────────────────────┘  │  │  ⚠ Address Incomplete          │   │
│  │  Badge: red background, white   │  │  Address City, Line 1, Postal  │   │
│  │  • Address information required │  │  Code, Phone Number, and State │   │
│  │  • Survey question completion   │  │  are missing                   │   │
│  │    required                     │  │                                │   │
│  └─────────────────────────────────┘  └─────────────────────────────────┘   │
│                                                                             │
│  Two-column layout: 50% / 50%                                               │
│  Card height: auto (content-based)                                          │
│  Card padding: 20px                                                         │
│  Gap: 24px                                                                  │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Order] [Digital Downloads] [Shipping] [Packages] [Emails] [Segments] [Changelog] │
│  Tab navigation: horizontal, full width                                     │
│  Active tab: bold text, bottom border 3px teal                              │
│  Tab padding: 12px 16px                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │  Balance                        │  │  Items (3)           [Pack List]│   │
│  │  ─────────────────────────────  │  │  ─────────────────────────────  │   │
│  │                                 │  │  Pledge Items (6)         QTY  │   │
│  │  Amount Pledged                 │  │  ─────────────────────────────  │   │
│  │  ✓ Kickstarter (Collected)      │  │  Flying Sparks Vol 1 Digital  1│   │
│  │  View pledge on Kickstarter »   │  │  Justified E-Book             1│   │
│  │                      ($50.00)   │  │  overmind pdf                 1│   │
│  │                                 │  │  overmind tpb                 1│   │
│  │  Pledge Level                   │  │  the immortal edge paperback  1│   │
│  │  $40 - 1st Appearances...       │  │  the immortal edge pdf        1│   │
│  │                       $40.00    │  │  ─────────────────────────────  │   │
│  │                                 │  │  Manually Added Items (0)   QTY│   │
│  │  Add-ons                        │  │  nothing added                 │   │
│  │  No items added - Edit          │  │                                │   │
│  │                        $0.00    │  │              [+ Add SKUs]      │   │
│  │                                 │  │                                │   │
│  │  Shipping                       │  └─────────────────────────────────┘   │
│  │  + Pledge Level Shipping (US)   │                                        │
│  │                       $10.00    │                                        │
│  │                                 │                                        │
│  │  Payment                        │                                        │
│  │  ─────────────────────────────  │                                        │
│  │  Balance               $0.00    │                                        │
│  │  (green text for $0 balance)    │                                        │
│  └─────────────────────────────────┘                                        │
│                                                                             │
│  Left column: 55% width                                                     │
│  Right column: 45% width                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Header Bar Dimensions:
- Height: 60px
- Pledge ID font: 18px bold
- Button heights: 36px
- Button gap: 8px

Status Badge:
- Background: #c53030 (red)
- Text: white, uppercase, 12px, bold
- Padding: 6px 12px
- Border-radius: 4px

Balance Section:
- Line item label: left-aligned
- Line item value: right-aligned
- Row height: 32px
- Divider line: 1px solid #e0e0e0

Items List:
- Header row: bold, gray background
- QTY column: 50px, right-aligned
- Item name: flexible width
- Row height: 36px
```

---

## Backer List & Search

### Backer Table View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Backers                                        [Export ▼] [+ Add Backer]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────┐  Showing 684 backers              │
│  │ 🔍 Search by name, email, or ID...  │  [Filter ▼] [Sort: Recent ▼]      │
│  └─────────────────────────────────────┘                                    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ☐  │ Name              │ Email                │ Pledge    │ Status    │   │
│ ────┼───────────────────┼──────────────────────┼───────────┼───────────┼───│
│  ☐  │ John Smith        │ john@email.com       │ $50.00    │ ✅ Ready  │ ⋯ │
│  ☐  │ Jane Doe          │ jane@email.com       │ $100.00   │ ✅ Ready  │ ⋯ │
│  ☐  │ Bob Wilson        │ bob@email.com        │ $25.00    │ ⚠ Survey  │ ⋯ │
│  ☐  │ Alice Johnson     │ alice@email.com      │ $50.00    │ ❌ Error  │ ⋯ │
│  ☐  │ Mike Brown        │ mike@email.com       │ $10.00    │ ✅ Ready  │ ⋯ │
│  ☐  │ Sarah Davis       │ sarah@email.com      │ $75.00    │ ✅ Shipped│ ⋯ │
│  ☐  │ Tom Miller        │ tom@email.com        │ $50.00    │ ⚠ Address │ ⋯ │
│  ☐  │ Emily Clark       │ emily@email.com      │ $200.00   │ ✅ Ready  │ ⋯ │
│ ────┼───────────────────┼──────────────────────┼───────────┼───────────┼───│
│                                                                             │
│  ☐ Select All                                                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  « Previous    Page 1 of 69    Next »                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Table Styling:
- Row height: 56px
- Checkbox column: 48px
- Name column: 180px
- Email column: 220px (truncate with ellipsis)
- Pledge column: 100px, right-aligned
- Status column: 100px
- Actions column: 48px (⋯ menu)

Status Indicators:
- ✅ Ready: Green - ready to ship
- ✅ Shipped: Green - already shipped
- ⚠ Survey: Yellow - survey incomplete
- ⚠ Address: Yellow - address issue
- ❌ Error: Red - payment or critical error

Row Hover:
- Background: #f9f9f9
- Entire row clickable (opens backer detail)
```

### Bulk Selection & Actions

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ☑ 23 backers selected                                              │    │
│  │                                                                     │    │
│  │  [Send Reminder]  [Charge Cards]  [Export Selected]  [More ▼]  [×]  │    │
│  │                                                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘

Bulk Action Bar:
- Position: sticky bottom of table
- Background: #4a9b9b (teal)
- Text: white
- Height: 60px
- Padding: 0 24px
- Shadow: 0 -2px 8px rgba(0,0,0,0.1)

Appears when: 1+ rows selected
× button: Clears selection

More ▼ Options:
- Add to Segment
- Remove from Segment
- Lock Orders
- Unlock Orders
- Mark as Shipped
```

### Search & Filter

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Search Results: "john"                                      [Clear Search] │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Found 12 backers matching "john"                                           │
│                                                                             │
│  Searched in:                                                               │
│  • Name                                                                     │
│  • Email                                                                    │
│  • Pledge ID                                                                │
│  • Address                                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Search Input:
- Width: 300px
- Height: 44px
- Icon: 🔍 left-aligned inside input
- Placeholder: "Search by name, email, or ID..."
- Debounce: 300ms
```

### Filter Panel

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Filter Backers                                                        ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Survey Status                                                              │
│  ☐ Completed                                                                │
│  ☐ Pending                                                                  │
│  ☐ Not Sent                                                                 │
│                                                                             │
│  Payment Status                                                             │
│  ☐ Fully Paid                                                               │
│  ☐ Balance Due                                                              │
│  ☐ Payment Failed                                                           │
│                                                                             │
│  Pledge Level                                                               │
│  ☐ $10 - Digital Only                                                       │
│  ☐ $25 - Single Book                                                        │
│  ☐ $50 - Complete Set                                                       │
│  ☐ $100 - Collector's Edition                                               │
│                                                                             │
│  Shipping Region                                                            │
│  ☐ United States                                                            │
│  ☐ Canada                                                                   │
│  ☐ United Kingdom                                                           │
│  ☐ EU Countries                                                             │
│  ☐ Rest of World                                                            │
│                                                                             │
│  Order Status                                                               │
│  ☐ Not Pushed                                                               │
│  ☐ Pushed                                                                   │
│  ☐ Shipped                                                                  │
│  ☐ Push Errored                                                             │
│                                                                             │
│  Date Range                                                                 │
│  Pledged: [Start Date] to [End Date]                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│                              [Clear All]  [Apply Filters]                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Filter Panel:
- Width: 320px
- Position: slides in from right (drawer)
- Background: white
- Shadow: -4px 0 12px rgba(0,0,0,0.1)
- z-index: 100

Active Filters Display:
- Pills below search bar
- Each filter shows as removable tag
- "Clear All" link when filters active
```

### Sort Options

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Sort: [Recent ▼]                                                           │
│        ┌─────────────────────────┐                                          │
│        │ Recent (default)        │  ← Most recent activity                  │
│        │ Name (A-Z)              │                                          │
│        │ Name (Z-A)              │                                          │
│        │ Pledge (High to Low)    │                                          │
│        │ Pledge (Low to High)    │                                          │
│        │ Pledge Date (Newest)    │                                          │
│        │ Pledge Date (Oldest)    │                                          │
│        │ Survey Completion       │                                          │
│        └─────────────────────────┘                                          │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pagination

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  « Previous    Page 1 of 69    Next »                                       │
│                                                                             │
│  Show: [10 ▼] per page                                                      │
│        ┌─────────┐                                                          │
│        │ 10      │                                                          │
│        │ 25      │                                                          │
│        │ 50      │                                                          │
│        │ 100     │                                                          │
│        └─────────┘                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Pagination Styling:
- Position: bottom of table
- Text-align: center
- Previous/Next: teal links, disabled when at boundary
- Page indicator: "Page X of Y" gray text
- Per-page selector: right-aligned dropdown
```

---

## Backer Detail Tabs

The backer detail page has multiple tabs for different information views.

### Tab Navigation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Order] [Digital Downloads] [Shipping] [Packages] [Emails] [Segments] [Changelog] │
│    ↑                                                                        │
│  Active tab: bold, teal underline                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Order Tab (Default)

Shows pledge level, items, add-ons, and balance. (Already documented in Backer Management section)

### Digital Downloads Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Digital Downloads                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Available Downloads (3)                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📥 Flying Sparks Vol 1.pdf                                         │    │
│  │  Distributed: 10/13/2024 at 2:45 PM                                 │    │
│  │  Downloaded: Yes (3 times)                                          │    │
│  │                                           [Resend Notification]     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📥 Flying Sparks Vol 2.pdf                                         │    │
│  │  Distributed: 10/13/2024 at 2:45 PM                                 │    │
│  │  Downloaded: No                                                     │    │
│  │                                           [Resend Notification]     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📥 Bonus Art Pack.zip                                              │    │
│  │  Distributed: 10/14/2024 at 9:00 AM                                 │    │
│  │  Downloaded: Yes (1 time)                                           │    │
│  │                                           [Resend Notification]     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Pending Downloads (1)                                                      │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ⏳ Exclusive Wallpapers.zip                                        │    │
│  │  Status: Awaiting payment                                           │    │
│  │  Will distribute when: Balance paid in full                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Shipping Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Shipping                                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Shipping Address                                              [Edit]       │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  John Smith                                                                 │
│  123 Main Street                                                            │
│  Apt 4B                                                                     │
│  New York, NY 10001                                                         │
│  United States                                                              │
│  Phone: (555) 123-4567                                                      │
│                                                                             │
│  ✅ Address validated                                                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Shipping Method                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Zone: United States (Domestic)                                             │
│  Rate: $5.00 (base) + $1.50 (per item × 2) = $8.00                         │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Address Lock Status                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  🔓 Address is unlocked                                                     │
│  Backer can still edit their address via survey                             │
│                                                                             │
│  [Lock Address]                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Address Validation & Correction

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚠ Address Validation Issue                                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  The following issues were found:                                           │
│                                                                             │
│  • Street address not found                                                 │
│  • ZIP code doesn't match city/state                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Original Address:              Suggested Address:                          │
│  ┌─────────────────────────┐    ┌─────────────────────────┐                 │
│  │ 123 Main Stret          │    │ 123 Main Street         │                 │
│  │ New York, NY 10001      │    │ New York, NY 10001      │                 │
│  └─────────────────────────┘    └─────────────────────────┘                 │
│                                                                             │
│  [Keep Original]  [Use Suggested]  [Edit Manually]                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Packages Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Packages                                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Package #1 - Domestic US                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Status: ✅ Shipped                                                         │
│  Carrier: USPS Priority Mail                                                │
│  Tracking: 9400111899223456789012                                           │
│  Shipped: 11/15/2024                                                        │
│  Delivered: 11/18/2024                                                      │
│                                                                             │
│  Items in this package:                                                     │
│  • Flying Sparks Volume 1 (Physical) × 1                                    │
│  • Flying Sparks Volume 2 (Physical) × 1                                    │
│  • Collector's Art Print × 1                                                │
│                                                                             │
│  Total Weight: 1 lb 4 oz                                                    │
│                                                                             │
│  [Track Package]  [View in ShipStation]                                     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Package #2 - Bonus Items                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Status: ⏳ Not yet shipped                                                 │
│  Reason: Waiting for item to arrive from printer                            │
│                                                                             │
│  Items in this package:                                                     │
│  • Limited Edition Slipcase × 1                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Emails Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Emails                                                     [Send Email ▼]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Email History (7 emails)                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📧 Survey Invitation                                               │    │
│  │  Sent: 09/15/2024 at 10:00 AM                                       │    │
│  │  Status: ✅ Opened                                                   │    │
│  │                                                 [View] [Resend]      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📧 Survey Reminder #1                                              │    │
│  │  Sent: 09/22/2024 at 10:00 AM                                       │    │
│  │  Status: ✅ Opened, Clicked                                          │    │
│  │                                                 [View] [Resend]      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📧 Digital Download Available                                      │    │
│  │  Sent: 10/13/2024 at 2:45 PM                                        │    │
│  │  Status: ✅ Opened, Downloaded                                       │    │
│  │                                                 [View] [Resend]      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  📧 Shipping Notification                                           │    │
│  │  Sent: 11/15/2024 at 3:30 PM                                        │    │
│  │  Status: ✅ Opened                                                   │    │
│  │                                                 [View] [Resend]      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  [Load More]                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Email Status Icons:
- ✅ Opened: Green checkmark
- 📤 Sent: Gray (not yet opened)
- ❌ Bounced: Red X
- ⚠ Spam: Yellow warning
```

### Segments Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Segments                                                   [+ Add Segment] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  This backer belongs to the following segments:                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  [Collector's Edition Backers]                                  [×]  │  │
│  │  Applied: 09/15/2024                                                 │  │
│  │  Criteria: Pledge Level = $100 - Collector's Edition                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  [US Domestic]                                                  [×]  │  │
│  │  Applied: 09/15/2024                                                 │  │
│  │  Criteria: Shipping Region = United States                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  [VIP - Repeat Backers]                                         [×]  │  │
│  │  Applied: 10/01/2024 (manually added)                                │  │
│  │  Criteria: Manual segment                                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Segment Tag:
- Background: #e8e8e8
- Padding: 8px 12px
- Border-radius: 4px
- × removes backer from segment
```

### Changelog Tab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Changelog                                                    [Filter ▼]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Complete history of changes to this backer's order.                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Nov 18, 2024                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  3:45 PM   Package delivered                                        │    │
│  │            USPS tracking: Delivered, Front Door                     │    │
│  │            System                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Nov 15, 2024                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  3:30 PM   Shipping notification sent                               │    │
│  │            Email: Shipping Notification                             │    │
│  │            System                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  3:15 PM   Order marked as shipped                                  │    │
│  │            Carrier: USPS Priority Mail                              │    │
│  │            Tracking: 9400111899223456789012                         │    │
│  │            admin@creator.com                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  2:00 PM   Order pushed to ShipStation                              │    │
│  │            Package Group #643455                                    │    │
│  │            System                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Oct 13, 2024                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  2:45 PM   Digital download distributed                             │    │
│  │            File: Flying Sparks Vol 1.pdf                            │    │
│  │            System                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Sep 20, 2024                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  4:12 PM   Address updated by backer                                │    │
│  │            Changed: Street address, ZIP code                        │    │
│  │            john@email.com (via survey)                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Sep 18, 2024                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  11:30 AM  Card charged successfully                                │    │
│  │            Amount: $8.00 (shipping)                                 │    │
│  │            System                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  11:00 AM  Survey completed                                         │    │
│  │            All required fields submitted                            │    │
│  │            john@email.com                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Sep 15, 2024                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  10:00 AM  Survey invitation sent                                   │    │
│  │            Email: Survey Invitation                                 │    │
│  │            System                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  9:00 AM   Backer imported from Kickstarter                         │    │
│  │            Pledge: $50.00 - Complete Set                            │    │
│  │            System                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  [Load More]                                                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Changelog Entry:
- Time: 12px gray, left column
- Action: 14px bold, main description
- Details: 14px gray, additional info
- Actor: 12px gray italic (who made change)

Actor Types:
- System: Automated action
- admin@creator.com: Creator/team member action
- john@email.com: Backer action (via survey)
```

### Actions Dropdown Contents

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Actions ▼]                                                                │
│  ┌─────────────────────────────────┐                                        │
│  │ View as Backer                  │  ← Opens backer's survey view          │
│  │ ─────────────────────────────── │                                        │
│  │ Resend Survey                   │                                        │
│  │ Send Custom Email               │                                        │
│  │ ─────────────────────────────── │                                        │
│  │ Lock Order                      │                                        │
│  │ Unlock Order                    │                                        │
│  │ Lock Address                    │                                        │
│  │ ─────────────────────────────── │                                        │
│  │ Charge Card                     │                                        │
│  │ Issue Refund                    │                                        │
│  │ ─────────────────────────────── │                                        │
│  │ Add Note                        │                                        │
│  │ Add to Segment                  │                                        │
│  │ ─────────────────────────────── │                                        │
│  │ Cancel Order                    │  ← Red text, destructive               │
│  │ Delete Backer                   │  ← Red text, destructive               │
│  └─────────────────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘

Dropdown Styling:
- Width: 200px
- Background: white
- Border: 1px solid #e0e0e0
- Border-radius: 4px
- Shadow: 0 4px 12px rgba(0,0,0,0.15)
- Dividers: 1px solid #e0e0e0
- Item height: 40px
- Item padding: 8px 16px
- Hover: light gray background
- Destructive items: #c53030 text color
```

---

## Segments & Export

### Segments Overview

Segments allow you to group backers based on criteria for targeted communications and fulfillment management.

### Segments Sidebar Item

```
┌────────────────────────────────────────┐
│  Segments                              │
│  Click to view/manage backer segments  │
└────────────────────────────────────────┘

Position: Main navigation sidebar
Below: Counts
Above: Fulfillment
```

### Segment Types

| Segment Type | Description | Use Case |
|--------------|-------------|----------|
| **By Pledge Level** | Groups based on reward tier | Tier-specific communications |
| **By Add-on** | Backers who purchased specific add-ons | Add-on fulfillment tracking |
| **By Survey Status** | Complete vs incomplete surveys | Reminder targeting |
| **By Shipping Region** | Domestic vs International | Shipping wave planning |
| **By Payment Status** | Charged, errored, pending | Payment follow-up |
| **Custom Segments** | User-defined criteria | Flexible grouping |

### Export Functionality

Export backer data for external processing, print fulfillment, or backup.

### Export Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Export                                                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Export Options:                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ○ All Backers                                                        │  │
│  │  ○ By Segment: [Dropdown ▼]                                           │  │
│  │  ○ By Package Group                                                   │  │
│  │  ○ Ready to Ship Only                                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Export Format:                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ○ CSV (Spreadsheet)                                                  │  │
│  │  ○ PDF (Pack Lists)                                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Include Fields:                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ☑ Name            ☑ Email           ☑ Address                       │  │
│  │  ☑ Pledge Level    ☑ Items           ☑ Add-ons                       │  │
│  │  ☐ Phone           ☐ Survey Answers  ☐ Payment Details               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                           ┌─────────────────────┐                           │
│                           │  📥 Export Data     │                           │
│                           └─────────────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Package Group Export

Each package group card includes an export option:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⊞ Export reports for this group ▼                                          │
└─────────────────────────────────────────────────────────────────────────────┘

Dropdown Options:
- Export Pack List (PDF)
- Export Addresses (CSV)
- Export Full Details (CSV)

Icon: Grid icon (⊞)
Text: teal link color
Chevron: indicates expandable dropdown
```

---

## Backer Support

### Overview

Backer Support provides tools for managing individual backer inquiries, issues, and communications.

### Sidebar Position

```
┌────────────────────────────────────────┐
│  ...                                   │
│  Pre-orders                            │
│  ────────────────────────────────────  │
│  Backer Support    ← Support section   │
│  ────────────────────────────────────  │
│  Export                                │
│  Settings                              │
│  ...                                   │
└────────────────────────────────────────┘
```

### Support Features

| Feature | Description |
|---------|-------------|
| **Search Backers** | Find backers by name, email, or pledge ID |
| **View as Backer** | See exactly what the backer sees in their survey |
| **Resend Survey** | Re-send survey link to backer's email |
| **Edit Order** | Manually adjust items, add-ons, or shipping |
| **Add Notes** | Internal notes visible only to creator |
| **Changelog** | Full history of all changes to backer's order |

### Quick Actions Header

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Pledge #37408853   [View/Edit as Backer] [Resend] [https://...] [📋] [?] [Actions▼]│
└─────────────────────────────────────────────────────────────────────────────┘

Button Descriptions:
- View/Edit as Backer: Opens backer's survey view (impersonation mode)
- Resend: Re-sends survey email to backer
- https://...: Survey link (truncated), with copy button
- 📋: Copy survey link to clipboard
- ?: Help tooltip
- Actions ▼: Dropdown with additional options

Button Styling:
- Height: 36px
- Background: white
- Border: 1px solid #e0e0e0
- Border-radius: 4px
- Font-size: 13px
- Gap between buttons: 8px
```

---

## Survey Builder

### Overview

Create and customize surveys to collect shipping addresses, preferences, and additional information from backers.

### Survey Builder Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Survey Builder                                      [Preview] [Save Draft] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────┬────────────────────────────────────────────────────┐│
│  │                    │                                                    ││
│  │  QUESTION TYPES    │  SURVEY PREVIEW                                    ││
│  │  ────────────────  │                                                    ││
│  │                    │  ┌────────────────────────────────────────────┐    ││
│  │  📝 Short Text     │  │  Shipping Address                          │    ││
│  │  📄 Long Text      │  │  ─────────────────────────────────────     │    ││
│  │  ○ Multiple Choice │  │                                            │    ││
│  │  ☑ Checkboxes      │  │  Name *                                    │    ││
│  │  ▼ Dropdown        │  │  ┌────────────────────────────────────┐    │    ││
│  │  📍 Address        │  │  │                                    │    │    ││
│  │  📧 Email          │  │  └────────────────────────────────────┘    │    ││
│  │  📱 Phone          │  │                                            │    ││
│  │  📅 Date           │  │  Street Address *                          │    ││
│  │  🔢 Number         │  │  ┌────────────────────────────────────┐    │    ││
│  │  📎 File Upload    │  │  │                                    │    │    ││
│  │  ─ Section Break   │  │  └────────────────────────────────────┘    │    ││
│  │  ℹ Info Text       │  │                                            │    ││
│  │                    │  │  City *           State *    ZIP *         │    ││
│  │  Drag to add       │  │  ┌──────────┐    ┌──────┐   ┌────────┐    │    ││
│  │                    │  │  │          │    │      │   │        │    │    ││
│  │                    │  │  └──────────┘    └──────┘   └────────┘    │    ││
│  │                    │  │                                            │    ││
│  │                    │  │  Country *                                 │    ││
│  │                    │  │  ┌────────────────────────────────── ▼┐    │    ││
│  │                    │  │  │ United States                      │    │    ││
│  │                    │  │  └────────────────────────────────────┘    │    ││
│  │                    │  │                                            │    ││
│  │                    │  └────────────────────────────────────────────┘    ││
│  │                    │                                                    ││
│  │                    │  [+ Add Question]                                  ││
│  │                    │                                                    ││
│  └────────────────────┴────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Left Panel (Question Types):
- Width: 200px
- Background: #f5f5f5
- Draggable items

Right Panel (Preview):
- Width: flexible
- Background: white
- Shows live preview of survey
```

### Question Editor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Edit Question                                                         ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Question Type: Multiple Choice                                             │
│                                                                             │
│  Question Text *                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Which shirt size would you like?                                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Help Text (optional)                                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Select the size that fits you best. See size chart below.             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Options                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐            │
│  │ ≡  Small                                                [🗑]│            │
│  ├─────────────────────────────────────────────────────────────┤            │
│  │ ≡  Medium                                               [🗑]│            │
│  ├─────────────────────────────────────────────────────────────┤            │
│  │ ≡  Large                                                [🗑]│            │
│  ├─────────────────────────────────────────────────────────────┤            │
│  │ ≡  X-Large                                              [🗑]│            │
│  └─────────────────────────────────────────────────────────────┘            │
│  [+ Add Option]                                                             │
│  ≡ = drag handle for reordering                                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Settings                                                                   │
│  ☑ Required                                                                 │
│  ☐ Allow "Other" option with text field                                     │
│                                                                             │
│  Conditional Logic                                                          │
│  ☐ Only show this question if...                                            │
│     [Question ▼] [equals ▼] [Value ▼]                                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│                              [Cancel]  [Save Question]                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Survey Settings

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Survey Settings                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  General                                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Survey Title                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Flying Sparks Backer Survey                                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Welcome Message                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Thank you for backing Flying Sparks! Please complete this survey to   │  │
│  │ confirm your shipping address and reward selections.                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Deadline                                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ☑ Set a deadline for survey completion                                     │
│                                                                             │
│  Deadline Date *                    Deadline Time                           │
│  ┌────────────────────────┐        ┌────────────────────────┐               │
│  │ 📅 December 31, 2024   │        │ 🕐 11:59 PM            │               │
│  └────────────────────────┘        └────────────────────────┘               │
│                                                                             │
│  ☑ Show countdown timer on survey                                           │
│  ☑ Lock orders automatically after deadline                                 │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Notifications                                                              │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ☑ Send reminder emails to non-responders                                   │
│     Frequency: [Every 2 weeks ▼]                                            │
│     Max reminders: [3 ▼]                                                    │
│                                                                             │
│                              [Cancel]  [Save Settings]                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Survey Reminder Email Template

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Survey Reminder Email                                              [Edit]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Subject: Don't forget! Complete your Flying Sparks survey                  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Hi {backer_name},                                                          │
│                                                                             │
│  We noticed you haven't completed your backer survey for Flying Sparks      │
│  yet. We need your shipping information to send your rewards!               │
│                                                                             │
│  Survey deadline: {deadline_date}                                           │
│                                                                             │
│  Time remaining: {days_remaining} days                                      │
│                                                                             │
│                    [Complete Your Survey]                                   │
│                                                                             │
│  If you have any questions, please reply to this email.                     │
│                                                                             │
│  Thanks for your support!                                                   │
│  {creator_name}                                                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Available Variables:                                                       │
│  {backer_name}, {backer_email}, {pledge_amount}, {pledge_level},            │
│  {deadline_date}, {days_remaining}, {survey_link}, {creator_name},          │
│  {project_name}                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pledge Levels & Add-ons

### Pledge Level Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Pledge Levels                                           [+ Add Pledge Level]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Drag to reorder pledge levels                                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ≡  $10 - Digital Only                                  [Edit] [🗑]  │    │
│  │    245 backers · $2,450 raised                                      │    │
│  │    ────────────────────────────────────────────────────────────     │    │
│  │    Includes: Digital PDF bundle                                     │    │
│  │    Shipping: None (digital only)                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ≡  $25 - Single Book                                   [Edit] [🗑]  │    │
│  │    189 backers · $4,725 raised                                      │    │
│  │    ────────────────────────────────────────────────────────────     │    │
│  │    Includes: 1× Physical book, Digital PDF bundle                   │    │
│  │    Shipping: Domestic $5, International $15                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ≡  $50 - Complete Set                                  [Edit] [🗑]  │    │
│  │    156 backers · $7,800 raised                                      │    │
│  │    ────────────────────────────────────────────────────────────     │    │
│  │    Includes: 3× Physical books, Digital PDF bundle, Art print       │    │
│  │    Shipping: Domestic $8, International $22                         │    │
│  │    ★ Most Popular                                                   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ≡  $100 - Collector's Edition                          [Edit] [🗑]  │    │
│  │    94 backers · $9,400 raised                                       │    │
│  │    ────────────────────────────────────────────────────────────     │    │
│  │    Includes: 3× Signed books, Slipcase, Art print, Sketch, Name in  │    │
│  │              credits                                                │    │
│  │    Shipping: Domestic $12, International $35                        │    │
│  │    ⚡ Limited (6 remaining)                                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Pledge Level Editor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Edit Pledge Level                                                     ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Basic Information                                                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Title *                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Collector's Edition                                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Price *                                                                    │
│  ┌─────────────────────┐                                                    │
│  │ $        100.00     │                                                    │
│  └─────────────────────┘                                                    │
│                                                                             │
│  Description                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ The ultimate package for serious collectors. Includes signed copies   │  │
│  │ of all three volumes in a custom slipcase, plus exclusive art print  │  │
│  │ and original sketch.                                                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Included Items                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [Flying Sparks Vol 1 (Signed) ×]  Qty: [1]                    [🗑] │    │
│  │  [Flying Sparks Vol 2 (Signed) ×]  Qty: [1]                    [🗑] │    │
│  │  [Flying Sparks Vol 3 (Signed) ×]  Qty: [1]                    [🗑] │    │
│  │  [Collector's Slipcase ×]          Qty: [1]                    [🗑] │    │
│  │  [Art Print ×]                     Qty: [1]                    [🗑] │    │
│  │  [Original Sketch ×]               Qty: [1]                    [🗑] │    │
│  │  [Digital PDF Bundle ×]            Qty: [1]                    [🗑] │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  [+ Add Item]                                                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Shipping                                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ○ No shipping (digital only)                                               │
│  ● Use shipping zones                                                       │
│  ○ Custom shipping for this level                                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Limits                                                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ☑ Limit quantity available                                                 │
│     Total available: [100]  Remaining: 6                                    │
│                                                                             │
│                              [Cancel]  [Save Pledge Level]                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Add-on Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Add-ons                                                    [+ Add Add-on]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Available add-ons shown to backers during survey completion.               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Extra Volume 1 Copy                                   [Edit] [🗑]  │    │
│  │  $20.00 · 45 sold · $900 raised                                     │    │
│  │  ────────────────────────────────────────────────────────────────   │    │
│  │  Item: Flying Sparks Vol 1 (Physical) × 1                           │    │
│  │  Shipping: +$3.00 domestic, +$8.00 international                    │    │
│  │  Limit: 3 per backer                                                │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Art Print Set                                         [Edit] [🗑]  │    │
│  │  $15.00 · 78 sold · $1,170 raised                                   │    │
│  │  ────────────────────────────────────────────────────────────────   │    │
│  │  Item: Art Print Set × 1                                            │    │
│  │  Shipping: +$2.00 domestic, +$5.00 international                    │    │
│  │  Limit: 1 per backer                                                │    │
│  │  ⚠ Only for: $50+ pledge levels                                     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Digital Wallpaper Pack                                [Edit] [🗑]  │    │
│  │  $5.00 · 120 sold · $600 raised                                     │    │
│  │  ────────────────────────────────────────────────────────────────   │    │
│  │  Item: Wallpaper Pack (Digital) × 1                                 │    │
│  │  Shipping: None (digital)                                           │    │
│  │  Limit: None                                                        │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Add-on Editor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Add Add-on                                                            ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Add-on Name *                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Art Print Set                                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Price *                                                                    │
│  ┌─────────────────────┐                                                    │
│  │ $        15.00      │                                                    │
│  └─────────────────────┘                                                    │
│                                                                             │
│  Description                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Set of 3 full-color art prints featuring cover art from each volume. │  │
│  │ Printed on premium cardstock.                                         │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Product/SKU *                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Art Print Set                                                      ▼ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Shipping                                                                   │
│  ○ No additional shipping                                                   │
│  ● Add shipping cost                                                        │
│     Domestic: [$2.00]  International: [$5.00]                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Availability                                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ☐ Limit quantity available: [___]                                          │
│  ☑ Limit per backer: [1]                                                    │
│  ☑ Restrict to specific pledge levels:                                      │
│     ☐ $10 - Digital Only                                                    │
│     ☐ $25 - Single Book                                                     │
│     ☑ $50 - Complete Set                                                    │
│     ☑ $100 - Collector's Edition                                            │
│                                                                             │
│                              [Cancel]  [Save Add-on]                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Product & SKU Management

### Product List

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Products                                                  [+ Add Product]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 🔍 Search products...                                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Filter: [All Types ▼] [All Status ▼]                                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  │ SKU          │ Name                    │ Type    │ Weight │ Status │    │
│  │──────────────┼─────────────────────────┼─────────┼────────┼────────│    │
│  │ FS-VOL1-PHY  │ Flying Sparks Vol 1     │Physical │ 8 oz   │ ✅ Ready│    │
│  │ FS-VOL2-PHY  │ Flying Sparks Vol 2     │Physical │ 8 oz   │ ✅ Ready│    │
│  │ FS-VOL3-PHY  │ Flying Sparks Vol 3     │Physical │ 8 oz   │ ✅ Ready│    │
│  │ FS-SLIP     │ Collector's Slipcase    │Physical │ 12 oz  │ ✅ Ready│    │
│  │ FS-ART      │ Art Print Set           │Physical │ 2 oz   │ ✅ Ready│    │
│  │ FS-SKETCH   │ Original Sketch         │Physical │ 1 oz   │ ✅ Ready│    │
│  │ FS-VOL1-DIG │ Flying Sparks Vol 1 PDF │ Digital │ —      │ ✅ Ready│    │
│  │ FS-VOL2-DIG │ Flying Sparks Vol 2 PDF │ Digital │ —      │ ✅ Ready│    │
│  │ FS-VOL3-DIG │ Flying Sparks Vol 3 PDF │ Digital │ —      │ ✅ Ready│    │
│  │ FS-WALLS    │ Wallpaper Pack          │ Digital │ —      │ ✅ Ready│    │
│  │ FS-VOL1-SGN │ Flying Sparks Vol 1 Sgd │Physical │ 8 oz   │ ⚠ NoWT │    │
│  │──────────────┼─────────────────────────┼─────────┼────────┼────────│    │
│                                                                             │
│  Showing 11 of 11 products                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Status Column:
- ✅ Ready: All info complete
- ⚠ NoWT: Missing weight
- ⚠ NoCust: Missing customs info
- ❌ Error: Critical issue
```

### Product Editor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Edit Product                                                          ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Basic Information                                                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Product Name *                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Flying Sparks Volume 1                                                │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  SKU *                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ FS-VOL1-PHY                                                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Type *                                                                     │
│  ○ Physical (requires shipping)                                             │
│  ● Digital (delivered electronically)                                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Physical Product Settings                                                  │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Weight *                                                                   │
│  ┌─────────────────┐  ┌───────────────┐                                     │
│  │       8         │  │ oz        ▼   │                                     │
│  └─────────────────┘  └───────────────┘                                     │
│                                                                             │
│  Dimensions (optional)                                                      │
│  ┌────────┐ × ┌────────┐ × ┌────────┐  ┌───────────────┐                    │
│  │   10   │   │   7    │   │  0.5   │  │ in        ▼   │                    │
│  └────────┘   └────────┘   └────────┘  └───────────────┘                    │
│  Length       Width        Height       Unit                                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Customs Information (required for international)                           │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  HS/Tariff Code *                                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 4901.99.00                                                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Common codes: 4901.99 (printed books), 4911.91 (prints/pictures)           │
│                                                                             │
│  Country of Origin *                                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ United States                                                      ▼ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Customs Description *                                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Printed comic book, graphic novel                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Declared Value *                                                           │
│  ┌─────────────────────┐                                                    │
│  │ $        25.00      │                                                    │
│  └─────────────────────┘                                                    │
│                                                                             │
│                              [Cancel]  [Save Product]                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Digital Product Settings

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Digital Product Settings                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  File Upload                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │              📎 Drag & drop file here or click to browse              │  │
│  │                                                                       │  │
│  │              Supported: PDF, ZIP, EPUB (max 500MB)                    │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Current File:                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  📄 Flying_Sparks_Vol1.pdf                              [🗑] [Replace]│  │
│  │  Uploaded: 10/01/2024 · 45.2 MB                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Distribution Settings                                                      │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ☑ Require survey completion before download                                │
│  ☐ Require payment before download                                          │
│  ☑ Send email notification when available                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Pre-Orders & Upselling

### Pre-Order Store

After your campaign ends, keep collecting orders through a pre-order store. This allows late backers to still support your project and adds revenue beyond the initial campaign.

### Launch Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏠 Launch   [Dashboard] [Email Campaigns] [Teaser Pages] [Projects] [Members]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Elven Destiny: A Men's Fantasy Harem Novel                                 │
│  Last Updated: 08/14/25 09:00 PDT                         [🔄 Update]       │
│                                                                             │
├────────────────────┬────────────────────────────────────────────────────────┤
│                    │                                                        │
│  PROJECT CARD      │  NEW VS RETURNING BACKERS (Chart)                      │
│  ────────────────  │  ─────────────────────────────────────────────────     │
│  Width: 260px      │  Width: flexible (remaining space)                     │
│                    │                                                        │
│  [Project Image]   │  ┌────────────────────────────────────────────────┐    │
│  160px × 200px     │  │                                                │    │
│                    │  │  Stacked bar chart with date x-axis            │    │
│  « 10th  Your 11th │  │  Height: 280px                                 │    │
│         project    │  │  Bars: light teal (returning) / dark teal (new)│    │
│         12th »     │  │  X-axis: dates (YYYY-MM-DD)                    │    │
│                    │  │  Y-axis: backer count (0-8 scale shown)        │    │
│  Elven Destiny:    │  └────────────────────────────────────────────────┘    │
│  A Men's Fantasy   │                                                        │
│  Harem Novel       │  ┌──────────────────────────────────────────────────┐  │
│                    │  │ █████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░│  │
│  [KS] View project │  │  Proportion bar: Returning vs New               │  │
│                    │  │  Height: 32px                                    │  │
│  $1,306            │  └──────────────────────────────────────────────────┘  │
│  pledged on        │                                                        │
│  Kickstarter       │  ┌─────────────────────────────────────────────────┐   │
│                    │  │                    Backers        Pledged       │   │
│  35 backers        │  │  ■ Returning         9 (19%)    $247 ($27.44/b) │   │
│                    │  │  ■ New Backers      26 (81%)  $1,059 ($40.73/b) │   │
│  $37.31            │  │  ─────────────────────────────────────────────  │   │
│  average pledge    │  │  Total              35         $1,306           │   │
│                    │  └─────────────────────────────────────────────────┘   │
│  0 Days to go      │                                                        │
│                    │                                                        │
└────────────────────┴────────────────────────────────────────────────────────┘

Project Card Styling:
- Background: white
- Border: 1px solid #e0e0e0
- Border-radius: 8px
- Padding: 16px
- Shadow: 0 2px 4px rgba(0,0,0,0.1)

Stats Typography:
- Dollar amount: 32px bold
- Label: 14px gray
- Line-height: 1.4

Pagination:
- « 10th | Your 11th project | 12th »
- Font: 14px
- Link color: teal

Platform Badge [KS]:
- Background: #05ce78 (Kickstarter green)
- Text: white, 10px bold
- Padding: 2px 6px
- Border-radius: 2px
```

### Project Pagination Component

Navigate between projects in your Launch account:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│            « 10th       Your 11th project       12th »                      │
│              ↑               ↑                    ↑                         │
│         Previous        Current (bold)         Next                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Pagination Styling:
- Position: Above project card, left-aligned
- Previous link: "« 10th" (teal, clickable)
- Current: "Your 11th project" (bold, black, not clickable)
- Next link: "12th »" (teal, clickable)
- Font-size: 14px
- Spacing: 16px between elements

Behavior:
- Arrows (« ») indicate direction
- Ordinal numbers (10th, 11th, 12th) show project position
- "Your Xth project" emphasizes current selection
- Wraps at first/last project (no previous/next shown)
```

### Pre-Order Referral Tracking

Track where your pre-order customers come from in the right sidebar panel:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Pre-orders                                                                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  43                                                                         │
│  (large number, 36px bold)                                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  Stacked horizontal bar showing referral source breakdown                   │
│  Height: 20px, border-radius: 4px                                           │
│                                                                             │
│  ■ www.youtube.com                                                    19    │
│  ■ www.kickstarter.com                                                12    │
│  ■ Other referrals                                                    12    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Pre-orders Panel Location:
- Position: Right sidebar, below Survey Completion
- Width: 280px (sidebar width)
- Background: white
- Padding: 20px
- Border-bottom: 1px solid #e0e0e0

Referral List Styling:
- Legend square: 12px × 12px, inline-block
- Source name: flexible width, 14px
- Count: right-aligned, 14px bold
- Row height: 28px
- Row spacing: 4px

Referral Bar Colors:
- Segment 1: #4a9b9b (teal)
- Segment 2: #7bc4c4 (light teal)  
- Segment 3: #a8a8a8 (gray for "other")
```

### Referral Sources Tracked

| Source | Description |
|--------|-------------|
| **www.youtube.com** | Traffic from YouTube videos, reviews, or creator ads |
| **www.kickstarter.com** | Traffic from your Kickstarter project page, creator profile, or Kickstarter search |
| **www.facebook.com** | Traffic from Facebook posts, groups, or paid ads |
| **Direct / None** | Direct URL entry or sources without referrer data |
| **Other referrals** | All other referring domains aggregated |

### Upselling Strategies

1. **Add-ons during survey** — Offer additional products when backers complete their surveys
2. **Pre-order store** — Keep open to new customers after campaign ends until fulfillment begins
3. **Email campaigns via Launch** — Target existing backers and mailing list members with new projects
4. **Cross-promotion** — Use Launch to promote new campaigns to your full member list across all projects

---

## Email Campaigns (Launch)

### Overview

The Launch platform is a separate but integrated tool for email marketing to your backer community across multiple crowdfunding projects. It enables cross-promotion between campaigns and list-building from previous backers.

### Project Import & Connection

Before sending email campaigns, you must connect your crowdfunding projects to Launch.

#### Project Selector Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Elven Destiny: A Men's Fantasy Harem Novel                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  🏠 Launch   [Dashboard] [Email Campaigns] [Teaser Pages] [Projects] [Members]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                                                                             │
│              Select the project for your new email campaign.                │
│                                                                             │
│              ┌─────────────────────────────────────────────────────────┐    │
│              │ [kickstarter] Flying Sparks Volumes 1-3 - 1510582802 ▼ │    │
│              └─────────────────────────────────────────────────────────┘    │
│              Dropdown: 560px wide, centered                                 │
│              Shows: [platform] Project Name - Project ID                    │
│                                                                             │
│              Don't see your new project? Add it here »                      │
│              Link: teal, centered below dropdown                            │
│                                                                             │
│              ┌─────────────────────────────────────────────────────────┐    │
│              │                        Next                             │    │
│              └─────────────────────────────────────────────────────────┘    │
│              Button: teal, 160px wide, centered                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Page Layout:
- Content max-width: 600px
- Centered in viewport
- Vertical centering with padding-top: 120px
- Heading: 28px, centered
```

#### Adding New Projects

When clicking "Add it here »", users can import projects from:
- Kickstarter (via project URL or ID)
- Indiegogo
- BackerKit Crowdfunding (native)
- Other platforms (manual setup)

**Project Data Imported:**
- Project name and ID
- Backer list with emails
- Pledge amounts
- Pledge dates
- Backer status (new vs returning)

### Backer Analytics Dashboard

The Launch dashboard provides insights into your backer community composition.

#### New vs Returning Backers Chart

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  New vs Returning Backers                                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │     8 ┤                                                             │    │
│  │       │ ██                                                          │    │
│  │     6 ┤ ██                                                          │    │
│  │       │ ██                                                     ██   │    │
│  │     4 ┤ ██                                                     ██   │    │
│  │       │ ██ ██                                              ██  ██   │    │
│  │     2 ┤ ██ ██ ██ ██ ██                    ██      ██  ██   ██  ██   │    │
│  │       │ ██ ██ ██ ██ ██ ██ ░░ ░░ ░░ ░░ ░░ ██ ░░ ░░ ██  ██   ██  ██   │    │
│  │     0 ┼─────────────────────────────────────────────────────────────│    │
│  │       07-15  07-18  07-21  07-24  07-27  07-30  08-02  08-05  08-08 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Chart type: Stacked bar chart                                              │
│  Height: 280px                                                              │
│  X-axis: Date (YYYY-MM-DD format)                                           │
│  Y-axis: Backer count                                                       │
│  Bar colors:                                                                │
│    - Light teal (#7bc4c4): Returning backers                                │
│    - Dark teal (#4a9b9b): New backers                                       │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ ████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│  Proportion bar: shows returning vs new at a glance                         │
│  Height: 32px                                                               │
│  Border-radius: 4px                                                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│                              Backers              Pledged                   │
│  ■ Returning Backers         9 (19%)      $247    $27.44/backer            │
│  ■ New Backers              26 (81%)    $1,059    $40.73/backer            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Total                      35          $1,306    $37.31/backer            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Summary Table:
- 3 columns: Category, Backers (count + %), Pledged (total + per-backer)
- Row height: 36px
- Alternating background: none (white)
- Legend squares: 12px, inline with row
```

#### Key Metrics Tracked

| Metric | Description |
|--------|-------------|
| **Returning Backers** | Backers who have supported previous projects in your Launch account |
| **New Backers** | First-time backers to any of your projects |
| **Average Pledge** | Total pledged ÷ number of backers |
| **Per-Backer Value** | Broken down by new vs returning for comparison |

### Member Management

Members are contacts imported from your crowdfunding projects who can receive email campaigns.

#### Member Sources

Members are automatically imported from:
- Kickstarter backers (via project connection)
- Pre-order customers
- Email list uploads
- Previous campaign backers

#### Member Filtering

When sending campaigns, filter your audience by:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Send To                                                                    │
│  1829                                                                       │
│  members who have not pledged to this project                               │
│                                                                             │
│  ┌────────────────────────┐  ┌─────────────────────┐                        │
│  │  ✉ Send Email Campaign │  │ 🔍 Filter Members   │                        │
│  └────────────────────────┘  └─────────────────────┘                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Available Filters:**
- Has not pledged to this project
- Has pledged to this project
- Backed specific previous projects
- Pledge amount ranges
- Geographic location
- Join date / recency

### Email Campaign List Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Elven Destiny: A Men's Fantasy Harem Novel                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  🏠 Launch   [Dashboard] [Email Campaigns] [Teaser Pages] [Projects] [Members]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Email Campaigns                               [Draft Your Next Email]      │
│                                                Button: outlined, right      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│ Status │      │ Title                    │ Sent on  │ Sent to │ Sched. │ Project │ Response │
│────────┼──────┼──────────────────────────┼──────────┼─────────┼────────┼─────────┼──────────│
│ [Draft]│ [img]│ Special Early Access:    │ never    │ 0       │ Not yet│ Elven   │ --       │
│        │      │ Elven Destiny...         │          │ members │        │ Destiny │          │
│────────┼──────┼──────────────────────────┼──────────┼─────────┼────────┼─────────┼──────────│
│ [Draft]│ [img]│ We're Getting Ready To   │ never    │ 1       │ Not yet│ All Eyes│ --       │
│        │      │ Print - Don't Miss It!   │          │ member  │        │ On Ashley│         │
│────────┼──────┼──────────────────────────┼──────────┼─────────┼────────┼─────────┼──────────│
│ [Sent] │ [img]│ 48 Hours Left: All Eyes  │ Feb 27,  │ 1662    │ Sent   │ All Eyes│ 2%       │
│        │      │ On Ashley - Don't Miss!  │ 2024     │ members │        │ On Ashley│         │
│        │      │                          │ 15:25    │         │        │         │          │
│────────┼──────┼──────────────────────────┼──────────┼─────────┼────────┼─────────┼──────────│
│ [Sent] │ [img]│ Pledge Early Now: All    │ Feb 21,  │ 1680    │ Sent   │ All Eyes│ 4%       │
│        │      │ Eyes On Ashley           │ 2024     │ members │        │ On Ashley│         │
│        │      │                          │ 16:08    │         │        │         │          │
│────────┼──────┼──────────────────────────┼──────────┼─────────┼────────┼─────────┼──────────│
│ [Sent] │ [img]│ An Amazing Launch For    │ Feb 02,  │ 1702    │ Sent   │ All Eyes│ 3%       │
│        │      │ All Eyes On Ashley       │ 2024     │ members │        │ On Ashley│         │
│        │      │                          │ 10:06    │         │        │         │          │
│────────┼──────┼──────────────────────────┼──────────┼─────────┼────────┼─────────┼──────────│
│ [Sent] │ [img]│ New Project Launched:    │ Jan 30,  │ 1747    │ Sent   │ All Eyes│ 7%       │
│        │      │ All Eyes On Ashley       │ 2024     │ members │        │ On Ashley│         │
│        │      │                          │ 14:37    │         │        │         │          │
│────────┼──────┼──────────────────────────┼──────────┼─────────┼────────┼─────────┼──────────│
│ [Sent] │ [img]│ Special Early Access:    │ Jan 08,  │ 1777    │ Sent   │ All Eyes│ 7%       │
│        │      │ All Eyes On Ashley       │ 2024     │ members │        │ On Ashley│         │
│        │      │                          │ 16:40    │         │        │         │          │
└────────┴──────┴──────────────────────────┴──────────┴─────────┴────────┴─────────┴──────────┘

Table Dimensions:
- Status column: 60px
- Thumbnail column: 80px (image: 60px × 40px, border-radius: 4px)
- Title column: flexible (min 240px)
- Sent on column: 100px
- Sent to column: 80px
- Scheduled for column: 80px
- Project column: 140px
- Response column: 70px, right-aligned

Status Badge Styling:
- Draft: gray background (#e0e0e0), dark text
- Sent: teal background (#4a9b9b), white text
- Padding: 4px 8px
- Border-radius: 4px
- Font-size: 11px
- Text-transform: uppercase

Response Rate:
- Shows click-through or conversion rate
- Displayed as percentage
- "--" for unsent campaigns
- Color: teal for rates > 5%, gray otherwise

Row height: 72px (to accommodate thumbnail)
Row hover: light gray background (#f9f9f9)
Click action: Opens email editor/details
```

### Response Tracking

The Response column tracks email engagement metrics:

| Metric | Description |
|--------|-------------|
| **Response Rate** | Percentage of recipients who clicked through to the project |
| **Calculation** | (Unique clicks ÷ Delivered emails) × 100 |
| **Typical Range** | 2-7% is normal for crowdfunding emails |

**Factors Affecting Response:**
- Subject line effectiveness
- Timing of send
- Audience segment targeting
- Email content relevance
- Call-to-action clarity

### Launch Timeline Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                    Your Launch Timeline                                     │
│          We'll help you send the right messages at the right times.        │
│                                                                             │
│  Center-aligned heading                                                     │
│  Heading: 32px                                                              │
│  Subheading: 16px gray                                                      │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│     ●───┐  ✉ Before Launch                              [Start draft]      │
│     │   │  Get your fans excited about your upcoming                        │
│     │   │  project and have them ready to pledge on                         │
│     │   │  day one.                                                         │
│     │   │  Send this before you launch and your project                     │
│     │   │  is still a draft.                                                │
│     │   │                                                                   │
│     ●───┤  ✉ Before Launch (w/ Kickstarter pre-launch)  [Start draft]      │
│     │   │  Get your fans excited about your upcoming project and have       │
│     │   │  them ready to pledge on day one by following your project on     │
│     │   │  Kickstarter.                                                     │
│     │   │  Send this before you launch your project and have a              │
│     │   │  Kickstarter pre-launch page.                                     │
│     │   │                                                                   │
│     ●───┤  ✉ At Launch                                  [Start draft]      │
│     │   │  Announce exclusively to your fans and get them in on your        │
│     │   │  Early Bird specials.                                             │
│     │   │  Send this right as you launch your project.                      │
│     │   │                                                                   │
│     ●───┤  ✉ After Launch                               [Start draft]      │
│     │   │  Remind those that were interested in your project but haven't    │
│     │   │  pledged yet that you're still counting on them.                  │
│     │   │  Send this 2 days after you launch your project.                  │
│     │   │                                                                   │
│     ●───┘  ✉ Project Ending                             [Start draft]      │
│            Remind your fans that they only have a limited amount of time    │
│            left before your project ends.                                   │
│            Send this 2 days before your project ends.                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Timeline Styling:
- Vertical line: 2px solid teal, left side
- Dots: 12px diameter, teal fill
- Dot position: centered on line
- Content indentation: 48px from left edge
- Section spacing: 32px vertical
- Button alignment: right edge of content area

Card dimensions:
- Max-width: 800px
- Centered in viewport
- Padding: 40px
```

### Email Template Types

| Template | When to Send | Purpose | Key Content |
|----------|--------------|---------|-------------|
| **Before Launch** | Project still in draft | Build anticipation | Tease project, ask for day-one support |
| **Before Launch (w/ Pre-launch)** | Has Kickstarter pre-launch page | Drive followers | Link to follow pre-launch page |
| **At Launch** | Day project goes live | Capture early birds | Early bird specials, direct pledge link |
| **After Launch** | 2 days post-launch | Convert interested fans | Remind, social proof, urgency |
| **Project Ending** | 48 hours before end | Final push | Scarcity, last chance messaging |

### Test Email Feature

Before sending to your full list, always send a test email to verify content and links.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  1. Test Your Email                                                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Review the email and the page that the email links to for any              │
│  errors before sending it out.                                              │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  Send to jdaguestposts@gmail.com                                      │  │
│  │                                                                       │  │
│  │  ┌───────────────────────┐                                            │  │
│  │  │  ✉ Send Test Email    │                                            │  │
│  │  └───────────────────────┘                                            │  │
│  │  Button: teal, 180px wide                                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

Test email recipient:
- Defaults to logged-in user's email
- Can be changed to any email address
- Test emails don't count against any limits
```

### Scheduled Sending

Schedule emails to send at optimal times:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Scheduled Send Date - Pacific Time                                         │
│                                                                             │
│  ┌─────────────────────────────────────┐                                    │
│  │  📅 December 20, 2024  ▼           │                                    │
│  └─────────────────────────────────────┘                                    │
│                                                                             │
│  ┌─────────────────────────────────────┐                                    │
│  │  🕐 10:00 AM  ▼                    │                                    │
│  └─────────────────────────────────────┘                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Date Picker:
- Width: 200px
- Calendar dropdown on click
- Shows selected date

Time Picker:
- Width: 140px
- 30-minute increments
- Timezone displayed (Pacific Time)
```

### Unsubscribe Handling

Every email includes automatic unsubscribe handling:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  What happens to a member that unsubscribes?                                │
│                                                                             │
│  Members who click "unsubscribe" in any email are:                          │
│  - Removed from future email campaigns                                      │
│  - Marked as unsubscribed in your member list                               │
│  - Still able to receive transactional emails (order confirmations, etc.)   │
│  - Able to re-subscribe through a new project pledge                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Email Editor Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Elven Destiny                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  🏠 Launch   [Dashboard] [Email Campaigns] [Teaser Pages] [Projects] [Members]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Special Early Access: Add Project Title                   [Actions ▼]      │
│  🎨 Flying Sparks Volumes 1-3                                               │
│                                                                             │
├────────────────────┬────────────────────────────────────────────────────────┤
│                    │                                                        │
│  SIDEBAR NAV       │  MAIN CONTENT                                          │
│  Width: 200px      │  Width: flexible                                       │
│  ────────────────  │                                                        │
│                    │  Connect with a Project                                │
│  Your Email        │  ─────────────────────────────────────────────────     │
│  Campaign          │  ✓ Connected to [KS] Flying Sparks Volumes 1-3         │
│  ↑ Active: bold    │  Not this project? Select a different project.         │
│                    │  ↑ teal link                                           │
│  Customize         │                                                        │
│                    │  ─────────────────────────────────────────────────     │
│  Send              │                                                        │
│                    │  1. Your audience will receive an email.               │
│  Results           │                                                        │
│                    │  ┌────────────────────────────────────────────────┐    │
│                    │  │  ✉ Special Early Access: Add Project Title     │    │
│                    │  │  From: Add Sender                              │    │
│                    │  │  ──────────────────────────────────────────    │    │
│                    │  │                                                │    │
│                    │  │  Hi!                                           │    │
│                    │  │                                                │    │
│                    │  │  We're excited to launch our next project:     │    │
│                    │  │  Add Project Title.                            │    │
│                    │  │                                                │    │
│                    │  │  As a fan of ours, we want to ask for your     │    │
│                    │  │  commitment to pledge on day ONE so that we    │    │
│                    │  │  can have the strongest launch possible.       │    │
│                    │  │                                                │    │
│                    │  └────────────────────────────────────────────────┘    │
│                    │  Email preview card:                                   │
│                    │  - Border: 3px solid teal (left edge)                  │
│                    │  - Background: white                                   │
│                    │  - Shadow: 0 2px 8px rgba(0,0,0,0.1)                   │
│                    │  - Max-width: 600px                                    │
│                    │                                                        │
│                    │  [Customize this email »]                              │
│                    │                                                        │
│                    │  ┌───────────────────────┐                             │
│                    │  │  ✉ Send Test Email    │                             │
│                    │  └───────────────────────┘                             │
│                    │  Send to: jdaguestposts@gmail.com                      │
│                    │                                                        │
│                    │  What happens to a member that unsubscribes?           │
│                    │  ↑ teal link                                           │
│                    │                                                        │
└────────────────────┴────────────────────────────────────────────────────────┘
```

### Email Editor Sidebar Navigation

```
┌────────────────────────────────────────┐
│                                        │
│  Your Email Campaign                   │  ← Step 1: Overview & Preview
│  (bold when active, teal left border)  │
│                                        │
│  Customize                             │  ← Step 2: Edit content, subject, sender
│                                        │
│  Send                                  │  ← Step 3: Test, schedule, send
│                                        │
│  Results                               │  ← Step 4: View analytics after send
│                                        │
└────────────────────────────────────────┘

Sidebar Nav Styling:
- Width: 200px
- Background: white
- Item height: 44px
- Item padding: 12px 16px
- Active state: bold text, 3px teal left border
- Hover: light gray background
- Disabled (Results before send): gray text, no hover
```

### Project Connection Section

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Connect with a Project                                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Enable advanced filtering and live pledge tracking.                        │
│                                                                             │
│  ✓ Connected to [KS] Flying Sparks Volumes 1-3                              │
│                                                                             │
│  Not this project? Select a different project.                              │
│                    ↑ teal link, opens project selector modal                │
└─────────────────────────────────────────────────────────────────────────────┘

Connected state:
- Checkmark icon: green (#38a169)
- Platform badge [KS]: Kickstarter green (#05ce78)
- Project name: bold

Not connected state:
- Shows project selector dropdown
- "Connect" button
```

### Email Send Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  1. Test Your Email                                                 │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │  Review the email and the page that the email links to for any      │    │
│  │  errors before sending it out.                                      │    │
│  │                                                                     │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │  Send to jdaguestposts@gmail.com                              │  │    │
│  │  │                                                               │  │    │
│  │  │  ┌───────────────────────┐                                    │  │    │
│  │  │  │  ✉ Send Test Email    │                                    │  │    │
│  │  │  └───────────────────────┘                                    │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  2. Send Your Emails                                                │    │
│  │  ─────────────────────────────────────────────────────────────────  │    │
│  │                                                                     │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │  ✓ Email campaigns are FREE - no limits, no charges           │  │    │
│  │  │  ─────────────────────────────────────────────────────────    │  │    │
│  │  │                                                               │  │    │
│  │  │  Send To                                                      │  │    │
│  │  │  1829                                                         │  │    │
│  │  │  members who have not pledged to this project                 │  │    │
│  │  │                                                               │  │    │
│  │  │  ┌────────────────────────┐  [🔍 Filter Members]              │  │    │
│  │  │  │  ✉ Send Email Campaign │                                   │  │    │
│  │  │  └────────────────────────┘                                   │  │    │
│  │  │                                                               │  │    │
│  │  │  Scheduled Send Date - Pacific Time                           │  │    │
│  │  │  [Date picker]                                                │  │    │
│  │  │                                                               │  │    │
│  │  │  ─────────────────────────────────────────────────────────    │  │    │
│  │  │                                                               │  │    │
│  │  │  Replies by members to this campaign will be sent to your     │  │    │
│  │  │  support email:                                               │  │    │
│  │  │  jdaguestposts@gmail.com  Edit »                              │  │    │
│  │  │                           ↑ teal link                         │  │    │
│  │  │                                                               │  │    │
│  │  │  ─────────────────────────────────────────────────────────    │  │    │
│  │  │                                                               │  │    │
│  │  │  Do you have an email list that you would like to add to      │  │    │
│  │  │  this campaign?                                               │  │    │
│  │  │  [Import Email List]                                          │  │    │
│  │  │                                                               │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Free Email Banner Styling:
- Background: #ecfdf5 (light green)
- Border-left: 4px solid #10b981 (green)
- Padding: 16px
- Text: #065f46 (dark green)

Send Count Typography:
- Number: 48px bold
- Label: 14px gray
- Left-aligned within card
```

### Support Email Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Replies by members to this campaign will be sent to your support email:    │
│                                                                             │
│  jdaguestposts@gmail.com  Edit »                                            │
│  ↑ monospace/code style   ↑ teal link                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Edit link: Opens modal to change reply-to email address
Default: Account email address
Purpose: Allows creators to route campaign replies to support inbox
```

### Email List Import

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Do you have an email list that you would like to add to this campaign?     │
│                                                                             │
│  ┌─────────────────────────────────────┐                                    │
│  │      📤 Import Email List           │                                    │
│  └─────────────────────────────────────┘                                    │
│  Button: outlined, teal                                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Import Modal (on click):
┌─────────────────────────────────────────────────────────────────────────────┐
│  Import Email List                                                     ×    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Upload a CSV file with email addresses to add to this campaign.            │
│                                                                             │
│  Required column: email                                                     │
│  Optional columns: first_name, last_name                                    │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │                    Drag & drop CSV file here                          │  │
│  │                    or click to browse                                 │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Upload zone: dashed border, light gray background                          │
│                                                                             │
│                    [Cancel]  [Import Members]                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Launch: Teaser Pages

### Overview

Teaser pages allow you to collect email signups before your campaign launches, building anticipation and an audience.

### Teaser Page List

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏠 Launch   [Dashboard] [Email Campaigns] [Teaser Pages] [Projects] [Members]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Teaser Pages                                           [+ Create New Page] │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [img]  Flying Sparks Volume 4                        [Edit] [View] │    │
│  │         Status: 🟢 Active                                           │    │
│  │         URL: backerkit.com/teaser/flying-sparks-4                   │    │
│  │         Signups: 342                                                │    │
│  │         Created: 11/01/2024                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [img]  Secret Project X                              [Edit] [View] │    │
│  │         Status: 🔴 Draft                                            │    │
│  │         URL: Not published                                          │    │
│  │         Signups: 0                                                  │    │
│  │         Created: 12/01/2024                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Status:
- 🟢 Active: Page is live and accepting signups
- 🔴 Draft: Page is not published
- 🟡 Paused: Page exists but not accepting new signups
```

### Teaser Page Editor

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Edit Teaser Page                                              [Preview]    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Page Title *                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Flying Sparks Volume 4 - Coming Soon!                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  URL Slug *                                                                 │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ backerkit.com/teaser/ flying-sparks-4                                 │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Header Image                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │              📎 Drag & drop image or click to browse                  │  │
│  │              Recommended: 1200×630px                                  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Description                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ The epic conclusion to the Flying Sparks saga! Sign up to be          │  │
│  │ notified when we launch and get exclusive early-bird access.          │  │
│  │                                                                       │  │
│  │ [Bold] [Italic] [Link] [Image]                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  WYSIWYG editor with formatting toolbar                                     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Signup Form                                                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Collect:                                                                   │
│  ☑ Email (required)                                                         │
│  ☐ First name                                                               │
│  ☐ Last name                                                                │
│                                                                             │
│  Button Text                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Notify Me                                                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Success Message                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Thanks! We'll let you know when we launch.                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Social Links (optional)                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Kickstarter Pre-launch: [https://kickstarter.com/projects/...      ]      │
│  Twitter/X:              [https://twitter.com/...                   ]      │
│  Instagram:              [https://instagram.com/...                 ]      │
│                                                                             │
│                              [Save Draft]  [Publish Page]                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Launch: Members

### Member Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏠 Launch   [Dashboard] [Email Campaigns] [Teaser Pages] [Projects] [Members]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Members                                       [Import] [Export] [+ Add]    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Total Members: 1,829                                                       │
│                                                                             │
│  ┌─────────────────────────────────────┐                                    │
│  │ 🔍 Search by email or name...       │  [Filter ▼]                       │
│  └─────────────────────────────────────┘                                    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  │ Email                    │ Name         │ Source        │ Joined   │ St │
│  │─────────────────────────┼──────────────┼───────────────┼──────────┼────│
│  │ john@email.com          │ John Smith   │ Kickstarter   │ 09/15/24 │ ✅ │
│  │ jane@email.com          │ Jane Doe     │ Teaser Page   │ 10/01/24 │ ✅ │
│  │ bob@email.com           │ Bob Wilson   │ Import        │ 08/20/24 │ ✅ │
│  │ alice@email.com         │ Alice J.     │ Pre-order     │ 11/05/24 │ ⛔ │
│  │ mike@email.com          │ Mike Brown   │ Kickstarter   │ 09/15/24 │ ✅ │
│  │─────────────────────────┼──────────────┼───────────────┼──────────┼────│
│                                                                             │
│  « Previous    Page 1 of 92    Next »                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Status Column:
- ✅ Subscribed: Receiving emails
- ⛔ Unsubscribed: Opted out
- ⚠ Bounced: Email delivery failed

Source Types:
- Kickstarter: Imported from KS campaign
- Teaser Page: Signed up via teaser
- Import: Uploaded via CSV
- Pre-order: Made pre-order purchase
```

### Member Filter Options

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Filter Members                                                        ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Status                                                                     │
│  ☑ Subscribed                                                               │
│  ☐ Unsubscribed                                                             │
│  ☐ Bounced                                                                  │
│                                                                             │
│  Source                                                                     │
│  ☐ Kickstarter backers                                                      │
│  ☐ Teaser page signups                                                      │
│  ☐ Imported lists                                                           │
│  ☐ Pre-order customers                                                      │
│                                                                             │
│  Project                                                                    │
│  ☐ Has pledged to any project                                               │
│  ☐ Has not pledged to any project                                           │
│  ☐ Specific project: [Select Project ▼]                                     │
│                                                                             │
│  Date Added                                                                 │
│  [Start Date] to [End Date]                                                 │
│                                                                             │
│                              [Clear All]  [Apply Filters]                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Launch: Projects

### Projects List

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏠 Launch   [Dashboard] [Email Campaigns] [Teaser Pages] [Projects] [Members]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Connected Projects                                       [+ Add Project]   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [img] [KS] Flying Sparks Volumes 1-3              [View] [Refresh] │    │
│  │        Status: ✅ Funded · $24,350 raised                           │    │
│  │        Backers: 684 imported                                        │    │
│  │        Last synced: 12/15/2024 10:30 AM                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [img] [KS] All Eyes On Ashley                     [View] [Refresh] │    │
│  │        Status: ✅ Funded · $18,200 raised                           │    │
│  │        Backers: 412 imported                                        │    │
│  │        Last synced: 12/14/2024 3:00 PM                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  [img] [KS] Elven Destiny                          [View] [Refresh] │    │
│  │        Status: 🟢 Live · $1,306 raised · 0 days to go               │    │
│  │        Backers: 35 (syncing...)                                     │    │
│  │        Last synced: 12/16/2024 9:00 AM                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Platform Badges:
- [KS]: Kickstarter (green #05ce78)
- [IG]: Indiegogo (pink #e51075)
- [BK]: BackerKit Crowdfunding (teal #4a9b9b)
```

### Add Project / Kickstarter Import Wizard

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Connect a Project                                                     ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 1 of 3: Select Platform                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │                     │  │                     │  │                     │  │
│  │   [Kickstarter]     │  │    [Indiegogo]      │  │   [BackerKit]       │  │
│  │                     │  │                     │  │                     │  │
│  │   ● Selected        │  │                     │  │                     │  │
│  │                     │  │                     │  │                     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                             │
│                                                        [Cancel]  [Next →]   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Connect a Project                                                     ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 2 of 3: Enter Project URL                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Paste your Kickstarter project URL:                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ https://www.kickstarter.com/projects/creator/flying-sparks            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ✅ Project found: Flying Sparks Volumes 1-3                                │
│     Creator: J.D. Artist                                                    │
│     Status: Successfully Funded                                             │
│     Backers: 684                                                            │
│                                                                             │
│                                                   [← Back]  [Next →]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  Connect a Project                                                     ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Step 3 of 3: Import Options                                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  What would you like to import?                                             │
│                                                                             │
│  ☑ Backer email addresses (684 backers)                                     │
│  ☑ Backer names                                                             │
│  ☑ Pledge amounts                                                           │
│  ☑ Pledge dates                                                             │
│                                                                             │
│  Auto-sync settings:                                                        │
│  ☑ Automatically sync new backers daily                                     │
│  ☐ Sync only when I manually refresh                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ⚠ Note: Backers will be added to your Launch member list and can           │
│     receive email campaigns.                                                │
│                                                                             │
│                                           [← Back]  [Import Project]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Settings

### Settings Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Project Settings                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────┬────────────────────────────────────────────────────┐│
│  │                    │                                                    ││
│  │  SETTINGS NAV      │  MAIN CONTENT                                      ││
│  │  ────────────────  │                                                    ││
│  │                    │  General Settings                                  ││
│  │  General           │  ─────────────────────────────────────────────     ││
│  │  ↑ Active          │                                                    ││
│  │                    │  Project Name                                      ││
│  │  Survey            │  ┌────────────────────────────────────────────┐    ││
│  │                    │  │ Flying Sparks Volumes 1-3                  │    ││
│  │  Shipping          │  └────────────────────────────────────────────┘    ││
│  │                    │                                                    ││
│  │  Payments          │  Project Image                                     ││
│  │                    │  ┌────────────────────────────────────────────┐    ││
│  │  Notifications     │  │ [Current Image]         [Change Image]     │    ││
│  │                    │  └────────────────────────────────────────────┘    ││
│  │  Integrations      │                                                    ││
│  │                    │  Currency                                          ││
│  │  Team              │  ┌────────────────────────────────────────────┐    ││
│  │                    │  │ USD - US Dollar                         ▼ │    ││
│  │  Danger Zone       │  └────────────────────────────────────────────┘    ││
│  │                    │                                                    ││
│  │                    │  Timezone                                          ││
│  │                    │  ┌────────────────────────────────────────────┐    ││
│  │                    │  │ (UTC-08:00) Pacific Time                ▼ │    ││
│  │                    │  └────────────────────────────────────────────┘    ││
│  │                    │                                                    ││
│  │                    │                              [Save Changes]        ││
│  │                    │                                                    ││
│  └────────────────────┴────────────────────────────────────────────────────┘│
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Danger Zone

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Danger Zone                                                                │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ⚠ These actions are destructive and cannot be undone.                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Archive Project                                                    │    │
│  │  Hide this project from your dashboard. Data will be preserved.     │    │
│  │                                               [Archive Project]     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Delete All Backers                                                 │    │
│  │  Permanently remove all backer data from this project.              │    │
│  │                                               [Delete Backers]      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Delete Project                                                     │    │
│  │  Permanently delete this project and all associated data.           │    │
│  │                                               [Delete Project]      │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Danger Zone Styling:
- Border: 2px solid #c53030 (red)
- Background: #fff5f5 (light red)
- Buttons: red background, white text
- Requires confirmation modal before action
```

---

## Account Settings

### Account Page Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Account Settings                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Profile                                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Profile Picture                                                            │
│  ┌──────────┐                                                               │
│  │          │  [Change Photo]                                               │
│  │   👤     │                                                               │
│  │          │                                                               │
│  └──────────┘                                                               │
│                                                                             │
│  Name *                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ J.D. Artist                                                           │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Email *                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ jdaguestposts@gmail.com                                               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Password                                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Current Password                                                           │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ••••••••••••                                                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  New Password                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Confirm New Password                                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                              [Update Password]                              │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Notification Preferences                                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ☑ Email me when a backer completes their survey                            │
│  ☑ Email me daily summary of new orders                                     │
│  ☐ Email me for each new order                                              │
│  ☑ Email me when a payment fails                                            │
│  ☑ Email me product updates and tips from BackerKit                         │
│                                                                             │
│                              [Save Preferences]                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Team Management

### Team Members List

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Team                                                   [+ Invite Member]   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Project: Flying Sparks Volumes 1-3                                         │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  👤 J.D. Artist                                                     │    │
│  │     jdaguestposts@gmail.com                                         │    │
│  │     Role: Owner                                                     │    │
│  │     Added: Project creation                                         │    │
│  │                                                              (you)  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  👤 Sarah Assistant                               [Edit Role] [🗑]  │    │
│  │     sarah@email.com                                                 │    │
│  │     Role: Admin                                                     │    │
│  │     Added: 10/15/2024                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  👤 Mike Fulfillment                              [Edit Role] [🗑]  │    │
│  │     mike@email.com                                                  │    │
│  │     Role: Fulfillment                                               │    │
│  │     Added: 11/01/2024                                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Pending Invitations                                                        │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  ✉ editor@email.com                         [Resend] [Cancel]       │    │
│  │     Role: Editor                                                    │    │
│  │     Invited: 12/10/2024 (expires in 5 days)                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Invite Member Modal

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Invite Team Member                                                    ×    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Email Address *                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ newmember@email.com                                                   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Role *                                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Admin                                                              ▼ │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Role Permissions:                                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Admin                                                              │    │
│  │  ✅ View all data                                                   │    │
│  │  ✅ Edit backers and orders                                         │    │
│  │  ✅ Send emails and surveys                                         │    │
│  │  ✅ Manage products and shipping                                    │    │
│  │  ✅ Manage team members                                             │    │
│  │  ❌ Delete project                                                   │    │
│  │  ❌ Billing and payments                                             │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│                              [Cancel]  [Send Invitation]                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Role Types

| Role | View | Edit Backers | Send Emails | Manage Products | Manage Team | Billing |
|------|------|--------------|-------------|-----------------|-------------|---------|
| **Owner** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Editor** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Fulfillment** | ✅ | ✅ (limited) | ❌ | ❌ | ❌ | ❌ |
| **Viewer** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## UI Layout Specifications

### Global Specifications

#### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Teal | `#4a9b9b` | Buttons, links, active states, headers |
| Dark Teal | `#3d8585` | Button hover states |
| Success Green | `#38a169` | Shipped status, completed items |
| Warning Yellow/Amber | `#f59e0b` | Push errored, pending states |
| Error Red | `#c53030` | Errors, incomplete status, required alerts |
| Text Primary | `#1a1a1a` | Main content text |
| Text Secondary | `#666666` | Labels, descriptions |
| Border | `#e0e0e0` | Dividers, card borders |
| Background Light | `#f5f5f5` | Table headers, alternate rows |
| Background Page | `#ffffff` | Main page background |

#### Typography

| Element | Size | Weight | Line Height |
|---------|------|--------|-------------|
| Page Title | 24px | 600 | 1.3 |
| Section Header | 18px | 600 | 1.4 |
| Card Title | 16px | 600 | 1.4 |
| Body Text | 14px | 400 | 1.5 |
| Small/Label | 12px | 400 | 1.4 |
| Table Header | 13px | 600 | 1.4 |
| Button Text | 14px | 500 | 1 |
| Badge Text | 11px | 600 | 1 |

#### Spacing Scale

| Token | Value | Usage |
|-------|-------|-------|
| `xs` | 4px | Icon margins, tight padding |
| `sm` | 8px | Button icon gap, compact spacing |
| `md` | 16px | Standard padding, component gap |
| `lg` | 24px | Section spacing, card padding |
| `xl` | 32px | Major section breaks |
| `2xl` | 48px | Page section spacing |

#### Border Radius

| Element | Radius |
|---------|--------|
| Buttons | 4px |
| Cards | 4px |
| Badges | 4px |
| Modals | 8px |
| Avatars/Images | 4px (or 50% for circles) |

### Component Specifications

#### Primary Button

```css
.btn-primary {
  background-color: #4a9b9b;
  color: #ffffff;
  font-size: 14px;
  font-weight: 500;
  padding: 12px 24px;
  border-radius: 4px;
  border: none;
  min-height: 44px;
  cursor: pointer;
  transition: background-color 0.2s;
}
.btn-primary:hover {
  background-color: #3d8585;
}
.btn-primary:disabled {
  background-color: #cccccc;
  cursor: not-allowed;
}
```

#### Secondary Button (Outlined)

```css
.btn-secondary {
  background-color: transparent;
  color: #4a9b9b;
  font-size: 14px;
  font-weight: 500;
  padding: 12px 24px;
  border-radius: 4px;
  border: 1px solid #4a9b9b;
  min-height: 44px;
  cursor: pointer;
}
.btn-secondary:hover {
  background-color: rgba(74, 155, 155, 0.1);
}
```

#### Status Badge

```css
.badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.badge-draft {
  background-color: #e0e0e0;
  color: #1a1a1a;
}
.badge-sent {
  background-color: #4a9b9b;
  color: #ffffff;
}
.badge-error {
  background-color: #c53030;
  color: #ffffff;
}
.badge-international {
  background-color: #4a9b9b;
  color: #ffffff;
}
```

#### Card Component

```css
.card {
  background-color: #ffffff;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 24px;
  margin-bottom: 24px;
}
.card-header {
  font-size: 16px;
  font-weight: 600;
  color: #4a9b9b;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e0e0e0;
}
```

#### Status Indicator Dots

```css
.status-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 8px;
}
.status-dot-red { background-color: #c53030; }
.status-dot-yellow { background-color: #f59e0b; }
.status-dot-green { background-color: #38a169; }
```

#### Table Styles

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
}
.data-table th {
  background-color: #f5f5f5;
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
}
.data-table td {
  padding: 12px 16px;
  border-bottom: 1px solid #e0e0e0;
  vertical-align: middle;
}
.data-table tr:hover {
  background-color: #f9f9f9;
}
```

### Layout Grid

#### Main Application Layout

```css
.app-layout {
  display: grid;
  grid-template-columns: 200px 1fr 280px;
  grid-template-rows: 56px 1fr;
  min-height: 100vh;
}

.header {
  grid-column: 1 / -1;
  height: 56px;
  background-color: #ffffff;
  border-bottom: 1px solid #e0e0e0;
  padding: 0 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar {
  width: 200px;
  background-color: #ffffff;
  border-right: 1px solid #e0e0e0;
  padding: 24px 0;
}

.main-content {
  padding: 24px;
  background-color: #f5f5f5;
  overflow-y: auto;
}

.right-panel {
  width: 280px;
  background-color: #ffffff;
  border-left: 1px solid #e0e0e0;
  padding: 24px;
}
```

#### Fulfillment Page Header

```css
.fulfillment-header {
  background-color: #4a9b9b;
  color: #ffffff;
  padding: 24px;
  min-height: 80px;
}
.fulfillment-header h1 {
  font-size: 24px;
  font-weight: 600;
  margin: 0;
}
```

#### Tab Navigation

```css
.tabs {
  display: flex;
  border-bottom: 1px solid #e0e0e0;
  margin-bottom: 24px;
}
.tab {
  padding: 12px 16px;
  font-size: 14px;
  color: #666666;
  text-decoration: none;
  border-bottom: 3px solid transparent;
  margin-bottom: -1px;
}
.tab:hover {
  color: #4a9b9b;
}
.tab.active {
  color: #4a9b9b;
  border-bottom-color: #4a9b9b;
  font-weight: 500;
}
```

### Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Desktop Large | > 1440px | 3-column layout with right panel |
| Desktop | 1024px - 1440px | 3-column, compressed right panel |
| Tablet | 768px - 1024px | 2-column, hide right panel |
| Mobile | < 768px | Single column, collapsible sidebar |

```css
@media (max-width: 1024px) {
  .app-layout {
    grid-template-columns: 200px 1fr;
  }
  .right-panel {
    display: none;
  }
}

@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: fixed;
    transform: translateX(-100%);
    z-index: 100;
  }
  .sidebar.open {
    transform: translateX(0);
  }
  .package-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## Global UI Components

### Floating Help Widget

A persistent help button appears on all pages in the bottom-right corner.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                                                                             │
│                                                          ┌───────────────┐  │
│                                                          │               │  │
│                                                          │      ?        │  │
│                                                          │               │  │
│                                                          └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

Help Widget Styling:
- Position: fixed
- Bottom: 24px
- Right: 24px
- Width: 56px
- Height: 56px
- Border-radius: 50% (circle)
- Background: #4a9b9b (teal)
- Icon: white question mark, 24px
- Shadow: 0 4px 12px rgba(0,0,0,0.15)
- z-index: 1000
- Hover: scale(1.05) transform

Click action: Opens help panel/chat widget
```

### What's New Notification Badge

Indicates new features or updates in the header.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ... [Search] ............... What's New● [Account ▼]                       │
└─────────────────────────────────────────────────────────────────────────────┘
                                         ↑
                                    Red dot indicator

Badge Styling:
- Position: absolute (relative to "What's New" text)
- Top: -2px
- Right: -8px
- Width: 8px
- Height: 8px
- Border-radius: 50%
- Background: #c53030 (red)

Click action: Opens What's New panel with feature announcements
Behavior: Badge disappears after viewing
```

### Integration Announcement Banner

Promotional banners for new features appear at the bottom of the sidebar.

```
┌────────────────────────────────────────┐
│  ...                                   │
│  Settings                              │
│  ──────────────────────────────────    │
│  MORE ▼                                │
│                                        │
├────────────────────────────────────────┤
│  ┌────────────────────────────────┐    │
│  │ 🎉 BackerKit Launches Patreon  │    │
│  │    Integration                 │    │
│  │                                │    │
│  │ Introducing BackerKit's        │    │
│  │ Patreon Integration! 🎉        │    │
│  │ Patreon creators can now       │    │
│  │ quickly turn patrons into ...  │  × │
│  └────────────────────────────────┘    │
└────────────────────────────────────────┘

MORE ▼ Expander:
- Position: bottom of main navigation, above promotional banners
- Text: "MORE" in gray, uppercase
- Chevron: ▼ rotates to ▲ when expanded
- Click: Reveals additional menu items
- Font: 12px, gray (#666666)
- Padding: 12px 16px
- Background on hover: light gray

Expanded items (examples):
- Integrations
- API Settings
- Account Settings
- Billing

Banner Styling:
- Position: bottom of sidebar
- Width: 100% of sidebar (200px)
- Background: white
- Border: 1px solid #e0e0e0
- Border-radius: 8px
- Padding: 16px
- Margin: 16px

Close button (×):
- Position: top-right
- Size: 20px
- Color: #666666
- Cursor: pointer

Behavior: 
- Dismissible (remembers dismissal)
- Shows new integration announcements
- Links to integration docs/setup
```

### Header Navigation Bar

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [LOGO]  Project Name: Campaign Title           [🔍] [What's New●] [user ▼] │
│  ▼                                                                          │
└─────────────────────────────────────────────────────────────────────────────┘

Header Dimensions:
- Height: 56px
- Background: white
- Border-bottom: 1px solid #e0e0e0
- Padding: 0 24px
- Position: fixed (sticky header)
- z-index: 100

Logo:
- Width: auto (max 140px)
- Height: 32px
- Left-aligned with 24px padding

Project Selector:
- Displays current project name
- Dropdown arrow indicates project switching
- Max-width: 400px (truncates with ellipsis)

Right section:
- Gap: 16px between items
- Search icon: 24px
- What's New: text link with notification dot
- Account dropdown: shows email, arrow

Account Dropdown Contents:
- Profile
- Settings
- Sign Out
```

### Breadcrumb Back Navigation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ← Back to Elven Destiny: A Men's Fantasy Harem Novel                       │
├─────────────────────────────────────────────────────────────────────────────┤
│  [Rest of page content...]                                                  │
└─────────────────────────────────────────────────────────────────────────────┘

Back Navigation Styling:
- Background: #4a9b9b (teal) or #2563eb (blue for Launch)
- Text: white
- Padding: 12px 24px
- Font-size: 14px
- Arrow: ← (left arrow unicode)
- Full width bar
- Hover: slightly lighter background
```

### View Downloads Link

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📥 Digital Downloads          [Learn More] [View Downloads (33)]  [Create] │
└─────────────────────────────────────────────────────────────────────────────┘
                                                    ↑
                                          Count in parentheses

View Downloads Link:
- Text: "View Downloads (X)" where X is total download count
- Color: teal
- Position: header row, right side
- Click: Opens list view of all uploaded files
```

### Start All Distributions Button

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                            (?) [Start all distributions (27)]│
└─────────────────────────────────────────────────────────────────────────────┘

Button Styling:
- Background: #4a9b9b (teal)
- Text: white
- Padding: 8px 16px
- Border-radius: 4px
- Font-size: 13px
- Count in parentheses shows eligible distributions

Help Icon (?):
- Width: 20px
- Height: 20px
- Border: 1px solid #666
- Border-radius: 50%
- Margin-right: 8px
- Hover: shows tooltip explaining distributions
```

---

## Form Elements & Validation

### Input Field States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Default State:                                                             │
│  Label                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Placeholder text                                                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Border: 1px solid #e0e0e0                                                  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Focus State:                                                               │
│  Label                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ User input here                                                   |  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Border: 2px solid #4a9b9b (teal)                                           │
│  Box-shadow: 0 0 0 3px rgba(74, 155, 155, 0.1)                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Error State:                                                               │
│  Label *                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  ⚠ This field is required                                                   │
│  Border: 2px solid #c53030 (red)                                            │
│  Error text: 12px, #c53030                                                  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Disabled State:                                                            │
│  Label                                                                      │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Disabled value                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Background: #f5f5f5                                                        │
│  Text: #a0a0a0                                                              │
│  Cursor: not-allowed                                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Success State:                                                             │
│  Label ✓                                                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Valid input                                                     ✓    │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Border: 1px solid #38a169 (green)                                          │
│  Checkmark icon: green, inside field                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Input Styling:
- Height: 44px
- Padding: 12px 16px
- Font-size: 14px
- Border-radius: 4px
- Transition: border-color 0.2s, box-shadow 0.2s
```

### Required Field Indicators

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Required fields are marked with an asterisk (*):                           │
│                                                                             │
│  Email Address *                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Phone Number (optional)                                                    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Asterisk styling:                                                          │
│  - Color: #c53030 (red)                                                     │
│  - Position: immediately after label text                                   │
│  - Font-size: 14px                                                          │
│                                                                             │
│  Optional indicator styling:                                                │
│  - Text: "(optional)" in gray                                               │
│  - Font-size: 12px                                                          │
│  - Font-weight: normal                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Form Validation Messages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Inline Error (below field):                                                │
│  Email Address *                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ invalidemail                                                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  ⚠ Please enter a valid email address                                       │
│                                                                             │
│  Error styling:                                                             │
│  - Icon: ⚠ warning triangle                                                 │
│  - Text color: #c53030                                                      │
│  - Font-size: 12px                                                          │
│  - Margin-top: 4px                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Form-level Error (top of form):                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ⚠ Please fix the following errors:                                    │  │
│  │   • Email address is required                                         │  │
│  │   • Shipping address is incomplete                                    │  │
│  │   • Please select a pledge level                                      │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Form error box styling:                                                    │
│  - Background: #fff5f5 (light red)                                          │
│  - Border: 1px solid #c53030                                                │
│  - Border-left: 4px solid #c53030                                           │
│  - Padding: 16px                                                            │
│  - Border-radius: 4px                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tooltip Help Text

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  HS/Tariff Code * (?)                                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 4901.99.00                                                            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Hover on (?) shows:                                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ The Harmonized System code for customs classification.                │  │
│  │ Common codes for books: 4901.99                                       │  │
│  │ Common codes for prints: 4911.91                                      │  │
│  │                                                                       │  │
│  │ Find your HS code: https://hts.usitc.gov                              │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│             ▼                                                               │
│  (tooltip arrow pointing to ?)                                              │
│                                                                             │
│  Tooltip styling:                                                           │
│  - Background: #1a1a1a (dark)                                               │
│  - Text: white, 13px                                                        │
│  - Padding: 12px 16px                                                       │
│  - Border-radius: 4px                                                       │
│  - Max-width: 300px                                                         │
│  - Box-shadow: 0 4px 12px rgba(0,0,0,0.2)                                   │
│  - Arrow: 8px triangle                                                      │
│                                                                             │
│  (?) icon styling:                                                          │
│  - Size: 16px circle                                                        │
│  - Border: 1px solid #a0a0a0                                                │
│  - Text: "?" centered                                                       │
│  - Cursor: help                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Loading & Empty States

### Loading Spinner

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Inline Spinner (button):                                                   │
│  ┌─────────────────────────┐                                                │
│  │  ⟳ Saving...            │                                                │
│  └─────────────────────────┘                                                │
│                                                                             │
│  Full Page Spinner:                                                         │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │                                                                       │  │
│  │                           ⟳                                           │  │
│  │                      Loading...                                       │  │
│  │                                                                       │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Spinner styling:                                                           │
│  - Size: 24px (inline), 48px (full page)                                    │
│  - Color: #4a9b9b (teal)                                                    │
│  - Animation: spin 1s linear infinite                                       │
│  - Loading text: 14px gray, below spinner                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Skeleton Loading States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Table Skeleton:                                                            │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ▓▓▓▓▓▓▓▓▓▓  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ ▓▓▓▓▓▓▓▓  │ ▓▓▓▓▓▓   │            │  │
│  ├─────────────┼────────────────────┼───────────┼──────────┤            │  │
│  │ ░░░░░░░░░░  │ ░░░░░░░░░░░░░░░░░░ │ ░░░░░░░░  │ ░░░░░░   │            │  │
│  │ ░░░░░░░░░░  │ ░░░░░░░░░░░░░░░░░░ │ ░░░░░░░░  │ ░░░░░░   │            │  │
│  │ ░░░░░░░░░░  │ ░░░░░░░░░░░░░░░░░░ │ ░░░░░░░░  │ ░░░░░░   │            │  │
│  │ ░░░░░░░░░░  │ ░░░░░░░░░░░░░░░░░░ │ ░░░░░░░░  │ ░░░░░░   │            │  │
│  └─────────────┴────────────────────┴───────────┴──────────┘            │  │
│                                                                             │
│  Card Skeleton:                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ┌──────┐  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░                               │  │
│  │  │      │  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░                        │  │
│  │  │  ░░  │  ░░░░░░░░░░░░░░░░░░░░                                       │  │
│  │  │      │                                                             │  │
│  │  └──────┘  ░░░░░░░░░░░░░░                                             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Skeleton styling:                                                          │
│  - Background: #e8e8e8                                                      │
│  - Animation: pulse (opacity 0.6 to 1.0, 1.5s)                              │
│  - Border-radius: 4px                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Empty States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  No Results (Search):                                                       │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │                           🔍                                          │  │
│  │                                                                       │  │
│  │                   No backers found                                    │  │
│  │                                                                       │  │
│  │        No backers match your search for "xyzabc".                     │  │
│  │        Try a different search term.                                   │  │
│  │                                                                       │  │
│  │                    [Clear Search]                                     │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Empty Collection:                                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │                           📦                                          │  │
│  │                                                                       │  │
│  │                  No products yet                                      │  │
│  │                                                                       │  │
│  │        Create your first product to start managing                    │  │
│  │        inventory and fulfillment.                                     │  │
│  │                                                                       │  │
│  │                   [+ Add Product]                                     │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  No Distributions:                                                          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                       │  │
│  │                           📥                                          │  │
│  │                                                                       │  │
│  │              No distributions configured                              │  │
│  │                                                                       │  │
│  │        Set up digital download distribution rules to                  │  │
│  │        automatically deliver files to your backers.                   │  │
│  │                                                                       │  │
│  │                 [Create Distribution]                                 │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Empty State Styling:                                                       │
│  - Icon: 48px, gray (#a0a0a0)                                               │
│  - Title: 18px bold, #1a1a1a                                                │
│  - Description: 14px, #666666                                               │
│  - Max-width: 400px, centered                                               │
│  - Padding: 48px                                                            │
│  - Text-align: center                                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Modals & Notifications

### Confirmation Modals

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Standard Confirmation:                                                     │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                  ×    │  │
│  │  Lock this order?                                                     │  │
│  │                                                                       │  │
│  │  This will prevent the backer from making any further changes         │  │
│  │  to their survey. You can unlock the order later if needed.           │  │
│  │                                                                       │  │
│  │                                    [Cancel]  [Lock Order]             │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Destructive Confirmation:                                                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                                                                  ×    │  │
│  │  ⚠ Delete this backer?                                                │  │
│  │                                                                       │  │
│  │  This action cannot be undone. The backer's order, survey             │  │
│  │  responses, and all associated data will be permanently deleted.      │  │
│  │                                                                       │  │
│  │  To confirm, type "DELETE" below:                                     │  │
│  │  ┌───────────────────────────────────────────────────────────────┐    │  │
│  │  │                                                               │    │  │
│  │  └───────────────────────────────────────────────────────────────┘    │  │
│  │                                                                       │  │
│  │                                  [Cancel]  [Delete Backer]            │  │
│  │                                              ↑ Red button             │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Modal Styling:                                                             │
│  - Width: 480px                                                             │
│  - Background: white                                                        │
│  - Border-radius: 8px                                                       │
│  - Shadow: 0 4px 24px rgba(0,0,0,0.2)                                       │
│  - Padding: 24px                                                            │
│  - Overlay: rgba(0,0,0,0.5)                                                 │
│                                                                             │
│  Destructive button:                                                        │
│  - Background: #c53030                                                      │
│  - Text: white                                                              │
│  - Disabled until confirmation typed                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Toast Notifications

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Success Toast:                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ✅ Changes saved successfully                                     ×   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Background: #38a169 (green)                                                │
│                                                                             │
│  Error Toast:                                                               │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ❌ Failed to save changes. Please try again.                      ×   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Background: #c53030 (red)                                                  │
│                                                                             │
│  Warning Toast:                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ⚠ 3 addresses need attention before shipping                      ×   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Background: #f59e0b (amber)                                                │
│                                                                             │
│  Info Toast:                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ℹ Syncing with ShipStation... This may take a moment.             ×   │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│  Background: #4a9b9b (teal)                                                 │
│                                                                             │
│  Toast Styling:                                                             │
│  - Position: fixed, top-right (24px from edges)                             │
│  - Width: 360px                                                             │
│  - Padding: 16px                                                            │
│  - Border-radius: 4px                                                       │
│  - Text: white                                                              │
│  - Shadow: 0 4px 12px rgba(0,0,0,0.15)                                      │
│  - Auto-dismiss: 5 seconds (success/info), stays (error/warning)            │
│  - Animation: slide in from right                                           │
│  - × button: white, right side                                              │
│  - z-index: 9999                                                            │
│                                                                             │
│  Stacked toasts:                                                            │
│  - Multiple toasts stack vertically                                         │
│  - 8px gap between toasts                                                   │
│  - Max 3 visible, older ones fade out                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Error Retry Flows

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  Payment Retry:                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ❌ Payment Failed                                                    │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │                                                                       │  │
│  │  The charge of $8.00 for john@email.com failed.                       │  │
│  │                                                                       │  │
│  │  Reason: Card declined - insufficient funds                           │  │
│  │  Last attempt: Dec 15, 2024 at 3:45 PM                                │  │
│  │                                                                       │  │
│  │  Options:                                                             │  │
│  │  • [Retry Charge] - Attempt to charge the card again                  │  │
│  │  • [Send Update Card Email] - Ask backer to update payment            │  │
│  │  • [Mark as Paid] - Manually mark if paid outside system              │  │
│  │  • [Cancel Balance] - Remove the amount due                           │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Push Retry:                                                                │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  ⚠ Push to ShipStation Failed                                        │  │
│  │  ─────────────────────────────────────────────────────────────────    │  │
│  │                                                                       │  │
│  │  12 orders could not be pushed due to the following errors:           │  │
│  │                                                                       │  │
│  │  • 5 orders: Invalid address                                          │  │
│  │  • 4 orders: Missing weight                                           │  │
│  │  • 3 orders: Missing customs information                              │  │
│  │                                                                       │  │
│  │  [View Affected Orders]  [Fix Issues & Retry]                         │  │
│  │                                                                       │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Shipping Notification Template

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Shipping Notification Email                                        [Edit]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Subject: Your Flying Sparks order has shipped!                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Hi {backer_name},                                                          │
│                                                                             │
│  Great news! Your order from Flying Sparks has shipped and is on            │
│  its way to you.                                                            │
│                                                                             │
│  Tracking Information:                                                      │
│  Carrier: {carrier_name}                                                    │
│  Tracking Number: {tracking_number}                                         │
│                                                                             │
│                    [Track Your Package]                                     │
│                                                                             │
│  Shipping Address:                                                          │
│  {shipping_address}                                                         │
│                                                                             │
│  Items in this shipment:                                                    │
│  {item_list}                                                                │
│                                                                             │
│  Estimated delivery: {estimated_delivery}                                   │
│                                                                             │
│  Thanks for backing our project!                                            │
│  {creator_name}                                                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  Available Variables:                                                       │
│  {backer_name}, {backer_email}, {carrier_name}, {tracking_number},          │
│  {tracking_url}, {shipping_address}, {item_list}, {estimated_delivery},     │
│  {creator_name}, {project_name}                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Best Practices

### Survey Collection

1. Send reminders every 2 weeks to non-responders
2. Lock orders once surveys are complete to prevent changes
3. Set a deadline and communicate it clearly

### Fulfillment Preparation

1. **Validate addresses** before pushing to shipping
2. **Set weights** on all products for accurate shipping rates
3. **Configure customs info** for international items
4. **Test with a small batch** before bulk pushing

### Digital Distribution

1. Start distributions before survey deadline so early completers get files immediately
2. Use lockdown requirements strategically (payment required vs. not required)
3. Blast notification emails after major file updates

### Communication

1. Update backers monthly during production
2. Send tracking information proactively
3. Respond to support inquiries within 48 hours

### Post-Campaign Revenue

1. Keep pre-order store open until fulfillment begins
2. Cross-promote new campaigns to previous backers
3. Use email campaigns to announce new projects to your member list
4. Track referral sources to optimize marketing spend

---

## Appendix: Status Definitions

### Order Status

| Status | Meaning |
|--------|---------|
| **Survey Not Completed** | Backer hasn't filled out required information |
| **Address Incomplete** | Missing shipping address fields |
| **Ready to Ship** | All information collected, ready for fulfillment |
| **Shipped** | Order has been sent |

### Push Status

| Status | Meaning |
|--------|---------|
| **Not Pushed** | Not yet sent to shipping service |
| **Push Errored** | Failed to push (usually data issue) |
| **Pushed** | Successfully sent to shipping service |
| **Shipped** | Marked as shipped in shipping service |

### Charge Status

| Status | Meaning |
|--------|---------|
| **Not Charged** | Payment not yet attempted |
| **Errored** | Payment failed |
| **Charged** | Payment successful |
| **PayPal Collected** | Paid via PayPal |

---

*Document Version: 2.0*  
*Last Updated: December 2024*
