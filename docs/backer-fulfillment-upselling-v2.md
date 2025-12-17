# Backer Fulfillment & Post-Campaign Upselling

A comprehensive guide to managing pledge fulfillment, digital downloads, shipping integration, and post-campaign marketing for your crowdfunding platform.

---

## Table of Contents

1. [Dashboard Overview](#dashboard-overview)
2. [Fulfillment Workflow](#fulfillment-workflow)
3. [Shipping Integration](#shipping-integration)
4. [Digital Downloads](#digital-downloads)
5. [Backer Management](#backer-management)
6. [Pre-Orders & Upselling](#pre-orders--upselling)
7. [Email Campaigns (Launch)](#email-campaigns-launch)
8. [UI Layout Specifications](#ui-layout-specifications)
9. [Best Practices](#best-practices)

---

## Dashboard Overview

The main dashboard provides at-a-glance metrics for your campaign's post-funding status.

### Layout Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HEADER BAR (56px height)                                                   │
│  [Logo] [Project Selector] [Search] ............... [What's New] [Account] │
├────────────┬────────────────────────────────────────────────┬───────────────┤
│            │                                                │               │
│  SIDEBAR   │           MAIN CONTENT AREA                    │  RIGHT PANEL  │
│  (200px)   │           (flexible width)                     │   (280px)     │
│            │                                                │               │
│  • Home    │  ┌─────────────────────────────────────────┐   │  Fulfillment  │
│  • Timeline│  │  Feedback Modal (centered overlay)      │   │  ───────────  │
│  • Help    │  │  480px wide × auto height               │   │  669 / 684    │
│  ────────  │  └─────────────────────────────────────────┘   │  97% bar      │
│  Take Action│                                               │               │
│  • Send    │  ┌─────────────────────────────────────────┐   │  Survey       │
│  • Lock    │  │  RAISED IN BACKERKIT                    │   │  Completion   │
│  • Charge  │  │  $5,720                                 │   │  ───────────  │
│  • Ship    │  │  [Chart: 50% width] [Details: 50%]      │   │  641 / 679    │
│  ────────  │  └─────────────────────────────────────────┘   │  94% bar      │
│  Backers   │                                                │               │
│  Counts    │  ┌─────────────────────────────────────────┐   │  Pre-orders   │
│  Segments  │  │  WHAT'S NEXT? (Success Banner)          │   │  ───────────  │
│  Fulfill   │  │  Full width, 120px height, teal bg      │   │  43 total     │
│  Downloads │  └─────────────────────────────────────────┘   │               │
│  Pre-orders│                                                │               │
│  Support   │                                                │               │
│  Export    │                                                │               │
│  Settings  │                                                │               │
│            │                                                │               │
└────────────┴────────────────────────────────────────────────┴───────────────┘
```

### Key Metrics

| Metric | Description |
|--------|-------------|
| **Amount Raised** | Total funds collected, broken down by Campaign Backers vs Pre-order Backers |
| **Fulfillment Progress** | Percentage of orders fulfilled (e.g., 669/684 = 97%) |
| **Survey Completion** | Percentage of backers who completed their surveys (e.g., 641/679 = 94%) |
| **Purchased Add-ons** | Percentage of backers who purchased additional items |

### Charge Details Breakdown

- **Not Charged** — Backers with pending charges
- **Errored** — Failed payment attempts requiring attention
- **Charged** — Successfully collected payments
- **PayPal Collected** — Payments processed via PayPal

### Take Action Sidebar

A step-by-step workflow tracker showing:

1. **Send & Remind** — Backers needing survey reminders
2. **Lock Orders** — Orders ready to be locked for fulfillment
3. **Charge Cards** — Pending charges to process
4. **Lock Addresses** — Addresses to freeze before shipping
5. **Start Shipping** — Orders ready for shipment
6. **Shipped** — Completed shipments

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
│  ShipStation       │  [Refresh Package Groups]  │  Enter Package Group #    │
│  (NDM Express)     │  Button: teal, full width  │  ┌────────────────┐ [→]   │
│  Update Order →    │  Last Refreshed: date      │  └────────────────┘       │
└────────────────────┴────────────────────────────┴───────────────────────────┘
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
│  Distribution Rule                              │ Distributed │ Status     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  FS Vol 1                                       │   625 files │ Started    │
│  If [Flying Sparks Volume 1 Digital] is in      │             │ 10/13/24   │
│  the order, distribute Flying Sparks Vol 1.     │             │ [Refresh]  │
│  Lockdown/Payment is not required.              │             │            │
│  ─────────────────────────────────────────────────────────────────────────  │
│  FS Vol 2                                       │     3 files │ Started    │
│  If [Flying Sparks Volume 2 Digital] is in      │             │ 09/27/24   │
│  the order, distribute Flying Sparks Vol 2.     │             │ [Refresh]  │
│  ─────────────────────────────────────────────────────────────────────────  │

Table Dimensions:
- Distribution Rule column: 60% width
- Distributed column: 100px
- Status column: 140px (includes refresh button)
- Delete icon column: 40px
- Row height: 80px minimum (multi-line content)
- Row padding: 16px vertical

Tag styling (product names):
- Background: #e8e8e8
- Padding: 4px 8px
- Border-radius: 4px
- Font-size: 13px

Link styling:
- Color: teal
- Text-decoration: underline on hover
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

## Pre-Orders & Upselling

### Launch Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏠 Launch   [Dashboard] [Email Campaigns] [Teaser Pages] [Projects] [Members]│
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Elven Destiny: A Men's Fantasy Harem Novel                                 │
│  Last Updated: 08/14/25 09:00 PDT                         [Update]          │
│                                                                             │
├────────────────────┬────────────────────────────────────────────────────────┤
│                    │                                                        │
│  PROJECT CARD      │  NEW VS RETURNING BACKERS (Chart)                      │
│  ────────────────  │  ─────────────────────────────────────────────────     │
│  Width: 260px      │  Width: flexible (remaining space)                     │
│                    │                                                        │
│  [Project Image]   │  ┌────────────────────────────────────────────────┐    │
│  160px × 200px     │  │                                                │    │
│                    │  │  Bar chart with date x-axis                    │    │
│  « 10th  Your 11th │  │  Height: 280px                                 │    │
│         project    │  │  Bars: light teal (returning) / dark teal (new)│    │
│                    │  │                                                │    │
│  Elven Destiny:    │  └────────────────────────────────────────────────┘    │
│  A Men's Fantasy   │                                                        │
│  Harem Novel       │  ┌──────────────────────────────────────────────────┐  │
│                    │  │  [Returning Backers] [New Backers]               │  │
│  [KS] View project │  │  Stacked bar: shows proportion                   │  │
│                    │  │  Height: 32px                                    │  │
│  $1,306            │  └──────────────────────────────────────────────────┘  │
│  pledged           │                                                        │
│                    │  ┌─────────────────────────────────────────────────┐   │
│  35 backers        │  │                    Backers        Pledged       │   │
│                    │  │  ■ Returning         9 (19%)    $247 ($27.44/b) │   │
│  $37.31            │  │  ■ New Backers      26 (81%)  $1,059 ($/backer) │   │
│  average pledge    │  │  ─────────────────────────────────────────────  │   │
│                    │  │  Total              35         $1,306           │   │
│  0 Days to go      │  └─────────────────────────────────────────────────┘   │
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
```

---

## Email Campaigns (Launch)

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
│  Status │ Title                              │ Sent on │ Sent to │ Scheduled│
│  ───────┼────────────────────────────────────┼─────────┼─────────┼──────────│
│  [Draft]│ [img] Special Early Access...      │ never   │ 0       │ Not yet  │
│         │                                    │         │ members │ scheduled│
│  ───────┼────────────────────────────────────┼─────────┼─────────┼──────────│
│  [Draft]│ [img] We're Getting Ready...       │ never   │ 1       │ Not yet  │
│         │                                    │         │ member  │ scheduled│
│  ───────┼────────────────────────────────────┼─────────┼─────────┼──────────│
│  [Sent] │ [img] 48 Hours Left: All Eyes...   │ Feb 27  │ 1662    │ Sent     │
│         │                                    │ 15:25   │ members │          │
│  ───────┼────────────────────────────────────┼─────────┼─────────┼──────────│

Table Dimensions:
- Status column: 60px
- Thumbnail column: 80px (image: 60px × 40px)
- Title column: flexible (min 300px)
- Sent on column: 120px
- Sent to column: 100px
- Scheduled for column: 100px
- Project column: 200px
- Response column: 60px

Status Badge Styling:
- Draft: gray background (#e0e0e0), dark text
- Sent: teal background, white text
- Padding: 4px 8px
- Border-radius: 4px
- Font-size: 11px
- Text-transform: uppercase

Row height: 72px (to accommodate thumbnail)
Row hover: light gray background (#f9f9f9)
```

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
│     │   │  Get your fans excited...                                         │
│     │   │                                                                   │
│     ●───┤  ✉ At Launch                                  [Start draft]      │
│     │   │  Announce exclusively to your fans...                             │
│     │   │                                                                   │
│     ●───┤  ✉ After Launch                               [Start draft]      │
│     │   │  Remind those that were interested...                             │
│     │   │                                                                   │
│     ●───┘  ✉ Project Ending                             [Start draft]      │
│            Remind your fans that they only have...                          │
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
│                    │                                                        │
│  Customize         │  ─────────────────────────────────────────────────     │
│                    │                                                        │
│  Send              │  1. Your audience will receive an email.               │
│                    │                                                        │
│  Results           │  ┌────────────────────────────────────────────────┐    │
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
└────────────────────┴────────────────────────────────────────────────────────┘
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
│  │  │  ⚠ Sending emails costs $99 per project. [Pay Now »]          │  │    │
│  │  │  You can send emails for free if you launch on BackerKit     │  │    │
│  │  │  Crowdfunding »                                               │  │    │
│  │  │  ─────────────────────────────────────────────────────────    │  │    │
│  │  │                                                               │  │    │
│  │  │  Send To                                                      │  │    │
│  │  │  1829                                                         │  │    │
│  │  │  members who have not pledged to this project                 │  │    │
│  │  │                                                               │  │    │
│  │  │  ┌────────────────────────┐  [🔍 Filter Members]              │  │    │
│  │  │  │  ✉ Send Email Campaign │                                   │  │    │
│  │  │  └────────────────────────┘                                   │  │    │
│  │  │  (disabled until payment)                                     │  │    │
│  │  │                                                               │  │    │
│  │  │  Scheduled Send Date - Pacific Time                           │  │    │
│  │  │  [Date picker]                                                │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Warning Banner Styling:
- Background: #fffbeb (light yellow)
- Border-left: 4px solid #f59e0b (amber)
- Padding: 16px
- Price text: bold, #c53030 (red)

Send Count Typography:
- Number: 48px bold
- Label: 14px gray
- Left-aligned within card
```

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
