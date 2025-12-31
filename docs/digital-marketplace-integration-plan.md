# Digital Marketplace Integration Plan

## Overview

This document outlines the complete integration plan for adding a Digital Marketplace feature to IndieCrowdfund. The marketplace will allow creators to sell digital products (primarily books/PDFs) directly to customers, with full support for company profiles, content moderation, and instant delivery.

---

## Table of Contents

1. [Feature Summary](#feature-summary)
2. [Database Schema](#database-schema)
3. [Frontend Implementation](#frontend-implementation)
4. [API Routes](#api-routes)
5. [Admin Panel Integration](#admin-panel-integration)
6. [Creator Dashboard Integration](#creator-dashboard-integration)
7. [Backer Dashboard Integration](#backer-dashboard-integration)
   - [Digital Library Enhancement](#enhanced-digital-library-tab)
   - [PDF Cover Extraction](#pdf-cover-extraction-implementation)
8. [Content Moderation & NSFW Handling](#content-moderation--nsfw-handling)
9. [UI/UX Guidelines](#uiux-guidelines)
10. [Implementation Phases](#implementation-phases)
11. [File Structure](#file-structure)

---

## Feature Summary

### Homepage Marketplace Link
- New "Marketplace" navigation link on homepage
- Routes to `/marketplace`

### Marketplace Page Structure (`/marketplace`)
- **Tab Selector** (left-aligned):
  - Left Tab: "Sort by Book" (default)
  - Right Tab: "Sort by Company"

### Sort by Book View
- **4-column layout** on desktop (each tile ~20% horizontal width)
- **16:9 aspect ratio tiles** with glassmorphism design
- **Sections** (3 rows each):
  - Featured Books
  - Staff Picks
  - All Books
- Each section has a "View All" link → dedicated page with 4-column grid

### Sort by Company View
- Company cards in 4-column layout
- Click → Company Profile page with:
  - Banner image
  - About/Story section (rich text)
  - Company's marketplace books

### Product Detail Page
- Mirrors prelaunch page format
- Includes: Story, images, videos, price, purchase button
- Rich media support (same as project pages)

### Creator Dashboard Integration
- New "Marketplace" tab in `/dashboard`
- Upload books with:
  - Promo image/video (same settings as project creation)
  - Title, description (rich text)
  - Price
  - PDF upload
  - NSFW content checkbox
- Company Profile editor:
  - Banner image
  - About section (rich text)

### Backer Dashboard Integration
- **Rename "Book Reader" tab to "Digital Library"**
- Purchased books appear in `/dashboard/backer`
- Instant delivery on purchase
- Success message with "Go read it now" option

### Digital Library Enhancement (Existing Tab Upgrade)
- **PDF First Page as Cover Image** - Extract and display actual book covers instead of generic icons
- **Searchable** - Full-text search across all library items by title
- **Sortable** - Sort by Title, Date Added, File Size, Reading Progress
- **Filterable** - Filter by Source (Crowdfunding/Marketplace), Status (Unread/In Progress/Completed)
- **Grid/List View Toggle** - Switch between card grid and compact list views
- **Reading Progress Tracking** - Show percentage read, resume from last position

### Admin Panel Integration
- New "Marketplace" section in `/admin`
- Features:
  - Featured Books management
  - Staff Picks management
  - Approval/Rejection workflow
  - Book deactivation
  - Content moderation review

---

## Database Schema

### New Models to Add to `prisma/schema.prisma`

```prisma
// ============================================
// MARKETPLACE MODELS
// ============================================

model MarketplaceBook {
  id                String   @id @default(cuid())
  creatorId         String
  creator           User     @relation("MarketplaceCreator", fields: [creatorId], references: [id])

  // Basic Info
  title             String
  slug              String
  description       String   @db.Text  // Rich text HTML
  shortDescription  String?  @db.VarChar(300)

  // Media
  coverImageUrl     String?
  promoVideoUrl     String?
  galleryImages     Json?    // Array of image URLs

  // Pricing
  price             Decimal  @db.Decimal(10, 2)
  currency          String   @default("USD")

  // Digital File
  pdfFileUrl        String   // R2 storage URL
  pdfFileName       String?
  pdfFileSize       Int?     // In bytes

  // Content Flags
  hasAdultContent   Boolean  @default(false)
  hasRiskyContent   Boolean  @default(false)
  promoContentSfw   Boolean  @default(true)
  paymentProcessor  PaymentProcessor @default(STRIPE)

  // Status & Moderation
  status            MarketplaceBookStatus @default(DRAFT)
  submittedAt       DateTime?
  approvedAt        DateTime?
  rejectedAt        DateTime?
  rejectionReason   String?
  deactivatedAt     DateTime?
  deactivationReason String?

  // Featured/Curated
  isFeatured        Boolean  @default(false)
  isStaffPick       Boolean  @default(false)
  featuredOrder     Int?
  staffPickOrder    Int?

  // Categorization
  category          String?
  tags              String[] @default([])

  // Stats
  purchaseCount     Int      @default(0)
  viewCount         Int      @default(0)

  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  publishedAt       DateTime?

  // Relations
  purchases         MarketplacePurchase[]
  reviews           MarketplaceBookReview[]
  companyId         String?
  company           CompanyProfile? @relation(fields: [companyId], references: [id])

  @@unique([creatorId, slug])
  @@index([status])
  @@index([isFeatured])
  @@index([isStaffPick])
  @@index([category])
  @@index([createdAt])
}

enum MarketplaceBookStatus {
  DRAFT
  SUBMITTED
  APPROVED
  REJECTED
  LIVE
  DEACTIVATED
}

model CompanyProfile {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])

  // Profile Info
  name              String
  slug              String   @unique
  tagline           String?  @db.VarChar(200)
  about             String?  @db.Text  // Rich text HTML

  // Media
  bannerImageUrl    String?
  logoUrl           String?

  // Contact & Social
  website           String?
  socialLinks       Json?    // { twitter, facebook, instagram, etc. }

  // Status
  isActive          Boolean  @default(true)
  isVerified        Boolean  @default(false)

  // Stats
  bookCount         Int      @default(0)
  totalSales        Int      @default(0)

  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  // Relations
  books             MarketplaceBook[]

  @@index([slug])
  @@index([isActive])
}

model MarketplacePurchase {
  id                String   @id @default(cuid())
  bookId            String
  book              MarketplaceBook @relation(fields: [bookId], references: [id])
  buyerId           String
  buyer             User     @relation("MarketplaceBuyer", fields: [buyerId], references: [id])

  // Transaction
  amount            Decimal  @db.Decimal(10, 2)
  currency          String   @default("USD")
  paymentProcessor  PaymentProcessor
  transactionId     String?  // Stripe or DivinityCoin transaction ID

  // Status
  status            PurchaseStatus @default(PENDING)
  completedAt       DateTime?
  refundedAt        DateTime?
  refundReason      String?

  // Delivery
  deliveredAt       DateTime?
  downloadCount     Int      @default(0)
  lastDownloadedAt  DateTime?

  // Timestamps
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@index([buyerId])
  @@index([bookId])
  @@index([status])
}

enum PurchaseStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
}

model MarketplaceBookReview {
  id                String   @id @default(cuid())
  bookId            String
  book              MarketplaceBook @relation(fields: [bookId], references: [id])
  reviewerId        String
  reviewer          User     @relation("MarketplaceReviewer", fields: [reviewerId], references: [id])

  // Review Content
  action            MarketplaceReviewAction
  previousStatus    MarketplaceBookStatus?
  newStatus         MarketplaceBookStatus
  notes             String?  @db.Text
  internalNotes     String?  @db.Text
  rejectionReason   String?

  // AI Analysis
  flagsRaised       String[] @default([])
  aiConfidenceScore Float?

  // Timestamps
  createdAt         DateTime @default(now())

  @@index([bookId])
  @@index([reviewerId])
}

enum MarketplaceReviewAction {
  SUBMITTED
  APPROVED
  REJECTED
  REQUESTED_CHANGES
  FLAGGED
  DEACTIVATED
  REACTIVATED
}
```

### User Model Extensions

Add to existing `User` model:

```prisma
model User {
  // ... existing fields ...

  // Marketplace Relations
  marketplaceBooks     MarketplaceBook[]     @relation("MarketplaceCreator")
  marketplacePurchases MarketplacePurchase[] @relation("MarketplaceBuyer")
  marketplaceReviews   MarketplaceBookReview[] @relation("MarketplaceReviewer")
  companyProfile       CompanyProfile?
}
```

---

## Frontend Implementation

### Page Routes

| Route | Description |
|-------|-------------|
| `/marketplace` | Main marketplace page with tabs |
| `/marketplace/books` | All books view |
| `/marketplace/books/featured` | Featured books view all |
| `/marketplace/books/staff-picks` | Staff picks view all |
| `/marketplace/books/[slug]` | Individual book detail page |
| `/marketplace/companies` | All companies view |
| `/marketplace/companies/[slug]` | Company profile page |
| `/dashboard/marketplace` | Creator marketplace management |
| `/dashboard/marketplace/books/new` | Create new book listing |
| `/dashboard/marketplace/books/[id]/edit` | Edit book listing |
| `/dashboard/marketplace/company` | Edit company profile |
| `/admin/marketplace` | Admin marketplace management |
| `/admin/marketplace/books` | Manage all books |
| `/admin/marketplace/featured` | Manage featured books |
| `/admin/marketplace/staff-picks` | Manage staff picks |

### Component Structure

```
src/
├── app/
│   ├── marketplace/
│   │   ├── page.tsx                    # Main marketplace with tabs
│   │   ├── layout.tsx                  # Marketplace layout
│   │   ├── books/
│   │   │   ├── page.tsx                # All books grid
│   │   │   ├── featured/page.tsx       # Featured books grid
│   │   │   ├── staff-picks/page.tsx    # Staff picks grid
│   │   │   └── [slug]/page.tsx         # Book detail page
│   │   └── companies/
│   │       ├── page.tsx                # All companies grid
│   │       └── [slug]/page.tsx         # Company profile page
│   │
│   ├── dashboard/
│   │   └── marketplace/
│   │       ├── page.tsx                # Creator marketplace dashboard
│   │       ├── books/
│   │       │   ├── new/page.tsx        # Create book
│   │       │   └── [id]/
│   │       │       └── edit/page.tsx   # Edit book
│   │       └── company/page.tsx        # Edit company profile
│   │
│   └── admin/
│       └── marketplace/
│           ├── page.tsx                # Admin marketplace dashboard
│           ├── books/page.tsx          # Manage all books
│           ├── featured/page.tsx       # Manage featured
│           └── staff-picks/page.tsx    # Manage staff picks
│
└── components/
    └── marketplace/
        ├── book-tile.tsx               # 16:9 glassmorphism book tile
        ├── book-grid.tsx               # 4-column responsive grid
        ├── book-section.tsx            # Section with header + view all
        ├── company-tile.tsx            # Company card tile
        ├── company-grid.tsx            # Company grid layout
        ├── book-detail.tsx             # Full book detail view
        ├── company-profile.tsx         # Company profile view
        ├── purchase-button.tsx         # Buy now button with modal
        ├── purchase-success-modal.tsx  # Success confirmation
        ├── book-form.tsx               # Create/edit book form
        ├── company-form.tsx            # Company profile form
        └── admin/
            ├── book-review-panel.tsx   # Admin review panel
            ├── featured-manager.tsx    # Featured books manager
            └── staff-picks-manager.tsx # Staff picks manager
```

---

## API Routes

### Public Routes

```
GET  /api/marketplace/books
     Query: ?featured=true&staffPick=true&category=X&page=1&limit=20
     Returns: Paginated list of LIVE books

GET  /api/marketplace/books/[slug]
     Returns: Full book details for public view

GET  /api/marketplace/companies
     Query: ?page=1&limit=20
     Returns: Paginated list of active companies

GET  /api/marketplace/companies/[slug]
     Returns: Company profile with books
```

### Authenticated Routes

```
POST /api/marketplace/books
     Body: { title, description, price, coverImage, promoVideo, pdfFile, ... }
     Returns: Created book (DRAFT status)

PUT  /api/marketplace/books/[id]
     Body: { ...updatedFields }
     Returns: Updated book

DELETE /api/marketplace/books/[id]
     Returns: Success/failure

POST /api/marketplace/books/[id]/submit
     Returns: Book with SUBMITTED status

POST /api/marketplace/purchase
     Body: { bookId, paymentMethod }
     Returns: Purchase record, triggers instant delivery

GET  /api/marketplace/purchases
     Returns: User's purchased books

GET  /api/marketplace/purchases/[id]/download
     Returns: Signed URL for PDF download

POST /api/marketplace/company
     Body: { name, about, bannerImage, ... }
     Returns: Created/updated company profile

PUT  /api/marketplace/company
     Body: { ...updatedFields }
     Returns: Updated company profile
```

### Admin Routes

```
GET  /api/admin/marketplace/books
     Query: ?status=SUBMITTED&page=1&limit=20
     Returns: All books with filters

POST /api/admin/marketplace/books/[id]/review
     Body: { action: 'APPROVE'|'REJECT', notes, rejectionReason }
     Returns: Updated book with review record

PUT  /api/admin/marketplace/books/[id]/featured
     Body: { isFeatured: boolean, featuredOrder: number }
     Returns: Updated book

PUT  /api/admin/marketplace/books/[id]/staff-pick
     Body: { isStaffPick: boolean, staffPickOrder: number }
     Returns: Updated book

PUT  /api/admin/marketplace/books/[id]/deactivate
     Body: { reason }
     Returns: Updated book (DEACTIVATED status)

PUT  /api/admin/marketplace/books/[id]/reactivate
     Returns: Updated book (LIVE status)
```

---

## Admin Panel Integration

### Location: `/admin/marketplace`

### Features

1. **Dashboard Overview**
   - Total books (by status)
   - Pending reviews count
   - Total sales
   - Active sellers count

2. **Books Tab**
   - Filter by status: All, Pending Review, Live, Deactivated
   - Search by title/creator
   - Sortable columns
   - Actions: Review, Approve, Reject, Deactivate

3. **Featured Management Tab**
   - Drag-and-drop ordering
   - Add/remove featured books
   - Preview featured section

4. **Staff Picks Management Tab**
   - Drag-and-drop ordering
   - Add/remove staff picks
   - Preview staff picks section

### Review Dialog (Mirrors Project Review)

```tsx
// Following pattern from src/app/admin/projects/components/dialogs/review-dialog.tsx

interface BookReviewDialogProps {
  book: MarketplaceBook;
  onApprove: (notes: string) => void;
  onReject: (reason: string, notes: string) => void;
  onRequestChanges: (notes: string) => void;
}
```

### Review Panel Components

- Book preview (cover, title, description)
- Creator info
- Content flags display
- AI moderation results
- Review history
- Action buttons

---

## Creator Dashboard Integration

### Location: `/dashboard` → New "Marketplace" Tab

### Tab Structure

```tsx
<TabsTrigger value="marketplace">
  <Store className="w-4 h-4 mr-2" />
  Marketplace
</TabsTrigger>
```

### Marketplace Tab Content

1. **My Books Section**
   - List of creator's books with status badges
   - Quick stats: Views, Sales, Revenue
   - Actions: Edit, View, Submit for Review

2. **Company Profile Section**
   - Edit company profile banner
   - Edit about section (rich text)
   - Preview company page

3. **Create New Book Button**
   - Opens book creation flow

### Book Creation Form

Follow existing project creation patterns from `src/components/project/builder/`:

**Steps:**
1. **Basics** - Title, cover image, promo video, price
2. **Description** - Rich text description (TipTap editor)
3. **Upload** - PDF file upload
4. **Content Flags** - NSFW checkboxes (same as project payment step)
5. **Review** - Preview and submit

**Media Upload Settings (Match Existing)**
```typescript
// From src/app/api/upload/route.ts patterns
const imageConfig = {
  maxSize: 10 * 1024 * 1024, // 10MB
  formats: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  outputFormat: 'webp',
  quality: 85
};

const videoConfig = {
  maxSize: 100 * 1024 * 1024, // 100MB
  formats: ['video/mp4', 'video/webm', 'video/quicktime']
};

const pdfConfig = {
  maxSize: 100 * 1024 * 1024, // 100MB
  formats: ['application/pdf']
};
```

### Company Profile Form

```tsx
// Fields
- name: string (company name)
- slug: string (auto-generated from name, editable)
- tagline: string (200 char max)
- about: string (rich text)
- bannerImageUrl: string (upload)
- logoUrl: string (upload)
- website: string (optional)
- socialLinks: { twitter, facebook, instagram }
```

---

## Backer Dashboard Integration

### Location: `/dashboard/backer` → Extended Tabs

### Tab Rename: "Book Reader" → "Digital Library"

**IMPORTANT:** Rename the existing "Book Reader" tab to "Digital Library" across the entire codebase.

```tsx
// OLD
<TabsTrigger value="book-reader">
  <BookOpen className="w-4 h-4 mr-2" />
  Book Reader
</TabsTrigger>

// NEW
<TabsTrigger value="digital-library">
  <Library className="w-4 h-4 mr-2" />
  Digital Library
</TabsTrigger>
```

### Enhanced Digital Library Tab

Replace the current basic book reader with a complete digital library experience:

#### Features

1. **PDF First Page as Cover Image**
   - Extract first page of PDF on upload using `pdf.js`
   - Generate thumbnail image and store in R2
   - Use this as the preview image instead of generic icon
   - Fallback to generic icon if extraction fails

2. **Sortable Library**
   - Sort by: Title (A-Z, Z-A), Date Added (Newest, Oldest), File Size, Progress
   - Persist sort preference in localStorage

3. **Filterable Library**
   - Filter by: Source (Crowdfunding Rewards, Marketplace Purchases, All)
   - Filter by: Status (Unread, In Progress, Completed)
   - Filter by: File Type (PDF, EPUB, etc.)
   - Search by title

4. **Reading Progress Tracking**
   - Track current page / total pages
   - Show percentage read on card
   - Resume reading from last position

5. **Grid/List View Toggle**
   - Grid view: Card-based layout with cover images
   - List view: Compact rows with metadata

### Digital Library UI Components

#### Library Card Component

```tsx
interface LibraryCardProps {
  file: DigitalFile | MarketplacePurchase;
  coverUrl: string;        // Generated from PDF first page
  title: string;
  source: 'crowdfunding' | 'marketplace';
  fileSize: number;
  progress: number;        // 0-100 percentage read
  dateAdded: Date;
  lastRead?: Date;
}

// Card Design
<div className="
  group relative rounded-xl overflow-hidden
  bg-gradient-to-br from-zinc-800/80 to-zinc-900/80
  backdrop-blur-md border border-white/10
  hover:border-amber-400/30 hover:shadow-lg hover:shadow-amber-500/10
  transition-all duration-300
">
  {/* Cover Image - PDF First Page */}
  <div className="aspect-[3/4] relative">
    <Image
      src={coverUrl}
      alt={title}
      fill
      className="object-cover"
    />
    {/* Progress Overlay */}
    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
      <div
        className="h-full bg-amber-500"
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>

  {/* Content */}
  <div className="p-3 space-y-1">
    <h3 className="font-medium text-white line-clamp-2">{title}</h3>
    <div className="flex items-center justify-between text-xs text-zinc-400">
      <span>{formatFileSize(fileSize)}</span>
      <span>{progress}% read</span>
    </div>
    {/* Source Badge */}
    <Badge variant={source === 'marketplace' ? 'default' : 'secondary'}>
      {source === 'marketplace' ? 'Purchased' : 'Reward'}
    </Badge>
  </div>
</div>
```

#### Filter/Sort Bar Component

```tsx
<div className="flex flex-wrap items-center gap-4 mb-6">
  {/* Search */}
  <div className="relative flex-1 min-w-[200px]">
    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
    <Input
      placeholder="Search your library..."
      value={searchQuery}
      onChange={(e) => setSearchQuery(e.target.value)}
      className="pl-10"
    />
  </div>

  {/* Source Filter */}
  <Select value={sourceFilter} onValueChange={setSourceFilter}>
    <SelectTrigger className="w-[160px]">
      <SelectValue placeholder="All Sources" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Sources</SelectItem>
      <SelectItem value="crowdfunding">Crowdfunding Rewards</SelectItem>
      <SelectItem value="marketplace">Marketplace Purchases</SelectItem>
    </SelectContent>
  </Select>

  {/* Status Filter */}
  <Select value={statusFilter} onValueChange={setStatusFilter}>
    <SelectTrigger className="w-[140px]">
      <SelectValue placeholder="All Status" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="all">All Status</SelectItem>
      <SelectItem value="unread">Unread</SelectItem>
      <SelectItem value="in-progress">In Progress</SelectItem>
      <SelectItem value="completed">Completed</SelectItem>
    </SelectContent>
  </Select>

  {/* Sort */}
  <Select value={sortBy} onValueChange={setSortBy}>
    <SelectTrigger className="w-[160px]">
      <SelectValue placeholder="Sort by" />
    </SelectTrigger>
    <SelectContent>
      <SelectItem value="date-desc">Newest First</SelectItem>
      <SelectItem value="date-asc">Oldest First</SelectItem>
      <SelectItem value="title-asc">Title A-Z</SelectItem>
      <SelectItem value="title-desc">Title Z-A</SelectItem>
      <SelectItem value="progress-desc">Most Progress</SelectItem>
      <SelectItem value="progress-asc">Least Progress</SelectItem>
      <SelectItem value="size-desc">Largest</SelectItem>
      <SelectItem value="size-asc">Smallest</SelectItem>
    </SelectContent>
  </Select>

  {/* View Toggle */}
  <div className="flex border border-zinc-700 rounded-lg overflow-hidden">
    <Button
      variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
      size="sm"
      onClick={() => setViewMode('grid')}
    >
      <Grid className="w-4 h-4" />
    </Button>
    <Button
      variant={viewMode === 'list' ? 'secondary' : 'ghost'}
      size="sm"
      onClick={() => setViewMode('list')}
    >
      <List className="w-4 h-4" />
    </Button>
  </div>
</div>
```

### PDF Cover Extraction Implementation

#### API Endpoint: `/api/backer/digital-files/extract-cover`

```typescript
// Server-side PDF first page extraction
import { getDocument } from 'pdfjs-dist';
import sharp from 'sharp';

export async function extractPdfCover(pdfUrl: string, fileId: string): Promise<string> {
  // 1. Fetch PDF from R2
  const pdfBuffer = await fetchFromR2(pdfUrl);

  // 2. Load PDF with pdf.js
  const pdf = await getDocument({ data: pdfBuffer }).promise;

  // 3. Get first page
  const page = await pdf.getPage(1);

  // 4. Render to canvas (server-side using node-canvas)
  const viewport = page.getViewport({ scale: 2.0 }); // Higher scale for quality
  const canvas = createCanvas(viewport.width, viewport.height);
  const context = canvas.getContext('2d');

  await page.render({
    canvasContext: context,
    viewport: viewport,
  }).promise;

  // 5. Convert to WebP and resize
  const coverBuffer = await sharp(canvas.toBuffer())
    .resize(400, 600, { fit: 'cover' })
    .webp({ quality: 85 })
    .toBuffer();

  // 6. Upload to R2
  const coverUrl = await uploadToR2(
    coverBuffer,
    `covers/${fileId}.webp`,
    'image/webp'
  );

  return coverUrl;
}
```

#### Database Schema Addition

Add to existing `DigitalFile` model:

```prisma
model DigitalFile {
  // ... existing fields ...

  // Cover extraction
  coverImageUrl     String?           // Generated PDF first page thumbnail
  coverExtractedAt  DateTime?         // When cover was generated
  coverExtractionFailed Boolean @default(false)  // If extraction failed

  // Reading progress
  readingProgress   Json?             // { currentPage: number, totalPages: number, lastPosition: string }
  lastReadAt        DateTime?
}
```

### Integration with Marketplace Purchases

The Digital Library should display items from TWO sources:

1. **Crowdfunding Digital Rewards** (existing `DigitalFile` + `DigitalDistribution` models)
2. **Marketplace Purchases** (new `MarketplacePurchase` model)

```typescript
// Unified library item type
interface LibraryItem {
  id: string;
  title: string;
  fileUrl: string;
  coverImageUrl: string | null;
  fileSize: number;
  source: 'crowdfunding' | 'marketplace';
  sourceId: string;  // projectId or bookId
  sourceName: string;  // Project title or Book title
  dateAdded: Date;
  progress: {
    currentPage: number;
    totalPages: number;
    percentage: number;
  };
  lastReadAt: Date | null;
}

// API endpoint combines both sources
// GET /api/backer/digital-library
```

### Purchase Success Flow

1. User clicks "Buy Now" on book detail page
2. Payment processed (Stripe or DivinityCoin based on content flags)
3. Purchase record created with `COMPLETED` status
4. **Cover extraction job triggered** for the purchased PDF
5. Success modal displays:
   ```
   Purchase Successful!

   "[Book Title]" has been delivered to your Digital Library.

   [Go Read It Now] [Continue Browsing]
   ```
6. "Go Read It Now" navigates to `/dashboard/backer?tab=digital-library`

### Component Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/app/dashboard/backer/components/book-reader-tab.tsx` | **RENAME & REFACTOR** | Rename to `digital-library-tab.tsx`, complete rewrite |
| `src/app/dashboard/backer/components/digital-library-tab.tsx` | **CREATE** | New enhanced library component |
| `src/app/dashboard/backer/components/library-card.tsx` | **CREATE** | Individual book card with cover |
| `src/app/dashboard/backer/components/library-filters.tsx` | **CREATE** | Filter/sort bar component |
| `src/app/dashboard/backer/components/library-list-item.tsx` | **CREATE** | List view row component |
| `src/app/api/backer/digital-library/route.ts` | **CREATE** | Unified library endpoint |
| `src/app/api/backer/digital-files/extract-cover/route.ts` | **CREATE** | PDF cover extraction |
| `src/app/api/backer/digital-files/progress/route.ts` | **CREATE** | Save/load reading progress |
| `src/lib/pdf-cover-extractor.ts` | **CREATE** | Server-side PDF rendering utility |

---

## Content Moderation & NSFW Handling

### Content Flags (Same as Projects)

```typescript
interface ContentFlags {
  hasAdultContent: boolean;   // Adult/explicit content
  hasRiskyContent: boolean;   // Violence, drugs, etc.
  promoContentSfw: boolean;   // Promo materials are SFW
}
```

### Payment Processor Logic

```typescript
// If hasAdultContent OR hasRiskyContent = true
// Then paymentProcessor = DIVINITYCOIN
// Otherwise = STRIPE
```

### UI Checkboxes (Creator Dashboard)

Mirror existing project payment step:

```tsx
<div className="space-y-4">
  <div className="flex items-center gap-2">
    <Checkbox
      id="adult-content"
      checked={hasAdultContent}
      onCheckedChange={setHasAdultContent}
    />
    <Label htmlFor="adult-content">
      This book contains adult/explicit content
    </Label>
  </div>

  <div className="flex items-center gap-2">
    <Checkbox
      id="risky-content"
      checked={hasRiskyContent}
      onCheckedChange={setHasRiskyContent}
    />
    <Label htmlFor="risky-content">
      This book contains potentially sensitive content
      (violence, drug references, etc.)
    </Label>
  </div>

  {(hasAdultContent || hasRiskyContent) && (
    <Alert variant="warning">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>
        Due to content restrictions, this book will only accept
        DivinityCoin payments.
      </AlertDescription>
    </Alert>
  )}
</div>
```

### Admin Review with AI Moderation

Follow existing pattern from `/api/projects/[id]/submit/route.ts`:

1. AI content moderation on submission
2. Fraud detection checks
3. Confidence scoring
4. Auto-flagging system
5. Human review queue for flagged items

---

## UI/UX Guidelines

### Glassmorphism Design System

**Book Tile (16:9)**

```tsx
<div className="
  relative aspect-video rounded-xl overflow-hidden
  bg-gradient-to-br from-white/10 to-white/5
  backdrop-blur-md
  border border-white/10
  shadow-lg shadow-black/20
  hover:shadow-xl hover:shadow-purple-500/10
  hover:border-purple-400/30
  transition-all duration-300
  group
">
  {/* Cover Image */}
  <Image
    src={book.coverImageUrl}
    alt={book.title}
    fill
    className="object-cover group-hover:scale-105 transition-transform"
  />

  {/* Gradient Overlay */}
  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

  {/* Content */}
  <div className="absolute bottom-0 left-0 right-0 p-4">
    <h3 className="text-white font-semibold line-clamp-2">{book.title}</h3>
    <p className="text-white/70 text-sm">{book.creator.name}</p>
    <p className="text-emerald-400 font-bold mt-1">${book.price}</p>
  </div>
</div>
```

### 4-Column Grid Layout

```tsx
<div className="
  grid
  grid-cols-1 sm:grid-cols-2 lg:grid-cols-4
  gap-6
">
  {books.map(book => (
    <BookTile key={book.id} book={book} />
  ))}
</div>
```

### Section Layout (3 Rows)

```tsx
<section className="space-y-4">
  {/* Header */}
  <div className="flex items-center justify-between">
    <h2 className="text-2xl font-bold text-white">Featured Books</h2>
    <Link href="/marketplace/books/featured" className="
      text-sm text-purple-400 hover:text-purple-300
      flex items-center gap-1
    ">
      View All <ArrowRight className="w-4 h-4" />
    </Link>
  </div>

  {/* Grid (3 rows = 12 items on desktop) */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
    {featuredBooks.slice(0, 12).map(book => (
      <BookTile key={book.id} book={book} />
    ))}
  </div>
</section>
```

### Tab Selector Design

```tsx
<Tabs defaultValue="books" className="w-full">
  <TabsList className="
    w-fit bg-white/5 backdrop-blur-sm
    border border-white/10 rounded-lg p-1
  ">
    <TabsTrigger
      value="books"
      className="
        data-[state=active]:bg-purple-500/20
        data-[state=active]:text-purple-300
        rounded-md px-4 py-2
      "
    >
      Sort by Book
    </TabsTrigger>
    <TabsTrigger
      value="companies"
      className="
        data-[state=active]:bg-purple-500/20
        data-[state=active]:text-purple-300
        rounded-md px-4 py-2
      "
    >
      Sort by Company
    </TabsTrigger>
  </TabsList>

  <TabsContent value="books">
    <BookSections />
  </TabsContent>

  <TabsContent value="companies">
    <CompanyGrid />
  </TabsContent>
</Tabs>
```

### Rich Text Editor Usage

Use existing `RichTextEditor` component with marketplace-specific projectId:

```tsx
import { RichTextEditor } from '@/components/ui/rich-text-editor';

<RichTextEditor
  value={description}
  onChange={setDescription}
  projectId={`marketplace-${bookId}`}  // Unique folder for uploads
  placeholder="Describe your book..."
/>
```

---

## Implementation Phases

### Phase 1: Database & Core Models
- [x] Add Prisma schema models (MarketplaceBook, CompanyProfile, MarketplacePurchase, MarketplaceBookReview)
- [x] Extend DigitalFile model with cover extraction fields
- [x] Run migrations (schema ready - run `npx prisma migrate dev` on deploy)
- [ ] Create seed data for testing

### Phase 2: Digital Library Enhancement (Priority)
- [x] Rename "Book Reader" tab to "Digital Library" across codebase
- [x] Implement PDF first page cover extraction using pdf.js + sharp
- [x] Create `/api/backer/digital-files/extract-cover` endpoint
- [x] Create `/api/backer/digital-library` unified endpoint
- [x] Create `/api/backer/digital-files/progress` endpoint for reading progress
- [x] Build `digital-library-tab.tsx` with search, sort, filter capabilities
- [x] Build `library-card.tsx` component with cover image display (integrated in digital-library-tab.tsx)
- [x] Build `library-filters.tsx` component (integrated in digital-library-tab.tsx)
- [x] Build `library-list-item.tsx` for list view (integrated in digital-library-tab.tsx)
- [x] Implement Grid/List view toggle
- [ ] Backfill existing PDFs with extracted covers

### Phase 3: Marketplace API Routes
- [ ] Public marketplace endpoints
- [ ] Creator CRUD endpoints
- [ ] Admin management endpoints
- [ ] Purchase and delivery endpoints

### Phase 4: Marketplace Frontend
- [ ] `/marketplace` main page with tabs
- [ ] Book grid and tile components (16:9, glassmorphism)
- [ ] Book detail page (prelaunch-style format)
- [ ] Company profile pages
- [ ] View all pages (featured, staff picks, all)

### Phase 5: Creator Dashboard
- [ ] Marketplace tab in dashboard
- [ ] Book creation form (multi-step with promo image/video)
- [ ] Book edit/management
- [ ] Company profile editor with rich text
- [ ] Submit for review flow

### Phase 6: Admin Panel
- [ ] Marketplace admin section
- [ ] Review queue with AI moderation
- [ ] Featured/Staff Picks drag-and-drop management
- [ ] Deactivation controls

### Phase 7: Purchase Flow
- [ ] Payment integration (Stripe + DivinityCoin based on NSFW flags)
- [ ] Instant delivery system with cover extraction trigger
- [ ] Purchase success modal with "Go to Digital Library" CTA
- [ ] Integration with unified Digital Library

### Phase 8: Polish & Testing
- [ ] End-to-end testing
- [ ] Performance optimization for cover extraction
- [ ] Mobile responsiveness
- [ ] Accessibility review

---

## File Structure

```
src/
├── app/
│   ├── marketplace/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── loading.tsx
│   │   ├── books/
│   │   │   ├── page.tsx
│   │   │   ├── featured/
│   │   │   │   └── page.tsx
│   │   │   ├── staff-picks/
│   │   │   │   └── page.tsx
│   │   │   └── [slug]/
│   │   │       └── page.tsx
│   │   └── companies/
│   │       ├── page.tsx
│   │       └── [slug]/
│   │           └── page.tsx
│   │
│   ├── dashboard/
│   │   └── marketplace/
│   │       ├── page.tsx
│   │       ├── books/
│   │       │   ├── new/
│   │       │   │   └── page.tsx
│   │       │   └── [id]/
│   │       │       └── edit/
│   │       │           └── page.tsx
│   │       └── company/
│   │           └── page.tsx
│   │
│   ├── admin/
│   │   └── marketplace/
│   │       ├── page.tsx
│   │       ├── layout.tsx
│   │       ├── books/
│   │       │   └── page.tsx
│   │       ├── featured/
│   │       │   └── page.tsx
│   │       └── staff-picks/
│   │           └── page.tsx
│   │
│   └── api/
│       ├── marketplace/
│       │   ├── books/
│       │   │   ├── route.ts           # GET all, POST create
│       │   │   └── [slug]/
│       │   │       ├── route.ts       # GET, PUT, DELETE
│       │   │       └── submit/
│       │   │           └── route.ts   # POST submit for review
│       │   ├── companies/
│       │   │   ├── route.ts
│       │   │   └── [slug]/
│       │   │       └── route.ts
│       │   ├── purchase/
│       │   │   └── route.ts           # POST purchase
│       │   └── purchases/
│       │       ├── route.ts           # GET user purchases
│       │       └── [id]/
│       │           └── download/
│       │               └── route.ts   # GET signed download URL
│       │
│       └── admin/
│           └── marketplace/
│               ├── books/
│               │   ├── route.ts
│               │   └── [id]/
│               │       ├── route.ts
│               │       ├── review/
│               │       │   └── route.ts
│               │       ├── featured/
│               │       │   └── route.ts
│               │       ├── staff-pick/
│               │       │   └── route.ts
│               │       └── deactivate/
│               │           └── route.ts
│               └── stats/
│                   └── route.ts
│
├── components/
│   └── marketplace/
│       ├── book-tile.tsx
│       ├── book-grid.tsx
│       ├── book-section.tsx
│       ├── book-detail.tsx
│       ├── company-tile.tsx
│       ├── company-grid.tsx
│       ├── company-profile.tsx
│       ├── purchase-button.tsx
│       ├── purchase-success-modal.tsx
│       ├── book-form/
│       │   ├── index.tsx
│       │   ├── basics-step.tsx
│       │   ├── description-step.tsx
│       │   ├── upload-step.tsx
│       │   ├── content-flags-step.tsx
│       │   └── review-step.tsx
│       ├── company-form.tsx
│       └── admin/
│           ├── book-review-panel.tsx
│           ├── book-list.tsx
│           ├── featured-manager.tsx
│           └── staff-picks-manager.tsx
│
├── lib/
│   ├── marketplace/
│   │   ├── types.ts                   # TypeScript interfaces
│   │   ├── utils.ts                   # Helper functions
│   │   ├── store.ts                   # Zustand store (if needed)
│   │   └── hooks.ts                   # React hooks
│   └── pdf-cover-extractor.ts         # Server-side PDF rendering utility
│
└── (existing files to modify)
    ├── src/app/dashboard/backer/
    │   ├── page.tsx                   # Update tab name Book Reader → Digital Library
    │   └── components/
    │       ├── book-reader-tab.tsx    # RENAME to digital-library-tab.tsx
    │       ├── digital-library-tab.tsx  # NEW - Complete rewrite
    │       ├── library-card.tsx       # NEW - Book card with cover
    │       ├── library-filters.tsx    # NEW - Search/sort/filter bar
    │       ├── library-list-item.tsx  # NEW - List view row
    │       └── index.ts               # Update exports
    └── src/app/api/backer/
        ├── digital-library/
        │   └── route.ts               # NEW - Unified library endpoint
        └── digital-files/
            ├── extract-cover/
            │   └── route.ts           # NEW - PDF cover extraction
            └── progress/
                └── route.ts           # NEW - Reading progress save/load
```

---

## Key Integration Points

### Navigation Updates

**Header/Navbar** (`src/components/layout/header.tsx` or similar):
```tsx
// Add Marketplace link
<Link href="/marketplace" className="...">
  Marketplace
</Link>
```

**Dashboard Sidebar** (`src/app/dashboard/page.tsx`):
```tsx
// Add Marketplace tab for creators
{user.role === 'CREATOR' && (
  <TabsTrigger value="marketplace">
    <Store className="w-4 h-4 mr-2" />
    Marketplace
  </TabsTrigger>
)}
```

**Admin Sidebar** (`src/app/admin/layout.tsx`):
```tsx
// Add Marketplace section
<SidebarItem href="/admin/marketplace" icon={Store}>
  Marketplace
</SidebarItem>
```

### Authentication & Authorization

Use existing auth patterns:

```typescript
// From src/lib/auth.ts
import { auth } from '@/lib/auth';

// In API routes
const session = await auth();
if (!session?.user?.id) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Check if user is creator
if (session.user.role !== 'CREATOR' && session.user.role !== 'ADMIN') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
```

### Existing Component Reuse

| Component | Location | Usage |
|-----------|----------|-------|
| RichTextEditor | `src/components/ui/rich-text-editor.tsx` | Book descriptions, company about |
| Upload API | `src/app/api/upload/route.ts` | Images, videos, PDFs |
| Glassmorphism styles | `src/app/globals.css` | Book tiles, cards |
| Tabs | `src/components/ui/tabs.tsx` | Marketplace tabs, dashboard tabs |
| Dialog | `src/components/ui/dialog.tsx` | Review dialogs, purchase modal |
| Badge | `src/components/ui/badge.tsx` | Status badges |
| Button | `src/components/ui/button.tsx` | All actions |

---

## Security Considerations

1. **File Access Control**
   - PDF downloads require valid purchase record
   - Use signed URLs with expiration
   - Track download counts

2. **Payment Security**
   - Validate payment completion before delivery
   - Handle webhook failures gracefully
   - Implement refund workflows

3. **Content Moderation**
   - AI pre-screening on submission
   - Human review for flagged content
   - Quick deactivation for reported content

4. **Rate Limiting**
   - Limit download requests
   - Limit upload sizes
   - Prevent abuse of review system

---

## Success Metrics

1. **Launch Metrics**
   - Books listed
   - Sellers onboarded
   - Purchase conversion rate

2. **Growth Metrics**
   - Monthly active sellers
   - Monthly sales volume
   - Average book price

3. **Quality Metrics**
   - Review turnaround time
   - Content flag accuracy
   - Customer satisfaction

---

## Appendix: Existing Pattern References

### Project Builder Pattern
- Location: `src/components/project/builder/`
- Used for: Multi-step form with state management

### Admin Review Pattern
- Location: `src/app/admin/projects/`
- Used for: Approval queue with filtering

### Prelaunch Page Pattern
- Location: `src/app/projects/[vanityname]/[slug]/prelaunch/page.tsx`
- Used for: Product detail page template

### Digital File Delivery
- Location: `src/app/api/creator/indiekit/digital/route.ts`
- Used for: File upload and signed URL generation

### Backer Dashboard
- Location: `src/app/dashboard/backer/`
- Used for: Purchased content display

---

*Document Version: 1.0*
*Created: $(date)*
*Author: Integration Planning System*
