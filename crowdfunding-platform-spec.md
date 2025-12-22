# Crowdfunding Platform - Technical Specification

## Project Overview

Build a modern crowdfunding platform similar to Kickstarter with the following key differences:
- **Payment Processors**: Stripe (for fiat/traditional payments) + Divinity Coin (for cryptocurrency payments)
- **No Pay-Over-Time**: Single payment only (no installment options)
- **Rewards-to-Addons**: Ability to copy rewards as optional add-ons

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **UI Components**: Shadcn/ui
- **Charts/Analytics**: Recharts
- **Form Management**: React Hook Form + Zod validation
- **State Management**: Zustand (for global state)
- **Date Handling**: date-fns

### Backend
- **API**: Next.js API Routes (App Router)
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Cache**: Redis (optional, for performance)
- **Authentication**: NextAuth.js
- **File Upload**: UploadThing or AWS S3

### Infrastructure & Services
- **Hosting**: Vercel
- **Database Hosting**: Vercel Postgres or Supabase
- **File Storage**: AWS S3 or UploadThing
- **Email**: SendGrid or Resend
- **Payment Processing**: Stripe + Divinity Coin (cryptocurrency)
- **Analytics Integration**: Google Analytics, Meta Pixel support

---

## Core Features & Requirements

### 1. User Management
- User registration and authentication
- Creator profiles with bio, avatar, website links
- Backer profiles with preference tracking
- Email verification
- Password reset
- Role-based access: Creator, Backer, Collaborator, Admin
- **Behavioral tracking and preference system**
- **Project recommendation engine**
- **Personalized email notification system**

### 2. Project Creation (Multi-step Builder)

#### Step 1: Basics
- Project title (required)
- Subtitle/tagline
- Category selection
- Location
- Project image (main)
- Project video (optional, embeddable YouTube/Vimeo)
- Funding goal amount (required)
- Campaign duration options:
  - Fixed number of days (1-60)
  - End on specific date & time
- Target launch date (optional)
- **Note**: Remove all "Pledge Over Time" functionality

#### Step 2: Rewards
- Create reward tiers
  - Title (required)
  - Description (rich text editor)
  - Pledge amount (required)
  - Image (optional)
  - Estimated delivery (month/year)
  - Shipping options:
    - Ships worldwide
    - Ships to certain countries (multi-select)
    - Local pickup/event/service (no shipping)
    - Digital reward (no shipping)
  - Quantity limits:
    - Unlimited
    - Limited quantity (with number)
  - Availability/visibility:
    - Available to all backers
    - Secret reward (only via direct link)
  - Time limits:
    - No time limit
    - Available from [start date] to [end date]
  
#### **NEW FEATURE: Rewards Management**
- **Copy Reward to Add-ons** button for each reward
  - One-click duplication
  - Copies all fields (title, description, price, image, delivery, shipping)
  - Places copy in "Add-ons" tab
  - Allows editing after copy
  - Shows confirmation: "Reward copied to Add-ons"

#### Step 2b: Add-ons
- Separate tab for add-ons
- Same structure as rewards but marked as "optional extras"
- Add-ons can be selected during pledge in addition to main reward
- Backers can select multiple add-ons
- Add to pledge total automatically
- Can be created from scratch OR copied from rewards

#### Step 2c: Items
- Define individual items included in rewards
- Item title
- Item image (optional)
- Item description
- Link items to specific rewards

#### Step 3: Story
- Rich text editor for project description
- Support for:
  - Text formatting
  - Images (inline)
  - Videos (embeds)
  - Links
- **Risks & Challenges** section (required)
  - Free-form text area
  - Guidance text: "Be honest about potential risks and how you plan to overcome them"
- **AI Usage Disclosure** (required)
  - Yes/No toggle: "Will your project involve AI technology or use AI content?"
- **Frequently Asked Questions** (optional)
  - Add/remove FAQ items
  - Question + Answer pairs

#### Step 4: People
- **Creator Profile** (editable within project or links to settings)
  - Name (locked after first project launch)
  - Avatar
  - Biography (300 chars max)
  - Location
  - Timezone
  - Vanity URL (e.g., kickstarter.com/profile/username)
  - Websites (add multiple)
  - Privacy option: "Only show my name and avatar"

- **Collaborators** (optional)
  - Invite by email
  - Set permissions:
    - Edit project
    - Manage community (respond to comments)
    - Coordinate fulfillment
    - Configure pledge manager
  - Remove collaborators
  - Show collaborator list on project page

- **Demographics** (optional, for anti-discrimination research)
  - Protected information, not shared with backers
  - Questionnaire about creator identity

#### Step 5: Payment
- **Contact Email** (required, verified)
- **Project Type** dropdown:
  - Individual (raising funds in own name)
  - Business/Nonprofit (raising on behalf of entity)
- **Tax Considerations** link and information

- **Payment Processor Selection** (required)
  - **Toggle: Stripe vs Divinity Coin**
  - **Payment Method Preference**:
    - ☐ "Accept traditional payments (credit/debit cards) via Stripe"
    - ☐ "Accept cryptocurrency payments via Divinity Coin"
    - Creators can enable one or both payment methods

  - **Stripe Option** (Traditional Payments):
    - "Recommended for most projects"
    - Lower fees (2.9% + $0.30)
    - Faster payouts
    - Accepts credit/debit cards
    - Better for mainstream audience
    - "Connect Stripe Account" button

  - **Divinity Coin Option** (Cryptocurrency Payments):
    - "Accept crypto from global backers"
    - Low fees (~1% network fee)
    - No chargebacks
    - Borderless payments
    - Accepts DCN, BTC, ETH, and other cryptocurrencies
    - "Connect Divinity Wallet" button

  - **Fee Comparison Display**:
    - Shows estimated fees based on funding goal
    - Side-by-side comparison
    - Net amount after fees

- **Bank Account** (required before launch)
  - Must be US-based checking account
  - Must be registered to individual/business raising funds
  - Account nickname
  - Routing number
  - Account number
  - Warning: "Cannot be changed after submission"

- **Payment Source Configuration** (based on selection):
  
  **If Stripe Selected**:
  - Stripe Connect onboarding flow
  - Verify identity automatically
  - Link bank account
  - Set payout schedule
  - Tax information collection
  
  **If Divinity Coin Selected**:
  - Divinity Coin wallet address
  - API key from Divinity Coin developer portal
  - Webhook secret for payment notifications
  - Supported cryptocurrencies selection (DCN, BTC, ETH, etc.)
  - Auto-conversion preference (convert to stablecoin or keep as crypto)

- **Project Verification** (required for business/nonprofit)
  - Redirects to verification service
  - Provides age, location, tax info, entity details
  - Name change facilitation available for certain life events

#### Step 6: Promotion
- **Project URL** (auto-generated from title, editable)
  - Format: `platform.com/projects/[creator-slug]/[project-slug]`
  - Cannot be changed after launch
  
- **Pre-launch Page** (optional)
  - Title, subtitle, image from Basics auto-populate
  - "More about this project" text area
  - Activation button: "Activate my page"
  - Shows preview
  - Can share before launch to build followers

- **Custom Referral Tags** (optional)
  - Create trackable URLs for marketing campaigns
  - Example: `?ref=newsletter` or `?ref=instagram-story`
  - Input field: "Insert label..."
  - Generate tag button
  - Shows list of created tags

- **Google Analytics** (optional)
  - Tracking ID input field (format: G-XXXXXXXXXX)
  - API secret input field
  - Info about insights: visitors, conversion rates, referrer sources

- **Meta Pixel** (optional, formerly Facebook Pixel)
  - Pixel ID input field (15-16 digit number)
  - Info about Facebook/Instagram ad effectiveness tracking

- **Meta Conversions API Access Token** (optional)
  - Access token input field
  - Enhanced event tracking connection
  - More reliable events connection with Meta

---

### 3. Project Dashboard (Post-Launch)

Once project is live, creators see comprehensive dashboard:

#### Overview Tab
- **Key Metrics** (top cards)
  - Total pledged ($X,XXX)
  - Funding percentage (XXX%)
  - Number of backers (XXX)
  - Days remaining (XX)

- **Funding Progress Chart**
  - Line/area chart showing daily funding progress
  - X-axis: Date
  - Y-axis: Amount pledged
  - Shows funding goal line
  - Hover tooltips with exact amounts

- **Pledges Breakdown**
  - Pie chart showing pledge sources:
    - Via Kickstarter (direct)
    - Via external referrers
    - Via custom referral tags (if any)
  - Average pledge amount
  - Percentage breakdown

- **Backer Source Table**
  - Referrer name
  - Type (Kickstarter/External)
  - Number of pledges
  - Percentage of pledges
  - Total amount pledged
  - Sortable columns
  - Search/filter functionality

#### Activity Tab
- Real-time activity feed
- Filter options:
  - Everything (default)
  - Pledges
  - Adjustments (increases/decreases)
  - Comments
- Each activity item shows:
  - Backer name (or "Someone" if anonymous)
  - Action (pledged $X, increased pledge, canceled, etc.)
  - Reward tier selected
  - Time ago
  - Link to backer info (for creator)

#### Project Followers
- Count of followers (people who clicked "Remind me")
- Pre-launch followers (visited pre-launch page)
- Post-launch followers (visited live project)
- Conversion rates (followers → backers)

#### Project Video Plays
- Total video plays
- Percentage of plays completed
- Pie chart: Kickstarter vs Off-site plays
- Hourly/daily breakdown

#### Reward Popularity
- Bar chart showing backers per reward tier
- Total pledged per tier
- Average pledge per tier
- Most popular reward highlighted

#### Google Analytics Data (if connected)
- Embedded analytics or summary stats
- Top referrer sources
- Visitor demographics
- Conversion funnel

#### Meta Pixel Data (if connected)
- Ad campaign performance
- Custom conversion tracking
- Audience insights

---

### 4. Backer Survey

After project is funded, creators can send survey to backers:

- **Purpose**: Collect addresses for physical rewards, SKU preferences, custom questions
- **Survey Builder**:
  - Address collection (required for physical rewards)
  - Custom questions (text, multiple choice, dropdown)
  - SKU/variant selection (e.g., size, color)
- **Send survey** button
- **Response tracking**:
  - Number of responses received
  - Export responses as CSV
- **Survey reminder emails** (automated)
- **Lock addresses** feature (once fulfillment begins)

---

### 5. Backer Report

**Privacy-Focused Feature**

Before accessing backer report, creators must agree to privacy terms:

- **Respect Backer Privacy Checklist** (modal):
  - ☐ Information provided for limited purpose of fulfillment
  - ☐ All backer information is highly confidential and sensitive
  - ☐ I will only use this information to redeem proof of pledge and fulfill rewards
  - ☐ I will only share with collaborators when absolutely necessary for fulfillment
  - ☐ I will never download or view proof of pledge report on shared computer
  - ☐ I will delete any downloaded information once all rewards are fulfilled
  - "Continue" button (disabled until all checked)

**Backer Report Contents**:
- Export as CSV
- Columns:
  - Backer Name
  - Backer Email
  - Pledge Amount
  - Reward Selected
  - Add-ons Selected (if any)
  - Shipping Address (from survey)
  - Survey Responses
  - Pledge Date
  - Backer Number (sequential)
  - Backer ID (unique)

---

### 6. Advanced Analytics (Beta)

**Powerful data visualization dashboard**

#### Important Notes Display:
- "Data may not always line up exactly with regular creator dashboard or tools like Google Analytics"
- "Data does not provide up-to-the-minute stats"
- "You can download data using menu option in top right corner"
- "Dashboard only available while campaign is live (access lost after campaign ends)"

#### Pledge Data
- **Daily Pledged** chart
  - Bar chart: Backings (count) vs Total Amount
  - Line overlay: Total pledged (cumulative)
  - Date range selector

- **Hourly Pledged (UTC)** chart
  - Bar chart showing pledge activity by hour
  - Useful for timing updates/announcements
  - Shows peak hours

#### Channels and Referrers
- **Explanation**:
  - "Referrers are where backers came from before pledging"
  - "We credit only the first source we know about"
  - "Data may differ from Facebook Ads Manager or Google Analytics"

- **Backings by Channel** pie chart
  - Desktop Web
  - Android Phone/App
  - Mobile Web iOS
  - iOS App
  - iPad App
  - Percentages shown

- **Backings by Channel & Tier** table
  - Rows: Channels
  - Columns: Pledge tiers (< $2, $2-$5, $5-$25, $25-$100, etc.)
  - Shows distribution of pledge amounts by device/platform

- **Referrers** table (sortable, searchable)
  - Referrer code/label
  - Type (Kickstarter/External)
  - Number of backings
  - Percentage of total pledges
  - Total amount pledged
  - Pagination (20 per page)
  - Export option

- **Daily Pledged by Custom Ref Tag** chart (if tags created)
  - Line chart showing performance of each custom referral tag
  - Compare effectiveness of different marketing channels

---

### 7. Fulfillment

**Post-campaign reward delivery management**

#### Fulfillment Dashboard
- **Key Stats**:
  - Total backers: XXX
  - With rewards: XXX
  - No reward: X
- **Status message**: "This project is live. Displayed values can change."

#### Rewards & Fulfillment Summary
- **Collected for shipping**: $X,XXX (X.X% of funding total)
- Table showing each reward tier:
  - Reward name
  - Number of backers
  - Shipping costs collected
  - Fulfillment status

#### Integration: Easyship
- **Partnership promotion**:
  - "Plan for shipping with Easyship"
  - Benefits: Shipping credits, customer support, waived subscription fees
  - Compare courier rates, generate labels, track shipments
  - "Go to Easyship" button
  - "Learn more" link

#### Manage Fulfillment Status
- Link to external fulfillment tool or manual tracking
- Mark rewards as:
  - Not started
  - In progress
  - Shipped
  - Delivered
- Update backers on fulfillment progress

---

### 8. Updates

Creators can post updates to backers and followers:

#### Published Updates
- List view:
  - Title
  - Published date
  - Likes count
  - Comments count
- Click to view/edit
- Delete option

#### Drafts
- List of unpublished updates
- "You haven't saved any drafts" empty state
- Illustration: "Use this space as a journal to record your creative process"
- "Post a new update" button

#### Create Update
- **"+ Create update"** button (prominent, always visible)
- Update editor:
  - Title field
  - Rich text editor (same as project story)
  - Image uploads
  - Video embeds
- Visibility options:
  - Public (everyone can see)
  - Backers only
- Preview button
- Save as draft
- Publish button

#### Update Notifications
- Email to all backers/followers (based on visibility setting)
- In-app notifications
- Shows on project page

---

### 9. Messages

**Backer communication inbox**

- **Warning banner**: "Kickstarter does not endorse third-party services. Please report spam messages or unsolicited offers."
- "Read more about spam messaging" link

#### Inbox Interface
- Search messages (search bar)
- Filter dropdown: "All users"
- View dropdown: "Inbox"
- Message list:
  - Sender name + badge (e.g., "Backer")
  - Project name (if multiple projects)
  - Message preview
  - Date received
  - More options (⋮) button
- Click to open conversation thread

#### Conversation View
- Full message history
- Reply box
- Attach files option
- Send button
- Mark as spam/report

---

### 10. Payouts

**Payment history and disbursement tracking**

#### Payout Types:
1. **Campaign** - Initial payout after successful campaign
2. **Late Pledge** - From post-campaign late backers
3. **Pledge Manager** - From Pledge Manager transactions (if using)

#### Payouts Table
- Columns:
  - Payout # (sequential)
  - Payout Type
  - Amount
  - Sent date
- Sortable
- Filterable by type

#### Payout Details (click row)
- Breakdown of:
  - Gross pledged
  - Divinity Coin processing fees (if crypto)
  - Stripe processing fees (if fiat)
  - Platform fees
  - Net amount disbursed
- Bank account or wallet address sent to
- Transaction ID / Blockchain TX hash
- Status (Pending, Completed, Failed)

#### Payment Processor Integration Notes
- **Stripe Payouts**: Processed through Stripe Connect, 2-day settlement
- **Divinity Coin Payouts**: Direct blockchain transfer to creator's wallet
- Fees structure displayed for both processors
- No chargebacks on cryptocurrency payments

---

### 11. Collaborators

**Team management**

- **Description**: "If you're working with others, you can grant them permission to edit this project, communicate with backers, and coordinate reward fulfillment."

#### Add Collaborator
- "Add your first collaborator" or "Add another collaborator" button
- Modal:
  - Email field (required)
  - Title field (e.g., "Collaborator", "Co-creator")
  - Permissions checkboxes:
    - ☐ Edit project
    - ☐ Manage community (comments, messages)
    - ☐ Coordinate fulfillment
    - ☐ Configure pledge manager
  - "Send invitation" button

#### Collaborator List
- Shows:
  - Collaborator name
  - Avatar
  - Title
  - Permissions granted
  - Edit button (✏️)
  - Remove button (🗑️)

#### Collaborator Actions
- Edit permissions anytime
- Remove collaborator (confirmation required)
- Resend invitation (if not yet accepted)

---

## Recommendation Algorithm & Behavioral Tracking System

**CRITICAL FEATURE**: This is the core competitive advantage that drives traffic to creator projects

### Overview

Build an intelligent recommendation engine that:
- Tracks user behavior across the platform
- Learns preferences from browsing and backing history
- Suggests relevant projects on every page load
- Sends targeted email notifications
- Maximizes project visibility and funding success

### User Behavior Tracking

#### What to Track

**Browsing Behavior**:
- Projects viewed (with time spent)
- Categories browsed
- Searches performed
- Filters applied
- Rewards clicked
- Videos watched (% completion)
- Updates read
- Comments made
- Projects saved/bookmarked
- Projects shared
- External referrer sources

**Engagement Signals**:
- Mouse movements and hover duration
- Scroll depth on project pages
- Click patterns
- Time on page
- Return visits to same project
- Tab activity (active vs inactive)

**Backing History**:
- Projects backed
- Pledge amounts
- Reward tiers selected
- Add-ons purchased
- Projects created (if creator)
- Project categories backed
- Creator profiles followed

**Social Signals**:
- Projects liked/favorited
- Comments posted
- Updates liked
- Messages sent to creators
- Social shares (Facebook, Twitter, etc.)
- Email opens and clicks

#### Tracking Implementation

**Frontend Tracking**:
```typescript
// components/tracking/BehaviorTracker.tsx
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

export function BehaviorTracker() {
  const pathname = usePathname();
  
  useEffect(() => {
    // Track page views
    trackEvent('page_view', {
      path: pathname,
      timestamp: new Date().toISOString(),
      referrer: document.referrer,
    });
    
    // Track time on page
    const startTime = Date.now();
    return () => {
      const timeSpent = Date.now() - startTime;
      trackEvent('page_exit', {
        path: pathname,
        timeSpent,
      });
    };
  }, [pathname]);
  
  useEffect(() => {
    // Track scroll depth
    let maxScroll = 0;
    const handleScroll = () => {
      const scrollPercentage = 
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
      maxScroll = Math.max(maxScroll, scrollPercentage);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      trackEvent('scroll_depth', {
        path: pathname,
        maxDepth: maxScroll,
      });
    };
  }, [pathname]);
  
  return null;
}

// Track specific interactions
export function trackProjectView(projectId: string, category: string) {
  trackEvent('project_view', {
    projectId,
    category,
    timestamp: new Date().toISOString(),
  });
}

export function trackRewardClick(projectId: string, rewardId: string, amount: number) {
  trackEvent('reward_click', {
    projectId,
    rewardId,
    amount,
  });
}

export function trackVideoPlay(projectId: string, duration: number) {
  trackEvent('video_play', {
    projectId,
    duration,
  });
}

export function trackSearch(query: string, filters: any) {
  trackEvent('search', {
    query,
    filters,
  });
}
```

**Database Schema for Tracking**:
```prisma
model UserBehavior {
  id          String   @id @default(cuid())
  userId      String?  // Null for anonymous users
  sessionId   String   // Track anonymous sessions
  eventType   BehaviorEventType
  
  // Event data
  projectId   String?
  categoryId  String?
  rewardId    String?
  searchQuery String?
  
  // Context
  path        String
  referrer    String?
  userAgent   String?
  ipAddress   String?
  country     String?
  
  // Engagement metrics
  timeSpent   Int?     // Milliseconds
  scrollDepth Float?   // Percentage
  
  metadata    Json?    // Flexible for additional data
  
  timestamp   DateTime @default(now())
  
  user        User?    @relation(fields: [userId], references: [id])
  
  @@index([userId, eventType, timestamp])
  @@index([sessionId, timestamp])
  @@index([projectId, eventType])
  @@index([categoryId, timestamp])
}

enum BehaviorEventType {
  PAGE_VIEW
  PAGE_EXIT
  PROJECT_VIEW
  PROJECT_CLICK
  REWARD_CLICK
  VIDEO_PLAY
  VIDEO_COMPLETE
  SEARCH
  FILTER_APPLY
  PROJECT_SAVE
  PROJECT_SHARE
  COMMENT_POST
  PLEDGE_START
  PLEDGE_COMPLETE
  SCROLL_DEPTH
  HOVER
  CREATOR_VIEW
}

model UserPreference {
  id              String   @id @default(cuid())
  userId          String   @unique
  
  // Category preferences (weighted scores 0-1)
  categoryScores  Json     // { "comics": 0.85, "games": 0.62, ... }
  
  // Preferred pledge ranges
  minPledge       Float?
  maxPledge       Float?
  avgPledge       Float?
  
  // Creator preferences
  followedCreators String[]
  backedCreators   String[]
  
  // Content preferences
  prefersVideo     Boolean  @default(true)
  prefersLongForm  Boolean  @default(true)
  
  // Geographic preferences
  prefersLocal     Boolean  @default(false)
  preferredCountries String[]
  
  // Engagement level (0-100)
  engagementScore  Int      @default(50)
  
  // Last calculated
  lastUpdated      DateTime @updatedAt
  
  user             User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
}

model ProjectSimilarity {
  id              String   @id @default(cuid())
  projectId       String
  similarProjectId String
  similarityScore Float    // 0-1, higher = more similar
  reason          String   // "same_category", "same_creator", "similar_backers"
  
  project         Project  @relation("ProjectSimilarities", fields: [projectId], references: [id])
  similarProject  Project  @relation("SimilarProjects", fields: [similarProjectId], references: [id])
  
  createdAt       DateTime @default(now())
  
  @@unique([projectId, similarProjectId])
  @@index([projectId, similarityScore])
}
```

### Recommendation Algorithm

#### Algorithm Components

**1. Collaborative Filtering**
- Find users with similar backing history
- Recommend projects those users backed
- Weight by recency and success

**2. Content-Based Filtering**
- Analyze project attributes (category, tags, description)
- Match to user's preference profile
- Use TF-IDF for text similarity

**3. Popularity & Trending**
- Hot projects (high recent activity)
- Trending categories
- Social proof (high backer count)

**4. Creator-Based**
- Projects by creators user has backed before
- Projects by followed creators
- Similar creators (same niche)

**5. Hybrid Scoring**
- Combine all signals with weights
- Personalization factor (0-100%)
- Exploration factor (show new content)

#### Recommendation Engine Implementation

```typescript
// lib/recommendations/engine.ts

interface RecommendationContext {
  userId?: string;
  sessionId?: string;
  currentPage?: string;
  limit?: number;
  excludeProjectIds?: string[];
}

interface ScoredProject {
  projectId: string;
  score: number;
  reasons: string[];
  project: Project;
}

export class RecommendationEngine {
  /**
   * Main recommendation function
   * Called on every page load, homepage refresh, etc.
   */
  async getRecommendations(
    context: RecommendationContext
  ): Promise<ScoredProject[]> {
    const {
      userId,
      sessionId,
      limit = 12,
      excludeProjectIds = [],
    } = context;
    
    // Get user preferences
    const preferences = userId 
      ? await this.getUserPreferences(userId)
      : await this.getSessionPreferences(sessionId);
    
    // Run parallel scoring algorithms
    const [
      collaborativeScores,
      contentBasedScores,
      trendingScores,
      creatorBasedScores,
    ] = await Promise.all([
      this.collaborativeFiltering(preferences),
      this.contentBasedFiltering(preferences),
      this.getTrendingProjects(),
      this.creatorBasedRecommendations(userId),
    ]);
    
    // Combine scores with weights
    const combinedScores = this.combineScores({
      collaborative: { scores: collaborativeScores, weight: 0.35 },
      contentBased: { scores: contentBasedScores, weight: 0.25 },
      trending: { scores: trendingScores, weight: 0.20 },
      creatorBased: { scores: creatorBasedScores, weight: 0.20 },
    });
    
    // Apply diversity filter (don't show all same category)
    const diverseScores = this.applyDiversityFilter(combinedScores);
    
    // Filter out excluded projects
    const filtered = diverseScores.filter(
      s => !excludeProjectIds.includes(s.projectId)
    );
    
    // Sort by score and limit
    return filtered
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }
  
  /**
   * Collaborative filtering: "Users like you also backed..."
   */
  async collaborativeFiltering(
    preferences: UserPreference
  ): Promise<ScoredProject[]> {
    // Find similar users
    const similarUsers = await db.$queryRaw`
      SELECT 
        u2.id as userId,
        COUNT(*) as commonBacks,
        SUM(CASE WHEN p.status = 'LIVE' THEN 1 ELSE 0 END) as liveProjects
      FROM "User" u1
      JOIN "Pledge" pl1 ON u1.id = pl1."userId"
      JOIN "Pledge" pl2 ON pl1."projectId" = pl2."projectId"
      JOIN "User" u2 ON pl2."userId" = u2.id
      JOIN "Project" p ON pl1."projectId" = p.id
      WHERE u1.id = ${preferences.userId}
        AND u2.id != ${preferences.userId}
      GROUP BY u2.id
      HAVING COUNT(*) >= 2
      ORDER BY commonBacks DESC
      LIMIT 100
    `;
    
    // Get projects backed by similar users but not by this user
    const recommendedProjects = await db.project.findMany({
      where: {
        status: 'LIVE',
        pledges: {
          some: {
            userId: {
              in: similarUsers.map(u => u.userId),
            },
          },
          none: {
            userId: preferences.userId,
          },
        },
      },
      include: {
        _count: {
          select: { pledges: true },
        },
      },
      take: 50,
    });
    
    // Score based on how many similar users backed it
    return recommendedProjects.map(project => {
      const backersFromSimilarUsers = similarUsers.filter(u =>
        project.pledges.some(p => p.userId === u.userId)
      ).length;
      
      const score = (backersFromSimilarUsers / similarUsers.length) * 100;
      
      return {
        projectId: project.id,
        score,
        reasons: ['Backed by users with similar taste'],
        project,
      };
    });
  }
  
  /**
   * Content-based filtering: Match project attributes to preferences
   */
  async contentBasedFiltering(
    preferences: UserPreference
  ): Promise<ScoredProject[]> {
    const categoryScores = preferences.categoryScores as Record<string, number>;
    
    // Get active projects in preferred categories
    const projects = await db.project.findMany({
      where: {
        status: 'LIVE',
        category: {
          in: Object.keys(categoryScores),
        },
      },
      include: {
        creator: true,
        _count: {
          select: { pledges: true },
        },
      },
      take: 100,
    });
    
    // Score based on category preference + other factors
    return projects.map(project => {
      let score = 0;
      const reasons = [];
      
      // Category match (40% of score)
      const categoryScore = categoryScores[project.category] || 0;
      score += categoryScore * 40;
      if (categoryScore > 0.7) {
        reasons.push(`High interest in ${project.category}`);
      }
      
      // Funding progress (20% of score)
      const fundingPercent = (project.currentAmount / project.goalAmount) * 100;
      if (fundingPercent >= 50 && fundingPercent < 100) {
        score += 20;
        reasons.push('Nearly funded');
      }
      
      // Social proof (20% of score)
      const backerCount = project._count.pledges;
      if (backerCount > 100) {
        score += 20;
        reasons.push('Popular project');
      } else if (backerCount > 50) {
        score += 10;
      }
      
      // Time remaining (10% of score)
      const daysRemaining = this.getDaysRemaining(project.endDate);
      if (daysRemaining <= 7) {
        score += 10;
        reasons.push('Ending soon');
      }
      
      // New project bonus (10% of score)
      const projectAge = Date.now() - project.launchedAt.getTime();
      const daysOld = projectAge / (1000 * 60 * 60 * 24);
      if (daysOld <= 3) {
        score += 10;
        reasons.push('Just launched');
      }
      
      return {
        projectId: project.id,
        score,
        reasons,
        project,
      };
    });
  }
  
  /**
   * Trending projects: Hot right now
   */
  async getTrendingProjects(): Promise<ScoredProject[]> {
    // Projects with high recent activity (last 24-48 hours)
    const recentActivity = await db.analyticsEvent.groupBy({
      by: ['projectId'],
      where: {
        timestamp: {
          gte: new Date(Date.now() - 48 * 60 * 60 * 1000),
        },
        eventType: {
          in: ['PAGE_VIEW', 'PROJECT_VIEW', 'PLEDGE_COMPLETE'],
        },
      },
      _count: {
        projectId: true,
      },
      orderBy: {
        _count: {
          projectId: 'desc',
        },
      },
      take: 50,
    });
    
    const projectIds = recentActivity.map(a => a.projectId);
    const projects = await db.project.findMany({
      where: {
        id: { in: projectIds },
        status: 'LIVE',
      },
      include: {
        _count: {
          select: { pledges: true },
        },
      },
    });
    
    return projects.map(project => {
      const activity = recentActivity.find(a => a.projectId === project.id);
      const activityScore = activity?._count.projectId || 0;
      
      return {
        projectId: project.id,
        score: Math.min(activityScore / 10, 100), // Normalize to 0-100
        reasons: ['Trending right now', 'High activity'],
        project,
      };
    });
  }
  
  /**
   * Creator-based: Projects by creators user has backed or followed
   */
  async creatorBasedRecommendations(
    userId?: string
  ): Promise<ScoredProject[]> {
    if (!userId) return [];
    
    // Get creators user has backed before
    const backedCreators = await db.pledge.findMany({
      where: { userId, status: 'COMPLETED' },
      select: {
        project: {
          select: { creatorId: true },
        },
      },
      distinct: ['projectId'],
    });
    
    const creatorIds = [
      ...new Set(backedCreators.map(p => p.project.creatorId)),
    ];
    
    // Get new projects by these creators
    const projects = await db.project.findMany({
      where: {
        creatorId: { in: creatorIds },
        status: 'LIVE',
        pledges: {
          none: { userId }, // User hasn't backed yet
        },
      },
      include: {
        creator: true,
      },
      take: 20,
    });
    
    return projects.map(project => ({
      projectId: project.id,
      score: 100, // High confidence - user backed this creator before
      reasons: [
        `New project by ${project.creator.name}`,
        "You've backed their projects before",
      ],
      project,
    }));
  }
  
  /**
   * Combine multiple scoring algorithms with weights
   */
  combineScores(
    algorithms: Record<string, { scores: ScoredProject[]; weight: number }>
  ): ScoredProject[] {
    const projectScores = new Map<string, {
      totalScore: number;
      reasons: Set<string>;
      project: Project;
    }>();
    
    // Aggregate scores from all algorithms
    for (const [name, { scores, weight }] of Object.entries(algorithms)) {
      for (const scored of scores) {
        const existing = projectScores.get(scored.projectId);
        
        if (existing) {
          existing.totalScore += scored.score * weight;
          scored.reasons.forEach(r => existing.reasons.add(r));
        } else {
          projectScores.set(scored.projectId, {
            totalScore: scored.score * weight,
            reasons: new Set(scored.reasons),
            project: scored.project,
          });
        }
      }
    }
    
    // Convert back to array
    return Array.from(projectScores.entries()).map(([projectId, data]) => ({
      projectId,
      score: data.totalScore,
      reasons: Array.from(data.reasons),
      project: data.project,
    }));
  }
  
  /**
   * Apply diversity filter to avoid showing too many projects from same category
   */
  applyDiversityFilter(projects: ScoredProject[]): ScoredProject[] {
    const categoryCounts = new Map<string, number>();
    const maxPerCategory = 3;
    
    return projects.filter(project => {
      const category = project.project.category;
      const count = categoryCounts.get(category) || 0;
      
      if (count >= maxPerCategory) {
        return false;
      }
      
      categoryCounts.set(category, count + 1);
      return true;
    });
  }
  
  /**
   * Get or build user preferences from behavior
   */
  async getUserPreferences(userId: string): Promise<UserPreference> {
    let preferences = await db.userPreference.findUnique({
      where: { userId },
    });
    
    if (!preferences || this.isStale(preferences.lastUpdated)) {
      preferences = await this.buildUserPreferences(userId);
    }
    
    return preferences;
  }
  
  /**
   * Build user preferences from behavior history
   */
  async buildUserPreferences(userId: string): Promise<UserPreference> {
    // Get user's backing history
    const pledges = await db.pledge.findMany({
      where: { userId, status: 'COMPLETED' },
      include: {
        project: true,
        reward: true,
      },
    });
    
    // Get user's browsing history
    const behavior = await db.userBehavior.findMany({
      where: {
        userId,
        timestamp: {
          gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000), // Last 90 days
        },
      },
      include: {
        project: true,
      },
    });
    
    // Calculate category scores
    const categoryScores: Record<string, number> = {};
    const categoryViews: Record<string, number> = {};
    const categoryBacks: Record<string, number> = {};
    
    // Weight backs heavily
    for (const pledge of pledges) {
      const category = pledge.project.category;
      categoryBacks[category] = (categoryBacks[category] || 0) + 1;
    }
    
    // Weight views moderately
    for (const event of behavior) {
      if (event.eventType === 'PROJECT_VIEW' && event.project) {
        const category = event.project.category;
        categoryViews[category] = (categoryViews[category] || 0) + 1;
      }
    }
    
    // Combine into scores (0-1 scale)
    const allCategories = new Set([
      ...Object.keys(categoryBacks),
      ...Object.keys(categoryViews),
    ]);
    
    const maxBacks = Math.max(...Object.values(categoryBacks), 1);
    const maxViews = Math.max(...Object.values(categoryViews), 1);
    
    for (const category of allCategories) {
      const backScore = (categoryBacks[category] || 0) / maxBacks;
      const viewScore = (categoryViews[category] || 0) / maxViews;
      
      // Weighted combination (backs = 70%, views = 30%)
      categoryScores[category] = (backScore * 0.7) + (viewScore * 0.3);
    }
    
    // Calculate average pledge amount
    const pledgeAmounts = pledges.map(p => p.amount);
    const avgPledge = pledgeAmounts.length
      ? pledgeAmounts.reduce((a, b) => a + b, 0) / pledgeAmounts.length
      : null;
    
    // Calculate engagement score
    const recentBehaviorCount = behavior.filter(
      b => b.timestamp > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    ).length;
    const engagementScore = Math.min(recentBehaviorCount * 2, 100);
    
    // Get followed/backed creators
    const backedCreators = [...new Set(pledges.map(p => p.project.creatorId))];
    
    // Upsert preferences
    return db.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        categoryScores,
        avgPledge,
        engagementScore,
        backedCreators,
      },
      update: {
        categoryScores,
        avgPledge,
        engagementScore,
        backedCreators,
        lastUpdated: new Date(),
      },
    });
  }
  
  /**
   * Get preferences for anonymous session
   */
  async getSessionPreferences(sessionId?: string): Promise<Partial<UserPreference>> {
    if (!sessionId) {
      // Return default preferences for first-time visitors
      return {
        categoryScores: {},
        engagementScore: 50,
      };
    }
    
    // Get behavior for this session
    const behavior = await db.userBehavior.findMany({
      where: { sessionId },
      include: { project: true },
    });
    
    // Build lightweight preferences from session
    const categoryViews: Record<string, number> = {};
    
    for (const event of behavior) {
      if (event.project) {
        const category = event.project.category;
        categoryViews[category] = (categoryViews[category] || 0) + 1;
      }
    }
    
    const maxViews = Math.max(...Object.values(categoryViews), 1);
    const categoryScores: Record<string, number> = {};
    
    for (const [category, views] of Object.entries(categoryViews)) {
      categoryScores[category] = views / maxViews;
    }
    
    return {
      categoryScores,
      engagementScore: Math.min(behavior.length * 5, 100),
    };
  }
  
  isStale(lastUpdated: Date): boolean {
    // Preferences are stale if older than 24 hours
    return Date.now() - lastUpdated.getTime() > 24 * 60 * 60 * 1000;
  }
  
  getDaysRemaining(endDate: Date): number {
    return Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  }
}

// Singleton instance
export const recommendationEngine = new RecommendationEngine();
```

### Dynamic Homepage Implementation

```typescript
// app/page.tsx - Homepage with personalized recommendations

import { RecommendationEngine } from '@/lib/recommendations/engine';
import { ProjectGrid } from '@/components/project/ProjectGrid';
import { getCurrentUser } from '@/lib/auth';
import { cookies } from 'next/headers';

export default async function HomePage() {
  const user = await getCurrentUser();
  const sessionId = cookies().get('sessionId')?.value;
  
  // Get personalized recommendations
  const recommendations = await recommendationEngine.getRecommendations({
    userId: user?.id,
    sessionId,
    limit: 12,
  });
  
  // Get trending projects (for non-personalized section)
  const trending = await recommendationEngine.getTrendingProjects();
  
  return (
    <div className="container mx-auto px-4 py-8">
      {user && (
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-4">
            Recommended for You
          </h2>
          <ProjectGrid projects={recommendations.map(r => r.project)} />
          <div className="mt-4 text-sm text-gray-500">
            Based on your interests and backing history
          </div>
        </section>
      )}
      
      <section className="mb-12">
        <h2 className="text-2xl font-bold mb-4">
          Trending Now
        </h2>
        <ProjectGrid projects={trending.slice(0, 6).map(t => t.project)} />
      </section>
      
      {/* More sections... */}
    </div>
  );
}

// Auto-refresh recommendations on page navigation
// app/layout.tsx
'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { trackEvent } from '@/lib/analytics';

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  useEffect(() => {
    // Track navigation
    trackEvent('page_view', {
      path: pathname,
      timestamp: new Date().toISOString(),
    });
    
    // Refresh recommendations on major navigation
    if (pathname === '/' || pathname === '/discover') {
      fetch('/api/recommendations/refresh', {
        method: 'POST',
      });
    }
  }, [pathname]);
  
  return <>{children}</>;
}
```

### Email Notification System

#### Types of Emails

**1. Personalized Project Discovery**
- Sent: Weekly or bi-weekly
- Content: "Projects we think you'll love"
- Based on: User preferences, browsing history
- Includes: 4-6 recommended projects with reasons

**2. Creator Launch Notifications**
- Sent: When creator user backed before launches new project
- Content: "[Creator Name] just launched a new project!"
- Includes: Project details, early bird rewards

**3. Similar Project Alerts**
- Sent: When new project launches in user's favorite category
- Content: "New in [Category]"
- Frequency: Max 2 per week

**4. Ending Soon**
- Sent: 48 hours before project ends
- Content: "Last chance to back [Project]"
- Only if: User viewed project but didn't back

**5. Successfully Funded**
- Sent: When project user backed reaches goal
- Content: "We did it! [Project] is funded!"
- Includes: Celebration message, what's next

**6. Funding Milestone**
- Sent: When project user backed hits 50%, 75%, 100%, 200%
- Content: "[Project] is [X%] funded!"

**7. New Update from Backed Project**
- Sent: When creator posts update
- Content: "[Creator] posted an update"
- Frequency: Immediate for backers

**8. Backer Survey Reminder**
- Sent: If user hasn't completed survey
- Content: "Complete your survey for [Project]"
- Frequency: Weekly until completed

#### Email System Implementation

```typescript
// lib/email/notification-engine.ts

import { Resend } from 'resend';
import { RecommendationEngine } from '@/lib/recommendations/engine';

const resend = new Resend(process.env.RESEND_API_KEY);

export class EmailNotificationEngine {
  /**
   * Send weekly personalized discovery email
   */
  async sendWeeklyDiscovery(userId: string) {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: { preferences: true },
    });
    
    if (!user) return;
    
    // Check user's email preferences
    if (!user.emailPreferences?.weeklyDiscovery) return;
    
    // Get personalized recommendations
    const recommendations = await recommendationEngine.getRecommendations({
      userId,
      limit: 6,
    });
    
    // Send email
    await resend.emails.send({
      from: 'Discover <discover@yourplatform.com>',
      to: user.email,
      subject: 'Projects we think you\'ll love',
      react: WeeklyDiscoveryEmail({
        userName: user.name,
        projects: recommendations.map(r => ({
          project: r.project,
          reasons: r.reasons,
        })),
      }),
    });
    
    // Track email sent
    await db.emailLog.create({
      data: {
        userId,
        type: 'WEEKLY_DISCOVERY',
        sentAt: new Date(),
      },
    });
  }
  
  /**
   * Send creator launch notification
   */
  async sendCreatorLaunchNotification(
    projectId: string,
    creatorId: string
  ) {
    // Find all users who backed this creator before
    const previousBackers = await db.pledge.findMany({
      where: {
        project: { creatorId },
        status: 'COMPLETED',
      },
      select: {
        userId: true,
        user: true,
      },
      distinct: ['userId'],
    });
    
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { creator: true },
    });
    
    if (!project) return;
    
    // Send to each previous backer
    for (const { user } of previousBackers) {
      if (!user.emailPreferences?.creatorLaunches) continue;
      
      await resend.emails.send({
        from: 'Launches <launches@yourplatform.com>',
        to: user.email,
        subject: `${project.creator.name} just launched a new project!`,
        react: CreatorLaunchEmail({
          userName: user.name,
          creatorName: project.creator.name,
          project,
        }),
      });
      
      // Track
      await db.emailLog.create({
        data: {
          userId: user.id,
          projectId,
          type: 'CREATOR_LAUNCH',
          sentAt: new Date(),
        },
      });
    }
  }
  
  /**
   * Send similar project alert
   */
  async sendSimilarProjectAlert(projectId: string) {
    const project = await db.project.findUnique({
      where: { id: projectId },
      include: { creator: true },
    });
    
    if (!project) return;
    
    // Find users interested in this category
    const interestedUsers = await db.userPreference.findMany({
      where: {
        categoryScores: {
          path: [project.category],
          gte: 0.6, // High interest threshold
        },
      },
      include: { user: true },
    });
    
    // Send to interested users (batch by 100)
    for (const { user } of interestedUsers) {
      if (!user.emailPreferences?.categoryAlerts) continue;
      
      // Check if user already backed this project
      const alreadyBacked = await db.pledge.findFirst({
        where: { userId: user.id, projectId },
      });
      
      if (alreadyBacked) continue;
      
      // Check email frequency (max 2 per week)
      const recentEmails = await db.emailLog.count({
        where: {
          userId: user.id,
          type: 'CATEGORY_ALERT',
          sentAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      });
      
      if (recentEmails >= 2) continue;
      
      await resend.emails.send({
        from: 'New Projects <new@yourplatform.com>',
        to: user.email,
        subject: `New in ${project.category}`,
        react: CategoryAlertEmail({
          userName: user.name,
          category: project.category,
          project,
        }),
      });
      
      await db.emailLog.create({
        data: {
          userId: user.id,
          projectId,
          type: 'CATEGORY_ALERT',
          sentAt: new Date(),
        },
      });
    }
  }
  
  /**
   * Send "ending soon" reminder
   */
  async sendEndingSoonReminders() {
    // Find projects ending in 48 hours
    const endingSoon = await db.project.findMany({
      where: {
        status: 'LIVE',
        endDate: {
          gte: new Date(Date.now() + 47 * 60 * 60 * 1000),
          lte: new Date(Date.now() + 49 * 60 * 60 * 1000),
        },
      },
    });
    
    for (const project of endingSoon) {
      // Find users who viewed but didn't back
      const viewers = await db.userBehavior.findMany({
        where: {
          projectId: project.id,
          eventType: 'PROJECT_VIEW',
          userId: { not: null },
        },
        select: { userId: true },
        distinct: ['userId'],
      });
      
      for (const { userId } of viewers) {
        if (!userId) continue;
        
        // Check if user backed
        const backed = await db.pledge.findFirst({
          where: { userId, projectId: project.id },
        });
        
        if (backed) continue;
        
        const user = await db.user.findUnique({ where: { id: userId } });
        if (!user?.emailPreferences?.endingSoon) continue;
        
        await resend.emails.send({
          from: 'Reminders <reminders@yourplatform.com>',
          to: user.email,
          subject: `Last chance to back ${project.title}`,
          react: EndingSoonEmail({
            userName: user.name,
            project,
            hoursLeft: 48,
          }),
        });
        
        await db.emailLog.create({
          data: {
            userId,
            projectId: project.id,
            type: 'ENDING_SOON',
            sentAt: new Date(),
          },
        });
      }
    }
  }
}

// Singleton instance
export const emailNotificationEngine = new EmailNotificationEngine();
```

#### Email Templates (React Email)

```tsx
// emails/WeeklyDiscovery.tsx
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Link,
  Img,
} from '@react-email/components';

interface WeeklyDiscoveryEmailProps {
  userName?: string;
  projects: Array<{
    project: Project;
    reasons: string[];
  }>;
}

export function WeeklyDiscoveryEmail({
  userName,
  projects,
}: WeeklyDiscoveryEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={main}>
        <Container style={container}>
          <Text style={heading}>
            Hi {userName}, here are some projects we think you'll love
          </Text>
          
          {projects.map(({ project, reasons }) => (
            <Section key={project.id} style={projectCard}>
              <Img
                src={project.imageUrl}
                alt={project.title}
                width="100%"
                style={projectImage}
              />
              <Text style={projectTitle}>{project.title}</Text>
              <Text style={projectDescription}>
                {project.subtitle}
              </Text>
              <Text style={reasons}>
                {reasons.join(' • ')}
              </Text>
              <Link href={`https://yourplatform.com/projects/${project.slug}`} style={button}>
                View Project
              </Link>
            </Section>
          ))}
          
          <Text style={footer}>
            Don't want these emails?{' '}
            <Link href="https://yourplatform.com/settings/notifications">
              Manage preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// Styles...
const main = { backgroundColor: '#f6f9fc', fontFamily: 'Arial, sans-serif' };
const container = { margin: '0 auto', padding: '20px' };
// ... more styles
```

#### Cron Jobs for Automated Emails

```typescript
// app/api/cron/send-emails/route.ts

import { emailNotificationEngine } from '@/lib/email/notification-engine';

export async function GET(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  
  const tasks = [
    // Weekly discovery (Sundays at 9 AM)
    async () => {
      const users = await db.user.findMany({
        where: {
          emailPreferences: {
            path: ['weeklyDiscovery'],
            equals: true,
          },
        },
      });
      
      for (const user of users) {
        await emailNotificationEngine.sendWeeklyDiscovery(user.id);
      }
    },
    
    // Ending soon reminders (Daily at 10 AM)
    async () => {
      await emailNotificationEngine.sendEndingSoonReminders();
    },
    
    // Add more tasks...
  ];
  
  await Promise.all(tasks.map(task => task()));
  
  return Response.json({ success: true });
}
```

```yaml
# vercel.json - Configure cron jobs
{
  "crons": [
    {
      "path": "/api/cron/weekly-discovery",
      "schedule": "0 9 * * 0"
    },
    {
      "path": "/api/cron/ending-soon",
      "schedule": "0 10 * * *"
    },
    {
      "path": "/api/cron/rebuild-preferences",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/similar-project-alerts",
      "schedule": "0 11 * * *"
    },
    {
      "path": "/api/cron/creator-launches",
      "schedule": "*/30 * * * *"
    },
    {
      "path": "/api/cron/rebuild-project-similarities",
      "schedule": "0 3 * * *"
    }
  ]
}
```

### Performance Optimization

**Caching Strategy**:
```typescript
// Cache recommendations for 5 minutes
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_URL,
  token: process.env.UPSTASH_REDIS_TOKEN,
});

async function getCachedRecommendations(userId: string) {
  const cacheKey = `recommendations:${userId}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached);
  }
  
  const fresh = await recommendationEngine.getRecommendations({ userId });
  await redis.setex(cacheKey, 300, JSON.stringify(fresh)); // 5 min TTL
  
  return fresh;
}
```

**Background Processing**:
```typescript
// Use background jobs for heavy computations
import { Queue } from 'bullmq';

const recommendationQueue = new Queue('recommendations');

// Queue preference rebuild
await recommendationQueue.add('rebuild-preferences', {
  userId: user.id,
});

// Worker processes these jobs
const worker = new Worker('recommendations', async (job) => {
  if (job.name === 'rebuild-preferences') {
    await recommendationEngine.buildUserPreferences(job.data.userId);
  }
});
```

---

## Payment Processing: Stripe + DivinityCoin

### Overview

The platform accepts payments through two methods:
- **Stripe**: Traditional fiat payments (credit/debit cards) - direct checkout
- **DivinityCoin**: Credit-based universal creator currency system

Both payment methods ultimately settle to creators via **Stripe Connect**.

### How DivinityCoin Works

DivinityCoin is a **universal creator credit system** (not a cryptocurrency). The complete money flow:

```
  USER                DIVINITYCOIN           PLATFORM              CREATOR
   │                        │                    │                    │
   │  1. Buys $100 credits  │                    │                    │
   │───────────────────────►│                    │                    │
   │                        │                    │                    │
   │   (Stripe processes)   │                    │                    │
   │                        │  Funds held        │                    │
   │                        │                    │                    │
   │  2. Redeems code       │                    │                    │
   │────────────────────────┼───────────────────►│                    │
   │                        │   (validates)      │                    │
   │                        │◄──────────────────►│                    │
   │                        │                    │                    │
   │  3. Backs project      │                    │                    │
   │────────────────────────┼───────────────────►│                    │
   │                        │   (hold placed)    │                    │
   │                        │◄──────────────────►│                    │
   │                        │                    │                    │
   │                        │                    │  4. Project funds  │
   │                        │   (capture hold)   │                    │
   │                        │◄──────────────────►│                    │
   │                        │                    │  Creator earned    │
   │                        │                    │  $100 in credits   │
   │                        │                    │──────────────────►│
   │                        │                    │                    │
   │                        │  5. Settlement     │                    │
   │                        │  (weekly/monthly)  │                    │
   │                        │───────────────────►│                    │
   │                        │  Wire $94 (net)    │                    │
   │                        │  (after 6% fee)    │                    │
   │                        │                    │                    │
   │                        │                    │  6. Creator payout │
   │                        │                    │  (Stripe Connect)  │
   │                        │                    │───────────────────►│
   │                        │                    │  $89.30            │
   │                        │                    │  (after 5% fee)    │
```

### Fee Structure

| Stage | Fee | Who Pays | Example ($100) |
|-------|-----|----------|----------------|
| DivinityCoin Partner Fee | 6% | Platform (from settlement) | $6.00 |
| └ Stripe Processing | ~2.9% + $0.30 | (included in 6%) | ~$3.20 |
| └ Platform Fee | ~2.8% | (included in 6%) | ~$2.80 |
| Platform Fee on Earnings | 5% | Creator | $94 × 5% = $4.70 |
| Stripe Connect Payout | ~0.25% | Creator | ~$0.25 |
| **Creator Receives** | | | **~$89.05** |

### Payment Method Selection UI

```typescript
// Backer payment method selector during checkout
interface PaymentMethodSelectorProps {
  amount: number;
  userCreditBalance: number;
  onPayWithStripe: () => void;
  onPayWithCredits: () => void;
}

export function PaymentMethodSelector({
  amount,
  userCreditBalance,
  onPayWithStripe,
  onPayWithCredits,
}: PaymentMethodSelectorProps) {
  const hasEnoughCredits = userCreditBalance >= amount;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Choose Payment Method</h3>

      {/* DivinityCoin Credits Option */}
      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-medium">DivinityCoin Credits</h4>
            <p className="text-sm text-gray-600">
              Balance: ${userCreditBalance.toFixed(2)}
            </p>
          </div>
          <Button
            onClick={onPayWithCredits}
            disabled={!hasEnoughCredits}
          >
            {hasEnoughCredits ? 'Pay with Credits' : 'Insufficient Balance'}
          </Button>
        </div>
        {!hasEnoughCredits && (
          <a
            href="https://divinitycoin.com"
            target="_blank"
            className="text-sm text-blue-600 hover:underline"
          >
            Buy more credits at DivinityCoin.com
          </a>
        )}
      </div>

      {/* Credit Redemption */}
      <div className="border rounded-lg p-4">
        <h4 className="font-medium">Have a DivinityCoin code?</h4>
        <RedeemCodeForm onSuccess={() => window.location.reload()} />
      </div>

      {/* Stripe Option */}
      <div className="border rounded-lg p-4">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-medium">Credit/Debit Card</h4>
            <p className="text-sm text-gray-600">Pay directly via Stripe</p>
          </div>
          <Button onClick={onPayWithStripe}>
            Pay ${amount.toFixed(2)}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

### Stripe Integration

**Setup Flow**:
```typescript
// Stripe Connect onboarding
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

export async function createStripeConnectAccount(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  
  if (!user) throw new Error('User not found');
  
  // Create Connect account
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: user.email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
  });
  
  // Save account ID
  await db.user.update({
    where: { id: userId },
    data: {
      stripeAccountId: account.id,
    },
  });
  
  // Create account link for onboarding
  const accountLink = await stripe.accountLinks.create({
    account: account.id,
    refresh_url: `${process.env.NEXT_PUBLIC_BASE_URL}/settings/payment/stripe/refresh`,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL}/settings/payment/stripe/complete`,
    type: 'account_onboarding',
  });
  
  return accountLink.url;
}
```

**Payment Intent Creation**:
```typescript
// Create Stripe payment for pledge
export async function createStripePayment(pledgeData: {
  projectId: string;
  rewardId: string;
  addonIds: string[];
  amount: number;
  userId: string;
}) {
  const { projectId, amount, userId } = pledgeData;
  
  // Get project and creator's Stripe account
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      creator: true,
    },
  });
  
  if (!project?.creator.stripeAccountId) {
    throw new Error('Creator has not connected Stripe');
  }
  
  // Create pending pledge
  const pledge = await db.pledge.create({
    data: {
      ...pledgeData,
      status: 'PENDING',
    },
  });
  
  // Calculate platform fee (5%)
  const platformFee = Math.round(amount * 0.05 * 100); // In cents
  const amountInCents = Math.round(amount * 100);
  
  // Create Payment Intent
  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd',
    application_fee_amount: platformFee,
    transfer_data: {
      destination: project.creator.stripeAccountId,
    },
    metadata: {
      pledgeId: pledge.id,
      projectId,
      userId,
    },
  });
  
  return {
    clientSecret: paymentIntent.client_secret,
    pledgeId: pledge.id,
  };
}
```

**Webhook Handling**:
```typescript
// /api/webhooks/stripe
import { headers } from 'next/headers';
import { buffer } from 'stream/consumers';

export async function POST(req: Request) {
  const body = await req.text();
  const signature = headers().get('stripe-signature')!;
  
  let event: Stripe.Event;
  
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    return Response.json({ error: 'Invalid signature' }, { status: 400 });
  }
  
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;
    case 'payment_intent.payment_failed':
      await handlePaymentFailed(event.data.object);
      break;
    case 'charge.refunded':
      await handleRefund(event.data.object);
      break;
    case 'charge.dispute.created':
      await handleDispute(event.data.object);
      break;
  }
  
  return Response.json({ received: true });
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const pledgeId = paymentIntent.metadata.pledgeId;
  
  // Update pledge
  const pledge = await db.pledge.update({
    where: { id: pledgeId },
    data: {
      status: 'COMPLETED',
      stripePaymentIntentId: paymentIntent.id,
    },
    include: {
      project: true,
      user: true,
    },
  });
  
  // Update project funding
  await db.project.update({
    where: { id: pledge.projectId },
    data: {
      currentAmount: { increment: pledge.amount },
      backerCount: { increment: 1 },
    },
  });
  
  // Update reward quantity
  await db.reward.update({
    where: { id: pledge.rewardId },
    data: {
      quantityClaimed: { increment: 1 },
    },
  });
  
  // Send confirmation email
  await sendPledgeConfirmationEmail(pledge);
}
```

### DivinityCoin Integration

DivinityCoin is a credit-based payment system. Users buy credits on divinitycoin.com, receive a redemption code, and use credits on our platform.

**API Base URL**: `https://api.divinitycoin.com`
**Authentication**: `X-Internal-Key: YOUR_API_KEY` header

#### SDK Installation

```bash
# Node.js / JavaScript
npm install @divinitycoin/sdk

# Python
pip install divinitycoin

# PHP
composer require divinitycoin/sdk

# Ruby
gem install divinitycoin
```

#### API Endpoints

**1. Validate & Redeem Code** - `POST /internal/validate`
```typescript
// When user enters a DivinityCoin code
interface ValidateCodeRequest {
  code: string;           // 16-character code: "XXXX-XXXX-XXXX-XXXX"
  platformUserId: string; // Your platform's user ID
}

interface ValidateCodeResponse {
  success: boolean;
  amount: number;      // Credits added
  newBalance: number;  // User's new total balance
}

// Example
const response = await fetch('https://api.divinitycoin.com/internal/validate', {
  method: 'POST',
  headers: {
    'X-Internal-Key': process.env.DIVINITYCOIN_API_KEY!,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    code: 'ABCD-1234-EFGH-5678',
    platformUserId: user.id,
  }),
});

const { success, amount, newBalance } = await response.json();
// success: true, amount: 25.00, newBalance: 75.00
```

**2. Check Balance** - `POST /internal/balance`
```typescript
interface BalanceResponse {
  platformUserId: string;
  availableBalance: number;  // Credits available to spend
  heldBalance: number;       // Credits held for pending pledges
}

const balance = await fetch('https://api.divinitycoin.com/internal/balance', {
  method: 'POST',
  headers: { 'X-Internal-Key': process.env.DIVINITYCOIN_API_KEY! },
  body: JSON.stringify({ platformUserId: user.id }),
}).then(r => r.json());
// { availableBalance: 50.00, heldBalance: 10.00 }
```

**3. Place Hold** - `POST /internal/hold`
```typescript
// When user backs a project (before project is funded)
interface HoldRequest {
  platformUserId: string;
  amount: number;
  pledgeId: string;      // Your pledge/order ID
  projectId?: string;
  expiresAt?: string;    // ISO date for hold expiration
}

interface HoldResponse {
  success: boolean;
  holdId: string;
  amount: number;
  expiresAt: string;
}

const hold = await fetch('https://api.divinitycoin.com/internal/hold', {
  method: 'POST',
  headers: { 'X-Internal-Key': process.env.DIVINITYCOIN_API_KEY! },
  body: JSON.stringify({
    platformUserId: user.id,
    amount: 50.00,
    pledgeId: pledge.id,
    projectId: project.id,
  }),
}).then(r => r.json());
// { success: true, holdId: "hold_xyz789", amount: 25.00 }
```

**4. Capture Hold** - `POST /internal/capture`
```typescript
// When project is successfully funded - capture the held credits
interface CaptureRequest {
  pledgeId: string;
  creatorId: string;
  creatorEmail?: string;
  projectId?: string;
  projectName?: string;
}

interface CaptureResponse {
  success: boolean;
  capturedAmount: number;
  captureId: string;
}

const capture = await fetch('https://api.divinitycoin.com/internal/capture', {
  method: 'POST',
  headers: { 'X-Internal-Key': process.env.DIVINITYCOIN_API_KEY! },
  body: JSON.stringify({
    pledgeId: pledge.id,
    creatorId: project.creatorId,
    creatorEmail: project.creator.email,
    projectId: project.id,
    projectName: project.title,
  }),
}).then(r => r.json());
// { success: true, capturedAmount: 25.00, captureId: "cap_abc123" }
```

**5. Release Hold** - `POST /internal/release`
```typescript
// When project fails or pledge is cancelled - return credits to user
interface ReleaseResponse {
  success: boolean;
  releasedAmount: number;
  newAvailableBalance: number;
}

const release = await fetch('https://api.divinitycoin.com/internal/release', {
  method: 'POST',
  headers: { 'X-Internal-Key': process.env.DIVINITYCOIN_API_KEY! },
  body: JSON.stringify({ pledgeId: pledge.id }),
}).then(r => r.json());
// { success: true, releasedAmount: 25.00, newAvailableBalance: 75.00 }
```

**6. Health Check** - `GET /internal/health`
```typescript
// Verify API connectivity
const health = await fetch('https://api.divinitycoin.com/internal/health', {
  headers: { 'X-Internal-Key': process.env.DIVINITYCOIN_API_KEY! },
}).then(r => r.json());
// { status: "ok", timestamp: "2025-01-08T10:00:00Z" }
```

#### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| INVALID_CODE_FORMAT | 400 | Code is not 16 hex characters |
| CODE_NOT_FOUND | 404 | No gift card matches this code |
| ALREADY_REDEEMED | 409 | Code has already been used |
| CODE_EXPIRED | 410 | Code is past expiration date |
| CODE_REVOKED | 410 | Code was manually revoked |
| RATE_LIMITED | 429 | Too many redemption attempts |
| INSUFFICIENT_BALANCE | 400 | Not enough credits for operation |
| HOLD_NOT_FOUND | 404 | No hold exists for this pledge |
| HOLD_NOT_ACTIVE | 400 | Hold is not in active state |
| INVALID_AMOUNT | 400 | Amount outside allowed range |

#### Settlement & Payouts

DivinityCoin settles with partners on a configurable schedule:
- **Daily**: Every day at 00:00 UTC
- **Weekly**: Every Monday at 00:00 UTC
- **Biweekly**: Every other Monday
- **Monthly**: 1st of month at 00:00 UTC

**List Settlements** - `GET /internal/settlements`
```typescript
const settlements = await fetch(
  'https://api.divinitycoin.com/internal/settlements?status=PAID&limit=20',
  { headers: { 'X-Internal-Key': process.env.DIVINITYCOIN_API_KEY! } }
).then(r => r.json());

// Response:
{
  "settlements": [
    {
      "id": "settle_abc123",
      "periodStart": "2025-01-01T00:00:00Z",
      "periodEnd": "2025-01-07T23:59:59Z",
      "grossAmount": 10000.00,
      "partnerFee": 600.00,    // 6% fee
      "netAmount": 9400.00,
      "currency": "USD",
      "captureCount": 47,
      "status": "PAID",
      "paidAt": "2025-01-10T14:30:00Z",
      "paymentRef": "WIRE-20250108-001"
    }
  ],
  "pagination": { "total": 52, "limit": 20, "offset": 0 }
}
```

#### Settlement Webhooks

Configure webhook URL in DivinityCoin partner dashboard to receive settlement events.

**Webhook Events**:
- `settlement.created` - New settlement generated
- `settlement.approved` - Settlement approved for payment
- `settlement.processing` - Payment initiated
- `settlement.paid` - Payment confirmed
- `settlement.failed` - Payment failed

**Webhook Payload**:
```typescript
{
  "event": "settlement.paid",
  "timestamp": "2025-01-10T14:30:00Z",
  "data": {
    "settlementId": "settle_abc123",
    "partnerId": "partner_xyz",
    "periodStart": "2025-01-01T00:00:00Z",
    "periodEnd": "2025-01-07T23:59:59Z",
    "grossAmount": 10000.00,
    "partnerFee": 600.00,
    "netAmount": 9400.00,
    "captureCount": 47,
    "currency": "USD",
    "status": "PAID",
    "paymentRef": "WIRE-20250108-001"
  }
}
// Signature header: X-Webhook-Signature: sha256=<hmac-sha256>
```

**Webhook Verification**:
```typescript
import crypto from 'crypto';

function verifyDivinityCoinWebhook(
  payload: string,
  signature: string,
  secret: string
): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expected)
  );
}

// Webhook handler
app.post('/api/webhooks/divinitycoin', async (req, res) => {
  const signature = req.headers['x-webhook-signature'] as string;
  const isValid = verifyDivinityCoinWebhook(
    JSON.stringify(req.body),
    signature,
    process.env.DIVINITYCOIN_WEBHOOK_SECRET!
  );

  if (!isValid) {
    return res.status(401).send('Invalid signature');
  }

  const { event, data } = req.body;

  switch (event) {
    case 'settlement.paid':
      // Update internal records, credit creator balances
      await handleSettlementPaid(data);
      break;
    case 'settlement.failed':
      // Alert admin, retry logic
      await handleSettlementFailed(data);
      break;
  }

  res.status(200).send('OK');
});
```

### Database Schema Updates

```prisma
// ============================================
// DIVINITYCOIN CREDITS & HOLDS
// ============================================

model UserCreditBalance {
  id                String   @id @default(cuid())
  userId            String   @unique
  availableBalance  Float    @default(0)
  heldBalance       Float    @default(0)
  lifetimeCredits   Float    @default(0)

  user              User     @relation(fields: [userId], references: [id])

  updatedAt         DateTime @updatedAt

  @@index([userId])
}

model CreditRedemption {
  id                String   @id @default(cuid())
  userId            String
  code              String   // Last 4 chars only for reference
  amount            Float
  redeemedAt        DateTime @default(now())

  user              User     @relation(fields: [userId], references: [id])

  @@index([userId])
}

model CreditHold {
  id                String   @id @default(cuid())
  divinityHoldId    String   @unique  // holdId from DivinityCoin API
  userId            String
  pledgeId          String   @unique
  amount            Float
  status            CreditHoldStatus @default(ACTIVE)
  expiresAt         DateTime?

  user              User     @relation(fields: [userId], references: [id])
  pledge            Pledge   @relation(fields: [pledgeId], references: [id])

  createdAt         DateTime @default(now())
  capturedAt        DateTime?
  releasedAt        DateTime?

  @@index([userId])
  @@index([pledgeId])
  @@index([status])
}

enum CreditHoldStatus {
  ACTIVE
  CAPTURED
  RELEASED
  EXPIRED
}

model CreditCapture {
  id                String   @id @default(cuid())
  divinityCaptureId String   @unique  // captureId from DivinityCoin API
  holdId            String
  creatorId         String
  projectId         String
  amount            Float
  settlementId      String?  // Linked when settled

  capturedAt        DateTime @default(now())
  settledAt         DateTime?

  @@index([creatorId])
  @@index([projectId])
  @@index([settlementId])
}

// ============================================
// SETTLEMENTS
// ============================================

model PartnerSettlement {
  id                String   @id @default(cuid())
  divinitySettlementId String @unique
  periodStart       DateTime
  periodEnd         DateTime
  grossAmount       Float
  partnerFee        Float    // 6% DivinityCoin fee
  netAmount         Float
  captureCount      Int
  status            SettlementStatus
  paymentRef        String?  // Wire transfer reference
  paidAt            DateTime?

  createdAt         DateTime @default(now())

  @@index([status])
  @@index([periodEnd])
}

enum SettlementStatus {
  PENDING
  APPROVED
  PROCESSING
  PAID
  FAILED
}

// ============================================
// PLEDGE UPDATES
// ============================================

enum PaymentMethod {
  STRIPE        // Direct card payment
  CREDITS       // DivinityCoin credits
}

model Pledge {
  // ... existing fields

  paymentMethod       PaymentMethod

  // Stripe fields
  stripePaymentIntentId String?  @unique
  stripeChargeId        String?

  // DivinityCoin fields (when paid with credits)
  creditHoldId          String?  @unique

  // ... relations
  creditHold            CreditHold?
}
```

---

## Key Functional Requirements (continued)

### Stripe Configuration (Fiat Payments)
1. **Account Setup**:
   - Creators connect via Stripe Connect (Express or Standard)
   - Automatic identity verification through Stripe
   - Environment: Production vs Test mode

2. **Configuration**:
   - Stripe Connect account ID
   - Payout schedule preferences
   - Tax information (collected by Stripe)

### Divinity Coin Configuration (Crypto Payments)
1. **Wallet Setup**:
   - Creators connect their cryptocurrency wallet
   - Verify wallet ownership via signature
   - Get API credentials from https://divinitycoin.com/developers

2. **Configuration**:
   - Wallet address for receiving payments
   - Supported cryptocurrencies (DCN, BTC, ETH, USDT, USDC, etc.)
   - Auto-conversion settings (optional: convert to stablecoin)
   - Webhook secret for payment notifications

#### Payment Flow

**For Backers (Stripe - Traditional Payment)**:
1. Select reward tier + optional add-ons
2. Click "Back this project"
3. Enter pledge amount (if custom amount allowed)
4. Stripe checkout page opens (modal or redirect)
5. Enter payment details:
   - Credit/Debit card
   - Billing address
   - Email
6. Stripe processes payment
7. Redirect back to platform with success/failure
8. Show confirmation page

**For Backers (Divinity Coin - Crypto Payment)**:
1. Select reward tier + optional add-ons
2. Click "Pay with Crypto"
3. Choose preferred cryptocurrency (DCN, BTC, ETH, etc.)
4. See payment invoice with:
   - Amount in selected crypto
   - QR code for wallet scanning
   - Wallet address for manual transfer
   - Countdown timer (payment expires in 1 hour)
5. Send payment from wallet
6. Wait for blockchain confirmation (1-6 confirmations depending on currency)
7. Automatic redirect to success page
8. Receive confirmation email with transaction hash

**Technical Implementation**:
```typescript
// Divinity Coin payment initiation
interface DivinityPaymentParams {
  amount: number;              // Amount in USD
  walletAddress: string;       // Creator's wallet
  acceptedCurrencies: string[]; // ['DCN', 'BTC', 'ETH']
  pledgeId: string;            // Pledge reference
  projectId: string;           // Project ID
  userId: string;              // Backer ID
  successUrl: string;          // Redirect on success
  cancelUrl: string;           // Redirect on cancel
  expiresIn: number;           // Seconds until expiry
}

// Create payment invoice
async function createDivinityInvoice(params: DivinityPaymentParams): Promise<DivinityInvoice> {
  const response = await fetch('https://api.divinitycoin.com/v1/invoices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.DIVINITY_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: params.amount,
      price_currency: 'USD',
      pay_currency: null, // Let backer choose
      order_id: params.pledgeId,
      order_description: `Pledge for project ${params.projectId}`,
      ipn_callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/divinity`,
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    }),
  });

  return response.json();
}
```

#### Webhook/Callback Handling

**Divinity Coin Webhook Events**:
- `invoice.created` - Invoice generated
- `invoice.pending` - Payment detected, awaiting confirmations
- `invoice.paid` - Payment confirmed
- `invoice.expired` - Payment window expired
- `invoice.underpaid` - Partial payment received

**Webhook endpoint**: `POST /api/webhooks/divinity`

```typescript
// Handle Divinity Coin webhooks
interface DivinityWebhook {
  event: 'invoice.paid' | 'invoice.expired' | 'invoice.underpaid' | 'invoice.pending';
  data: {
    invoiceId: string;
    orderId: string; // Our pledgeId
    payAmount: number;
    payCurrency: string;
    transactionHash: string;
    confirmations: number;
    status: string;
  };
}

async function handleDivinityWebhook(payload: DivinityWebhook) {
  // Verify webhook signature using HMAC
  // Update pledge status in database
  // For 'paid': Complete pledge, update funding
  // For 'expired': Mark pledge as failed
  // For 'underpaid': Notify backer of remaining amount
  // Send confirmation email with blockchain explorer link
}
```

#### Security Considerations
- Verify webhook signatures using HMAC-SHA256
- Store API keys encrypted in database
- Use HTTPS for all API communication
- Implement rate limiting on payment endpoints
- Monitor for unusual transaction patterns
- Store transaction hashes for audit trail

#### Fee Structure Display
- **Stripe fees**:
  - 2.9% + $0.30 per transaction
  - Platform fee: 5%
- **Divinity Coin fees**:
  - ~1% network fee (varies by cryptocurrency)
  - Platform fee: 5%
  - No chargebacks (final transactions)
- Display net amount after fees in dashboard

---

### Rewards to Add-ons Functionality

**Requirement**: Allow creators to copy any reward tier as an add-on

#### User Flow
1. Creator is on "Rewards" tab during project creation or editing
2. Each reward card/row has a "Copy to Add-ons" button (or icon)
3. Click button → show confirmation modal:
   - "Copy '[Reward Title]' to Add-ons?"
   - "This will create a duplicate in your Add-ons tab that you can customize"
   - [Cancel] [Copy]
4. On confirm:
   - Duplicate reward with all fields
   - Add to Add-ons list
   - Show success toast: "✓ Reward copied to Add-ons"
   - Option to "View Add-ons" or "Stay here"

#### Technical Implementation

**Database Schema**:
```prisma
model Reward {
  id                String   @id @default(cuid())
  projectId         String
  type              RewardType @default(TIER) // TIER or ADDON
  title             String
  description       String   @db.Text
  amount            Float
  imageUrl          String?
  estimatedDelivery DateTime?
  shippingType      ShippingType
  shippingCountries String[] // Array of country codes
  quantityAvailable Int?     // null = unlimited
  quantityClaimed   Int      @default(0)
  visibility        Visibility @default(PUBLIC) // PUBLIC or SECRET
  availableFrom     DateTime?
  availableUntil    DateTime?
  
  // Relations
  project           Project  @relation(fields: [projectId], references: [id])
  pledges           Pledge[]
  items             RewardItem[]
  
  // If this is copied from another reward
  copiedFromId      String?
  copiedFrom        Reward?  @relation("RewardCopies", fields: [copiedFromId], references: [id])
  copies            Reward[] @relation("RewardCopies")
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([projectId, type])
}

enum RewardType {
  TIER    // Main reward tier (backer selects one)
  ADDON   // Optional add-on (backer can select multiple)
}

enum ShippingType {
  WORLDWIDE
  SELECTED_COUNTRIES
  NO_SHIPPING // Digital or local pickup
}

enum Visibility {
  PUBLIC
  SECRET
}
```

**API Endpoint**:
```typescript
// POST /api/projects/:projectId/rewards/:rewardId/copy-to-addons

interface CopyRewardToAddonRequest {
  rewardId: string;
}

interface CopyRewardToAddonResponse {
  success: boolean;
  addonId: string;
  message: string;
}

async function copyRewardToAddon(
  projectId: string,
  rewardId: string
): Promise<CopyRewardToAddonResponse> {
  // 1. Fetch original reward
  const originalReward = await db.reward.findUnique({
    where: { id: rewardId },
    include: { items: true }
  });
  
  if (!originalReward) {
    throw new Error('Reward not found');
  }
  
  // 2. Create copy as add-on
  const newAddon = await db.reward.create({
    data: {
      projectId,
      type: 'ADDON',
      title: originalReward.title,
      description: originalReward.description,
      amount: originalReward.amount,
      imageUrl: originalReward.imageUrl,
      estimatedDelivery: originalReward.estimatedDelivery,
      shippingType: originalReward.shippingType,
      shippingCountries: originalReward.shippingCountries,
      quantityAvailable: originalReward.quantityAvailable,
      visibility: originalReward.visibility,
      availableFrom: originalReward.availableFrom,
      availableUntil: originalReward.availableUntil,
      copiedFromId: rewardId,
      // Copy related items
      items: {
        create: originalReward.items.map(item => ({
          title: item.title,
          description: item.description,
          imageUrl: item.imageUrl
        }))
      }
    }
  });
  
  return {
    success: true,
    addonId: newAddon.id,
    message: 'Reward copied to Add-ons successfully'
  };
}
```

**Frontend Component**:
```tsx
// components/rewards/RewardCard.tsx
interface RewardCardProps {
  reward: Reward;
  onCopyToAddons: (rewardId: string) => void;
}

function RewardCard({ reward, onCopyToAddons }: RewardCardProps) {
  const [showCopyModal, setShowCopyModal] = useState(false);
  
  const handleCopy = async () => {
    try {
      await onCopyToAddons(reward.id);
      toast.success('✓ Reward copied to Add-ons');
      setShowCopyModal(false);
    } catch (error) {
      toast.error('Failed to copy reward');
    }
  };
  
  return (
    <div className="reward-card">
      {/* Reward details */}
      <h3>{reward.title}</h3>
      <p>${reward.amount}</p>
      
      {/* Copy to Add-ons button */}
      {reward.type === 'TIER' && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCopyModal(true)}
        >
          Copy to Add-ons
        </Button>
      )}
      
      {/* Confirmation Modal */}
      <Modal
        isOpen={showCopyModal}
        onClose={() => setShowCopyModal(false)}
        title="Copy to Add-ons?"
      >
        <p>
          Copy "{reward.title}" to your Add-ons? 
          You'll be able to customize it after copying.
        </p>
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => setShowCopyModal(false)}>
            Cancel
          </Button>
          <Button onClick={handleCopy}>
            Copy
          </Button>
        </div>
      </Modal>
    </div>
  );
}
```

#### Add-ons Selection During Pledge

**Backer Experience**:
1. Select main reward tier
2. See section: "Optional Add-ons"
3. Browse available add-ons
4. Select multiple add-ons (checkboxes)
5. See running total update:
   - Main reward: $50
   - Add-on 1: $15
   - Add-on 2: $10
   - **Total: $75**
6. Proceed to payment (choose Stripe or Divinity Coin)

**Database Schema**:
```prisma
model Pledge {
  id              String   @id @default(cuid())
  userId          String
  projectId       String
  rewardId        String   // Main reward tier
  addonIds        String[] // Array of add-on IDs
  amount          Float    // Total amount including add-ons
  rewardAmount    Float    // Just the main reward amount
  addonsAmount    Float    // Sum of add-ons
  status          PledgeStatus
  divinityInvoiceId String?
  divinityTransactionHash String?
  
  user            User     @relation(fields: [userId], references: [id])
  project         Project  @relation(fields: [projectId], references: [id])
  reward          Reward   @relation(fields: [rewardId], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([projectId, status])
  @@index([userId])
}

enum PledgeStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  CANCELLED
}
```

---

### Remove Pay-Over-Time Functionality

**Requirements**: 
- No installment payment options
- No "Pledge Over Time" toggle
- All payments are single, one-time transactions
- Simplify payment flow

**What to Remove from Kickstarter's model**:
1. ❌ "Pledge Over Time" option in Basics
2. ❌ Payment plan selection during pledge
3. ❌ Installment scheduling
4. ❌ Recurring payment processing
5. ❌ Payment plan management in backer dashboard

**What to Keep**:
1. ✅ Single payment at pledge time
2. ✅ Full amount charged immediately
3. ✅ Refunds (if campaign fails or manual refund)
4. ✅ Simple "Back this project" → pay → done

**Impact on UI**:
- Remove any mentions of "over time" or "installments"
- Simplify pledge flow to single payment step
- All payments are one-time (no subscriptions or recurring)

---

## Database Schema

### Core Models

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// USER MANAGEMENT
// ============================================

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  emailVerified     DateTime?
  name              String?
  image             String?
  bio               String?   @db.Text
  location          String?
  timezone          String?
  vanityUrl         String?   @unique
  websites          String[]  // Array of URLs
  showNameOnly      Boolean   @default(false)
  
  // Auth
  accounts          Account[]
  sessions          Session[]
  
  // Relations
  createdProjects   Project[] @relation("ProjectCreator")
  collaborations    ProjectCollaborator[]
  pledges           Pledge[]
  messages          Message[]
  
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  @@index([email])
  @@index([vanityUrl])
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?
  
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}

// ============================================
// PROJECT MANAGEMENT
// ============================================

model Project {
  id                    String    @id @default(cuid())
  creatorId             String
  
  // Basics
  title                 String
  subtitle              String?
  slug                  String    @unique
  category              String
  location              String?
  imageUrl              String?
  videoUrl              String?
  goalAmount            Float
  currency              String    @default("USD")
  
  // Duration
  durationType          DurationType
  durationDays          Int?
  endDate               DateTime?
  launchDate            DateTime?
  
  // Story
  description           String    @db.Text
  risks                 String    @db.Text
  usesAI                Boolean   @default(false)
  faqs                  Json?     // Array of {question, answer}
  
  // Payment
  contactEmail          String
  projectType           ProjectType
  bankAccountId         String?
  divinityWalletAddress String?
  divinityApiKey        String?
  
  // Promotion
  prelaunchActive       Boolean   @default(false)
  prelaunchDescription  String?   @db.Text
  customReferralTags    String[]
  googleAnalyticsId     String?
  googleAnalyticsSecret String?
  metaPixelId           String?
  metaConversionsToken  String?
  
  // Status
  status                ProjectStatus @default(DRAFT)
  currentAmount         Float     @default(0)
  backerCount           Int       @default(0)
  followerCount         Int       @default(0)
  
  // Relations
  creator               User      @relation("ProjectCreator", fields: [creatorId], references: [id])
  rewards               Reward[]
  pledges               Pledge[]
  updates               Update[]
  collaborators         ProjectCollaborator[]
  messages              Message[]
  analytics             AnalyticsEvent[]
  
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  launchedAt            DateTime?
  fundedAt              DateTime?
  
  @@index([creatorId])
  @@index([status])
  @@index([category])
  @@index([slug])
}

enum DurationType {
  FIXED_DAYS
  END_DATE
}

enum ProjectType {
  INDIVIDUAL
  BUSINESS
  NONPROFIT
}

enum ProjectStatus {
  DRAFT
  SUBMITTED
  APPROVED
  LIVE
  FUNDED
  FAILED
  CANCELLED
}

// ============================================
// REWARDS & ADD-ONS
// ============================================

model Reward {
  id                String   @id @default(cuid())
  projectId         String
  type              RewardType @default(TIER)
  
  title             String
  description       String   @db.Text
  amount            Float
  imageUrl          String?
  
  // Delivery
  estimatedDelivery DateTime?
  shippingType      ShippingType
  shippingCountries String[]
  
  // Availability
  quantityAvailable Int?
  quantityClaimed   Int      @default(0)
  visibility        Visibility @default(PUBLIC)
  availableFrom     DateTime?
  availableUntil    DateTime?
  
  // Tracking if copied
  copiedFromId      String?
  
  // Relations
  project           Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  pledges           Pledge[]
  items             RewardItem[]
  copiedFrom        Reward?  @relation("RewardCopies", fields: [copiedFromId], references: [id])
  copies            Reward[] @relation("RewardCopies")
  
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  @@index([projectId, type])
}

enum RewardType {
  TIER
  ADDON
}

enum ShippingType {
  WORLDWIDE
  SELECTED_COUNTRIES
  NO_SHIPPING
}

enum Visibility {
  PUBLIC
  SECRET
}

model RewardItem {
  id          String  @id @default(cuid())
  rewardId    String
  title       String
  description String? @db.Text
  imageUrl    String?
  
  reward      Reward  @relation(fields: [rewardId], references: [id], onDelete: Cascade)
  
  @@index([rewardId])
}

// ============================================
// PLEDGES & PAYMENTS
// ============================================

model Pledge {
  id                    String   @id @default(cuid())
  userId                String
  projectId             String
  rewardId              String
  addonIds              String[] @default([])
  
  // Amounts
  amount                Float    // Total
  rewardAmount          Float    // Main reward
  addonsAmount          Float    @default(0)
  shippingAmount        Float    @default(0)
  
  // Payment
  status                PledgeStatus
  divinityInvoiceId       String?  @unique
  divinityTransactionHash String?  @unique
  divinityCurrency        String?
  
  // Survey
  surveyCompleted       Boolean  @default(false)
  shippingAddress       Json?
  surveyResponses       Json?
  
  // Relations
  user                  User     @relation(fields: [userId], references: [id])
  project               Project  @relation(fields: [projectId], references: [id])
  reward                Reward   @relation(fields: [rewardId], references: [id])
  
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
  
  @@index([projectId, status])
  @@index([userId])
  @@index([rewardId])
}

enum PledgeStatus {
  PENDING
  COMPLETED
  FAILED
  REFUNDED
  CANCELLED
  CHARGEBACK
}

// ============================================
// PAYOUTS
// ============================================

model Payout {
  id                String   @id @default(cuid())
  projectId         String
  amount            Float
  grossAmount       Float
  processorFees     Float    // Stripe or Divinity fees
  platformFees      Float
  type              PayoutType
  status            PayoutStatus
  payoutReference   String?  @unique  // Stripe payout ID or blockchain tx hash
  bankAccountLast4  String?
  
  project           Project  @relation(fields: [projectId], references: [id])
  
  sentAt            DateTime?
  createdAt         DateTime @default(now())
  
  @@index([projectId])
}

enum PayoutType {
  CAMPAIGN
  LATE_PLEDGE
  PLEDGE_MANAGER
}

enum PayoutStatus {
  PENDING
  PROCESSING
  COMPLETED
  FAILED
}

// ============================================
// COLLABORATORS
// ============================================

model ProjectCollaborator {
  id                    String   @id @default(cuid())
  projectId             String
  userId                String
  title                 String?
  
  // Permissions
  canEditProject        Boolean  @default(false)
  canManageCommunity    Boolean  @default(false)
  canCoordinateFulfillment Boolean @default(false)
  canConfigurePledgeManager Boolean @default(false)
  
  status                CollaboratorStatus @default(PENDING)
  
  project               Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user                  User     @relation(fields: [userId], references: [id])
  
  invitedAt             DateTime @default(now())
  acceptedAt            DateTime?
  
  @@unique([projectId, userId])
  @@index([projectId])
  @@index([userId])
}

enum CollaboratorStatus {
  PENDING
  ACCEPTED
  DECLINED
}

// ============================================
// UPDATES
// ============================================

model Update {
  id          String   @id @default(cuid())
  projectId   String
  title       String
  content     String   @db.Text
  visibility  UpdateVisibility @default(PUBLIC)
  status      UpdateStatus @default(DRAFT)
  
  likes       Int      @default(0)
  comments    Int      @default(0)
  
  project     Project  @relation(fields: [projectId], references: [id], onDelete: Cascade)
  
  publishedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([projectId, status])
}

enum UpdateVisibility {
  PUBLIC
  BACKERS_ONLY
}

enum UpdateStatus {
  DRAFT
  PUBLISHED
}

// ============================================
// MESSAGES
// ============================================

model Message {
  id              String   @id @default(cuid())
  projectId       String
  senderId        String
  recipientId     String
  subject         String?
  content         String   @db.Text
  read            Boolean  @default(false)
  isSpam          Boolean  @default(false)
  
  project         Project  @relation(fields: [projectId], references: [id])
  sender          User     @relation(fields: [senderId], references: [id])
  
  createdAt       DateTime @default(now())
  readAt          DateTime?
  
  @@index([projectId, recipientId])
  @@index([senderId])
}

// ============================================
// ANALYTICS
// ============================================

model AnalyticsEvent {
  id          String   @id @default(cuid())
  projectId   String
  eventType   EventType
  
  // Attribution
  referrer    String?
  channel     String?  // Desktop Web, Mobile Web iOS, Android App, etc.
  customTag   String?
  
  // Data
  amount      Float?
  userId      String?
  metadata    Json?
  
  project     Project  @relation(fields: [projectId], references: [id])
  
  timestamp   DateTime @default(now())
  
  @@index([projectId, eventType, timestamp])
  @@index([projectId, referrer])
}

enum EventType {
  PAGE_VIEW
  PROJECT_FOLLOW
  VIDEO_PLAY
  VIDEO_COMPLETE
  PLEDGE_STARTED
  PLEDGE_COMPLETED
  PLEDGE_FAILED
  REWARD_SELECTED
  ADDON_SELECTED
  SHARE
}

// ============================================
// PAYMENT PROCESSOR CONFIGURATION
// ============================================

model StripeConfig {
  id              String   @id @default(cuid())
  userId          String   @unique
  stripeAccountId String   @unique
  isOnboarded     Boolean  @default(false)
  isActive        Boolean  @default(true)
  
  user            User     @relation(fields: [userId], references: [id])
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  @@index([userId])
}

model DivinityConfig {
  id                  String   @id @default(cuid())
  userId              String   @unique
  walletAddress       String
  apiKey              String   @db.Text // Encrypted
  webhookSecret       String   @db.Text // Encrypted
  supportedCurrencies String[] @default(["DCN", "BTC", "ETH", "USDT", "USDC"])
  autoConvert         Boolean  @default(false) // Auto-convert to stablecoin
  convertTo           String?  // Target stablecoin (USDT, USDC)

  isActive            Boolean  @default(true)

  user                User     @relation(fields: [userId], references: [id])

  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([userId])
}

// ============================================
// RECOMMENDATION ENGINE & BEHAVIORAL TRACKING
// ============================================

model UserBehavior {
  id          String   @id @default(cuid())
  userId      String?  // Null for anonymous users
  sessionId   String   // Track anonymous sessions
  eventType   BehaviorEventType
  
  // Event data
  projectId   String?
  categoryId  String?
  rewardId    String?
  searchQuery String?
  
  // Context
  path        String
  referrer    String?
  userAgent   String?
  ipAddress   String?
  country     String?
  
  // Engagement metrics
  timeSpent   Int?     // Milliseconds
  scrollDepth Float?   // Percentage
  
  metadata    Json?    // Flexible for additional data
  
  timestamp   DateTime @default(now())
  
  user        User?    @relation(fields: [userId], references: [id])
  project     Project? @relation(fields: [projectId], references: [id])
  
  @@index([userId, eventType, timestamp])
  @@index([sessionId, timestamp])
  @@index([projectId, eventType])
  @@index([categoryId, timestamp])
}

enum BehaviorEventType {
  PAGE_VIEW
  PAGE_EXIT
  PROJECT_VIEW
  PROJECT_CLICK
  REWARD_CLICK
  VIDEO_PLAY
  VIDEO_COMPLETE
  SEARCH
  FILTER_APPLY
  PROJECT_SAVE
  PROJECT_SHARE
  COMMENT_POST
  PLEDGE_START
  PLEDGE_COMPLETE
  SCROLL_DEPTH
  HOVER
  CREATOR_VIEW
}

model UserPreference {
  id              String   @id @default(cuid())
  userId          String   @unique
  
  // Category preferences (weighted scores 0-1)
  categoryScores  Json     // { "comics": 0.85, "games": 0.62, ... }
  
  // Preferred pledge ranges
  minPledge       Float?
  maxPledge       Float?
  avgPledge       Float?
  
  // Creator preferences
  followedCreators String[]
  backedCreators   String[]
  
  // Content preferences
  prefersVideo     Boolean  @default(true)
  prefersLongForm  Boolean  @default(true)
  
  // Geographic preferences
  prefersLocal     Boolean  @default(false)
  preferredCountries String[]
  
  // Engagement level (0-100)
  engagementScore  Int      @default(50)
  
  // Email preferences
  emailPreferences Json?    // { weeklyDiscovery: true, creatorLaunches: true, ... }
  
  // Last calculated
  lastUpdated      DateTime @updatedAt
  
  user             User     @relation(fields: [userId], references: [id])
  
  @@index([userId])
}

model ProjectSimilarity {
  id              String   @id @default(cuid())
  projectId       String
  similarProjectId String
  similarityScore Float    // 0-1, higher = more similar
  reason          String   // "same_category", "same_creator", "similar_backers"
  
  project         Project  @relation("ProjectSimilarities", fields: [projectId], references: [id])
  similarProject  Project  @relation("SimilarProjects", fields: [similarProjectId], references: [id])
  
  createdAt       DateTime @default(now())
  
  @@unique([projectId, similarProjectId])
  @@index([projectId, similarityScore])
}

model EmailLog {
  id          String   @id @default(cuid())
  userId      String
  projectId   String?
  type        EmailType
  subject     String?
  
  sentAt      DateTime @default(now())
  openedAt    DateTime?
  clickedAt   DateTime?
  
  user        User     @relation(fields: [userId], references: [id])
  project     Project? @relation(fields: [projectId], references: [id])
  
  @@index([userId, type, sentAt])
  @@index([projectId, type])
}

enum EmailType {
  WEEKLY_DISCOVERY
  CREATOR_LAUNCH
  CATEGORY_ALERT
  ENDING_SOON
  PROJECT_FUNDED
  FUNDING_MILESTONE
  UPDATE_NOTIFICATION
  SURVEY_REMINDER
  PLEDGE_CONFIRMATION
}
```

---

## API Routes Structure

```
/api
├── /auth
│   ├── /[...nextauth]        # NextAuth.js authentication
│   ├── /register             # User registration
│   ├── /verify-email         # Email verification
│   └── /reset-password       # Password reset
│
├── /users
│   ├── /profile              # GET, PATCH user profile
│   ├── /avatar               # POST upload avatar
│   ├── /preferences          # GET, PATCH user preferences
│   └── /[userId]             # GET public user profile
│
├── /projects
│   ├── /                     # GET list, POST create
│   ├── /[id]                 # GET, PATCH, DELETE project
│   ├── /[id]/publish         # POST publish project
│   ├── /[id]/analytics       # GET analytics data
│   ├── /[id]/dashboard       # GET dashboard data
│   ├── /[id]/followers       # GET, POST follow/unfollow
│   ├── /[id]/similar         # GET similar projects
│   └── /[id]/export          # GET export backer report
│
├── /rewards
│   ├── /                     # POST create reward
│   ├── /[id]                 # GET, PATCH, DELETE reward
│   ├── /[id]/copy-to-addons  # POST copy reward to addons
│   └── /[id]/items           # POST add item to reward
│
├── /pledges
│   ├── /initiate             # POST start pledge process
│   ├── /[id]                 # GET pledge details
│   ├── /[id]/cancel          # POST cancel pledge
│   └── /[id]/survey          # POST submit survey response
│
├── /payments
│   ├── /stripe
│   │   ├── /connect          # POST initiate Stripe Connect
│   │   ├── /payment-intent   # POST create payment intent
│   │   ├── /confirm          # POST confirm payment
│   │   └── /webhook          # POST handle Stripe webhook
│   ├── /divinity
│   │   ├── /create-invoice   # POST create Divinity payment invoice
│   │   ├── /status           # GET check payment status
│   │   └── /webhook          # POST handle Divinity webhook
│   └── /select-processor     # POST select payment processor
│
├── /recommendations
│   ├── /                     # GET personalized recommendations
│   ├── /refresh              # POST refresh recommendations
│   ├── /trending             # GET trending projects
│   └── /similar/[projectId]  # GET similar projects
│
├── /behavior
│   ├── /track                # POST track user behavior event
│   └── /preferences          # GET calculated preferences
│
├── /updates
│   ├── /                     # GET list, POST create
│   ├── /[id]                 # GET, PATCH, DELETE update
│   └── /[id]/publish         # POST publish update
│
├── /messages
│   ├── /                     # GET inbox
│   ├── /[id]                 # GET conversation
│   ├── /send                 # POST send message
│   └── /[id]/mark-spam       # POST mark as spam
│
├── /collaborators
│   ├── /invite               # POST invite collaborator
│   ├── /[id]                 # PATCH update permissions
│   ├── /[id]/remove          # DELETE remove collaborator
│   └── /accept               # POST accept invitation
│
├── /payouts
│   ├── /                     # GET list payouts
│   └── /[id]                 # GET payout details
│
├── /analytics
│   ├── /projects/[id]/daily-pledged    # GET daily pledge data
│   ├── /projects/[id]/referrers        # GET referrer data
│   ├── /projects/[id]/channels         # GET channel data
│   └── /projects/[id]/video-plays      # GET video play data
│
└── /webhooks
    ├── /stripe              # POST Stripe webhook handler
    └── /divinity            # POST Divinity Coin webhook handler
```

---

## Component Structure

```
/components
├── /auth
│   ├── LoginForm.tsx
│   ├── RegisterForm.tsx
│   └── AuthProvider.tsx
│
├── /project
│   ├── /builder
│   │   ├── ProjectBuilder.tsx        # Main multi-step form
│   │   ├── BasicsStep.tsx
│   │   ├── RewardsStep.tsx
│   │   ├── AddonsStep.tsx
│   │   ├── StoryStep.tsx
│   │   ├── PeopleStep.tsx
│   │   ├── PaymentStep.tsx
│   │   └── PromotionStep.tsx
│   │
│   ├── /dashboard
│   │   ├── ProjectDashboard.tsx
│   │   ├── OverviewTab.tsx
│   │   ├── ActivityFeed.tsx
│   │   ├── FundingProgressChart.tsx
│   │   ├── PledgesBreakdown.tsx
│   │   ├── BackerSourceTable.tsx
│   │   ├── RewardPopularity.tsx
│   │   └── AdvancedAnalytics.tsx
│   │
│   ├── /display
│   │   ├── ProjectCard.tsx
│   │   ├── ProjectPage.tsx
│   │   ├── RewardTierCard.tsx
│   │   ├── AddonSelector.tsx
│   │   └── PledgeButton.tsx
│   │
│   └── ProjectStatusBadge.tsx
│
├── /rewards
│   ├── RewardCard.tsx
│   ├── RewardForm.tsx
│   ├── RewardItemForm.tsx
│   ├── AddToAddonsButton.tsx
│   └── AddonsManager.tsx
│
├── /pledge
│   ├── PledgeFlow.tsx
│   ├── RewardSelection.tsx
│   ├── AddonSelection.tsx
│   ├── PledgeTotal.tsx
│   ├── StripePaymentButton.tsx
│   └── DivinityPaymentButton.tsx
│
├── /payments
│   ├── StripeCheckout.tsx
│   ├── DivinityCryptoPayment.tsx
│   ├── PaymentMethodSelector.tsx
│   ├── PaymentSuccess.tsx
│   └── PaymentFailed.tsx
│
├── /updates
│   ├── UpdatesList.tsx
│   ├── UpdateCard.tsx
│   ├── UpdateEditor.tsx
│   └── UpdatePublisher.tsx
│
├── /messages
│   ├── MessageInbox.tsx
│   ├── MessageThread.tsx
│   └── ComposeMessage.tsx
│
├── /collaborators
│   ├── CollaboratorList.tsx
│   ├── CollaboratorCard.tsx
│   ├── InviteCollaboratorForm.tsx
│   └── PermissionsEditor.tsx
│
├── /analytics
│   ├── AnalyticsDashboard.tsx
│   ├── DailyPledgedChart.tsx
│   ├── HourlyPledgedChart.tsx
│   ├── ChannelBreakdown.tsx
│   ├── ReferrersTable.tsx
│   └── CustomRefTagChart.tsx
│
├── /ui
│   ├── Button.tsx
│   ├── Input.tsx
│   ├── Textarea.tsx
│   ├── Select.tsx
│   ├── Modal.tsx
│   ├── Toast.tsx
│   ├── Card.tsx
│   ├── Badge.tsx
│   ├── Tabs.tsx
│   ├── Table.tsx
│   └── Chart.tsx
│
└── /layout
    ├── Header.tsx
    ├── Footer.tsx
    ├── Sidebar.tsx
    ├── DashboardLayout.tsx
    └── PublicLayout.tsx
```

---

## Key User Flows

### 1. Creator: Launch a Campaign

```
1. Sign up / Log in
2. Click "Start a project"
3. Multi-step builder:
   a. Basics → Enter title, goal, duration, image/video
   b. Rewards → Create reward tiers
      - Click "Copy to Add-ons" for any tier
   c. Add-ons → View copied add-ons, create new ones
   d. Story → Write description, risks, FAQs
   e. People → Set up profile, invite collaborators
   f. Payment → Connect Stripe and/or Divinity Coin wallet
   g. Promotion → Generate URL, set up analytics
4. Preview project
5. Submit for review
6. Once approved → Launch
7. Project goes live
```

### 2. Backer: Pledge to a Project

```
1. Browse projects or click project link
2. View project page
3. Scroll through rewards
4. Click "Select this reward" on desired tier
5. See add-ons section
6. Select optional add-ons (checkboxes)
7. See total update (reward + add-ons)
8. Click "Continue to payment"
9. Choose payment method:
   - Stripe (card): Enter card details in checkout
   - Divinity Coin (crypto): Select cryptocurrency and scan QR code
10. Payment processed (instant for card, 1-6 confirmations for crypto)
11. Redirected back to success page
13. Receive confirmation email
14. Pledge appears in project dashboard
```

### 3. Creator: Copy Reward to Add-ons

```
1. In project builder, go to "Rewards" tab
2. See list of created reward tiers
3. Find reward to copy
4. Click "Copy to Add-ons" button
5. Confirmation modal appears
6. Click "Copy"
7. Success toast: "✓ Reward copied to Add-ons"
8. Navigate to "Add-ons" tab
9. See copied add-on
10. Edit if needed
11. Save changes
```

### 4. Creator: View Dashboard Analytics

```
1. Project is live
2. Navigate to project dashboard
3. See overview:
   - Funding progress
   - Backer count
   - Days remaining
4. Click "Advanced Analytics" (Beta)
5. See detailed charts:
   - Daily/hourly pledged
   - Referrers breakdown
   - Channel distribution
   - Custom ref tag performance
6. Download data as CSV
7. Use insights to optimize marketing
```

### 5. Creator: Fulfill Rewards

```
1. Campaign ends successfully
2. Navigate to "Backer survey"
3. Create survey to collect:
   - Shipping addresses
   - SKU preferences (size, color, etc.)
   - Custom questions
4. Send survey to all backers
5. Wait for responses
6. Navigate to "Backer report"
7. Agree to privacy terms
8. Export backer report as CSV
9. Use report to fulfill orders
10. Mark orders as shipped in "Fulfillment" tab
11. Send update to backers with tracking info
```

---

## Payment Integration Details

### Stripe Setup Steps (Fiat Payments)

1. **Creator Registration**:
   - Creator signs up on platform
   - Prompted to set up payment processing
   - Click "Connect Stripe Account"
   - Redirected to Stripe Connect onboarding

2. **Stripe Connect Onboarding**:
   - Verify identity through Stripe
   - Link bank account for payouts
   - Set payout schedule
   - Complete tax information

3. **Webhook Configuration**:
   - Platform automatically registers webhooks
   - Events: `payment_intent.succeeded`, `payment_intent.failed`, `charge.refunded`

### Divinity Coin Setup Steps (Crypto Payments)

1. **Creator Registration**:
   - Creator signs up on platform
   - Click "Connect Crypto Wallet"
   - Redirected to wallet connection flow

2. **Wallet Connection**:
   - Enter wallet address (supports multiple chains)
   - Sign message to verify ownership
   - Get API credentials from https://divinitycoin.com/developers
   - Enter API key and webhook secret
   - Select supported cryptocurrencies (DCN, BTC, ETH, etc.)

3. **Webhook Configuration**:
   - Set up webhook URL: `https://yourplatform.com/api/webhooks/divinity`
   - Configure webhook secret for signature verification
   - Events: `invoice.paid`, `invoice.expired`, `invoice.underpaid`

### Payment Flow Technical Details

**Step 1: Initiate Payment (Stripe)**
```typescript
// When backer clicks "Pay with Card"
const paymentData = {
  projectId: project.id,
  rewardId: selectedReward.id,
  addonIds: selectedAddons.map(a => a.id),
  amount: calculateTotal(selectedReward, selectedAddons),
  userId: currentUser.id,
};

// Call API to create Stripe payment intent
const response = await fetch('/api/payments/stripe/payment-intent', {
  method: 'POST',
  body: JSON.stringify(paymentData),
});

const { clientSecret, pledgeId } = await response.json();

// Use Stripe.js to complete payment
const stripe = await loadStripe(process.env.NEXT_PUBLIC_STRIPE_KEY);
const { error } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: `${window.location.origin}/pledge/success?id=${pledgeId}`,
  },
});
```

**Step 1: Initiate Payment (Divinity Coin)**
```typescript
// When backer clicks "Pay with Crypto"
const paymentData = {
  projectId: project.id,
  rewardId: selectedReward.id,
  addonIds: selectedAddons.map(a => a.id),
  amount: calculateTotal(selectedReward, selectedAddons),
  userId: currentUser.id,
  preferredCurrency: 'DCN', // or BTC, ETH, etc.
};

// Call API to create Divinity invoice
const response = await fetch('/api/payments/divinity/create-invoice', {
  method: 'POST',
  body: JSON.stringify(paymentData),
});

const { invoiceId, paymentUrl, qrCode, expiresAt } = await response.json();

// Show crypto payment modal with QR code
// or redirect to hosted payment page
```

**Step 2: Create Divinity Invoice**
```typescript
// /api/payments/divinity/create-invoice
export async function POST(req: Request) {
  const { projectId, rewardId, addonIds, amount, userId } = await req.json();

  // Get project's Divinity config
  const divinityConfig = await getDivinityConfig(projectId);

  // Create pending pledge in database
  const pledge = await db.pledge.create({
    data: {
      userId,
      projectId,
      rewardId,
      addonIds,
      amount,
      status: 'PENDING',
      paymentProcessor: 'DIVINITY',
    },
  });

  // Create invoice via Divinity Coin API
  const invoice = await fetch('https://api.divinitycoin.com/v1/invoices', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${divinityConfig.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_amount: amount,
      price_currency: 'USD',
      receive_currency: divinityConfig.supportedCurrencies,
      order_id: pledge.id,
      order_description: `Pledge for project`,
      callback_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/divinity`,
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pledge/success?id=${pledge.id}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pledge/cancelled?id=${pledge.id}`,
    }),
  }).then(r => r.json());

  // Update pledge with invoice ID
  await db.pledge.update({
    where: { id: pledge.id },
    data: { divinityInvoiceId: invoice.id },
  });

  return Response.json({
    invoiceId: invoice.id,
    paymentUrl: invoice.payment_url,
    qrCode: invoice.qr_code,
    expiresAt: invoice.expires_at,
    pledgeId: pledge.id,
  });
}
```

**Step 3: Handle Divinity Coin Webhook**
```typescript
// /api/webhooks/divinity
export async function POST(req: Request) {
  const body = await req.json();
  const signature = req.headers.get('x-divinity-signature');

  // Verify webhook authenticity
  const isValid = verifyDivinityWebhook(body, signature);
  if (!isValid) {
    return Response.json({ error: 'Invalid webhook' }, { status: 401 });
  }

  const { event, data } = body;

  switch (event) {
    case 'invoice.paid':
      await handleSuccessfulCryptoPayment(data);
      break;
    case 'invoice.expired':
      await handleExpiredPayment(data);
      break;
    case 'invoice.underpaid':
      await handleUnderpaidPayment(data);
      break;
  }

  return Response.json({ success: true });
}

async function handleSuccessfulCryptoPayment(data: any) {
  const { order_id: pledgeId, transaction_hash, pay_amount, pay_currency } = data;

  // Update pledge status
  const pledge = await db.pledge.update({
    where: { id: pledgeId },
    data: {
      status: 'COMPLETED',
      divinityTransactionHash: transaction_hash,
      divinityCurrency: pay_currency,
      divinityAmountPaid: pay_amount,
    },
    include: { project: true, user: true, reward: true },
  });

  // Update project funding total
  await db.project.update({
    where: { id: pledge.projectId },
    data: {
      currentAmount: { increment: pledge.amount },
      backerCount: { increment: 1 },
    },
  });

  // Update reward quantity claimed
  await db.reward.update({
    where: { id: pledge.rewardId },
    data: { quantityClaimed: { increment: 1 } },
  });

  // Record analytics event
  await db.analyticsEvent.create({
    data: {
      projectId: pledge.projectId,
      eventType: 'PLEDGE_COMPLETED',
      amount: pledge.amount,
      userId: pledge.userId,
      metadata: { paymentMethod: 'crypto', currency: pay_currency },
    },
  });

  // Send confirmation email with blockchain explorer link
  await sendCryptoPledgeConfirmationEmail(pledge, transaction_hash);

  // Notify project creator
  await notifyCreatorOfNewPledge(pledge);
}
```

### Payment Security

**Divinity Coin Webhook Verification**:
```typescript
import crypto from 'crypto';

function verifyDivinityWebhook(body: any, signature: string | null): boolean {
  if (!signature) return false;

  // Get your webhook secret from env
  const secret = process.env.DIVINITY_WEBHOOK_SECRET;

  // Create HMAC hash of the body
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(body))
    .digest('hex');

  // Compare signatures
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

**Storing Credentials Securely**:
```typescript
// Encrypt Divinity credentials before storing
import { encrypt, decrypt } from '@/lib/encryption';

async function saveDivinityConfig(userId: string, config: DivinityConfigInput) {
  const encryptedApiKey = encrypt(config.apiKey);
  const encryptedWebhookSecret = encrypt(config.webhookSecret);

  await db.divinityConfig.create({
    data: {
      userId,
      walletAddress: config.walletAddress,
      apiKey: encryptedApiKey,
      webhookSecret: encryptedWebhookSecret,
      supportedCurrencies: config.supportedCurrencies,
      autoConvert: config.autoConvert,
      isActive: true,
    },
  });
}

async function getDivinityConfig(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      creator: {
        include: { divinityConfig: true },
      },
    },
  });

  const config = project.creator.divinityConfig;
  const decryptedApiKey = decrypt(config.apiKey);

  return {
    ...config,
    apiKey: decryptedApiKey,
  };
}
```

---

## Environment Variables

```bash
# .env.local

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/crowdfunding"

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-here"

# Stripe
STRIPE_PUBLIC_KEY="pk_test_..."
STRIPE_SECRET_KEY="sk_test_..."
STRIPE_WEBHOOK_SECRET="whsec_..."

# DivinityCoin
DIVINITYCOIN_API_KEY="your-divinitycoin-api-key"
DIVINITYCOIN_WEBHOOK_SECRET="your-divinitycoin-webhook-secret"
DIVINITYCOIN_API_URL="https://api.divinitycoin.com"

# File Upload
AWS_S3_BUCKET="your-bucket-name"
AWS_ACCESS_KEY_ID="your-access-key"
AWS_SECRET_ACCESS_KEY="your-secret-key"
AWS_REGION="us-east-1"

# Email
RESEND_API_KEY="re_..."
SENDGRID_API_KEY="SG..."
SENDGRID_FROM_EMAIL="noreply@yourplatform.com"

# Analytics (optional)
GOOGLE_ANALYTICS_ID="G-XXXXXXXXXX"

# Encryption
ENCRYPTION_KEY="your-32-byte-encryption-key"

# Redis/Caching
UPSTASH_REDIS_URL="https://..."
UPSTASH_REDIS_TOKEN="..."

# Cron Jobs
CRON_SECRET="your-cron-secret"

# Recommendation Engine
RECOMMENDATION_CACHE_TTL=300
PREFERENCE_REBUILD_INTERVAL=86400
```

---

## Development Phases

### Phase 1: Core Infrastructure (Weeks 1-2)
- ✅ Set up Next.js project with TypeScript
- ✅ Configure Tailwind CSS and Shadcn/ui
- ✅ Set up PostgreSQL database
- ✅ Configure Prisma ORM
- ✅ Implement authentication (NextAuth.js)
- ✅ Set up file upload (S3 or UploadThing)
- ✅ Create basic layout components
- ✅ Set up Redis for caching
- ✅ Implement behavioral tracking infrastructure

### Phase 2: User & Project Management (Weeks 3-4)
- ✅ User registration and profiles
- ✅ Creator profile pages
- ✅ Project creation (multi-step builder)
- ✅ Basics step
- ✅ Rewards step
- ✅ Add-ons step (with copy functionality)
- ✅ Story step (rich text editor)
- ✅ People step
- ✅ Project listing and display
- ✅ Behavioral event tracking hooks

### Phase 3: Payment Integration - Dual Processor (Weeks 5-7)
- ✅ Payment processor selection UI
- ✅ Content declaration system
- ✅ **Stripe Connect integration**
  - ✅ Onboarding flow
  - ✅ Payment Intent creation
  - ✅ Webhook handling
  - ✅ Refund processing
- ✅ **Divinity Coin integration**
  - ✅ Wallet connection flow
  - ✅ Invoice creation
  - ✅ Webhook handling
  - ✅ Security implementation
- ✅ Unified payment abstraction layer
- ✅ Pledge management
- ✅ Fee comparison calculator

### Phase 4: Recommendation Algorithm (Weeks 8-10) **CRITICAL**
- ✅ **Behavioral tracking system**
  - ✅ Frontend tracking components
  - ✅ Event capture (views, clicks, scrolls, time spent)
  - ✅ Anonymous session tracking
  - ✅ Database logging
- ✅ **User preference engine**
  - ✅ Category scoring algorithm
  - ✅ Preference calculation from behavior
  - ✅ Engagement score calculation
  - ✅ Background preference rebuild jobs
- ✅ **Recommendation algorithms**
  - ✅ Collaborative filtering
  - ✅ Content-based filtering
  - ✅ Trending/popularity algorithm
  - ✅ Creator-based recommendations
  - ✅ Hybrid scoring system
  - ✅ Diversity filter
- ✅ **Project similarity calculation**
  - ✅ Category-based similarity
  - ✅ Backer overlap analysis
  - ✅ Background similarity rebuild
- ✅ **Personalized homepage**
  - ✅ Dynamic project recommendations
  - ✅ Auto-refresh on navigation
  - ✅ Caching layer (Redis)
- ✅ **API endpoints**
  - ✅ Get recommendations
  - ✅ Track behavior events
  - ✅ Refresh recommendations

### Phase 5: Email Notification System (Weeks 11-12) **CRITICAL**
- ✅ **Email infrastructure**
  - ✅ Resend/SendGrid integration
  - ✅ React Email templates
  - ✅ Email preference management
  - ✅ Unsubscribe handling
- ✅ **Notification types**
  - ✅ Weekly personalized discovery
  - ✅ Creator launch notifications
  - ✅ Similar project alerts
  - ✅ Ending soon reminders
  - ✅ Funding milestone celebrations
  - ✅ Update notifications for backers
  - ✅ Survey reminders
- ✅ **Smart sending logic**
  - ✅ Frequency caps (max per week)
  - ✅ User preference filtering
  - ✅ Optimal send time calculation
  - ✅ A/B testing capability
- ✅ **Email analytics**
  - ✅ Open tracking
  - ✅ Click tracking
  - ✅ Conversion tracking
  - ✅ Engagement scoring
- ✅ **Cron jobs**
  - ✅ Weekly discovery (Sundays)
  - ✅ Daily ending soon
  - ✅ Real-time creator launches
  - ✅ Category alerts (daily)

### Phase 6: Dashboard & Analytics (Weeks 13-14)
- ✅ Project dashboard overview
- ✅ Funding progress charts
- ✅ Activity feed
- ✅ Backer source tracking
- ✅ Referrer analytics
- ✅ Advanced analytics dashboard
- ✅ Custom referral tags
- ✅ Google Analytics integration
- ✅ Meta Pixel integration
- ✅ **Recommendation performance metrics**
  - ✅ Click-through rates
  - ✅ Conversion rates by recommendation type
  - ✅ Email engagement metrics

### Phase 7: Post-Campaign Features (Weeks 15-16)
- ✅ Backer survey builder
- ✅ Survey distribution
- ✅ Address collection
- ✅ Backer report export
- ✅ Fulfillment dashboard
- ✅ Shipping integration (Easyship)
- ✅ Payout management (both processors)

### Phase 8: Communication (Weeks 17-18)
- ✅ Updates system (drafts & published)
- ✅ Rich text editor for updates
- ✅ Update notifications (email + in-app)
- ✅ Messaging system (inbox)
- ✅ Backer communication
- ✅ Notification system

### Phase 9: Collaboration & Polish (Weeks 19-20)
- ✅ Collaborator invitations
- ✅ Permission management
- ✅ Collaborator dashboard views
- ✅ UI/UX refinements
- ✅ Mobile responsiveness
- ✅ Performance optimization
- ✅ Security audit

### Phase 10: Algorithm Optimization (Weeks 21-22)
- ✅ **A/B testing framework**
  - ✅ Test different recommendation algorithms
  - ✅ Test email send times
  - ✅ Test subject lines
- ✅ **Machine learning enhancements** (optional, advanced)
  - ✅ Train ML model on historical data
  - ✅ Predict project success probability
  - ✅ Optimize recommendation weights
- ✅ **Performance tuning**
  - ✅ Optimize database queries
  - ✅ Implement query caching
  - ✅ Background job optimization

### Phase 11: Testing & Launch (Weeks 23-24)
- ✅ Comprehensive testing
- ✅ Bug fixes
- ✅ Load testing
- ✅ Payment processor sandbox testing (both)
- ✅ Production setup (Stripe + Divinity Coin)
- ✅ Recommendation algorithm validation
- ✅ Email deliverability testing
- ✅ Soft launch with beta users
- ✅ Monitor recommendation performance
- ✅ Full launch

---

## Testing Requirements

### Unit Tests
- User authentication flows
- Reward creation and management
- Copy reward to add-on functionality
- Pledge calculation (reward + add-ons)
- Divinity Coin webhook signature verification
- Analytics data aggregation

### Integration Tests
- Complete project creation flow
- End-to-end pledge process
- Divinity Coin payment integration
- Email delivery
- File uploads
- Database transactions

### E2E Tests (Playwright/Cypress)
- User registration → project creation → launch
- Backer pledge flow with add-ons
- Creator dashboard navigation
- Update creation and publishing
- Message sending and receiving

### Security Tests
- Authentication bypass attempts
- SQL injection
- XSS vulnerabilities
- CSRF protection
- Divinity Coin webhook spoofing
- Rate limiting

### Performance Tests
- Dashboard load times
- Chart rendering performance
- Large dataset handling (1000+ pledges)
- Concurrent user handling
- Database query optimization

---

## Security Considerations

### Payment Security
- Never store credit card data (Stripe handles)
- Encrypt all API credentials (Stripe and Divinity Coin)
- Verify all webhook signatures
- Use HTTPS everywhere
- Implement CSRF protection
- Rate limit payment endpoints

### Data Privacy
- Comply with GDPR/CCPA
- Encrypt sensitive backer data
- Implement data export functionality
- Provide data deletion option
- Privacy policy and terms clearly displayed
- Backer data access controls (creator only)

### Authentication
- Secure password hashing (bcrypt)
- Email verification required
- 2FA optional
- Session management (httpOnly cookies)
- Logout on all devices option
- Password reset with time-limited tokens

### API Security
- JWT or session-based auth
- Rate limiting on all endpoints
- Input validation (Zod)
- SQL injection prevention (Prisma ORM)
- XSS protection (sanitize HTML)
- CORS configuration

---

## Performance Optimization

### Frontend
- Code splitting (Next.js automatic)
- Image optimization (next/image)
- Lazy load components
- Minimize bundle size
- Cache API responses (React Query)
- Debounce search inputs

### Backend
- Database indexing (see schema)
- Query optimization (Prisma select)
- Caching (Redis for frequently accessed data)
- Pagination for large lists
- Background jobs (for emails, analytics)
- CDN for static assets (Vercel)

### Database
- Indexes on foreign keys
- Composite indexes for common queries
- Avoid N+1 queries (use include/select)
- Connection pooling
- Read replicas for analytics (if scaling)

---

## Deployment

### Hosting
- **Frontend & Backend**: Vercel
- **Database**: Vercel Postgres or Supabase
- **File Storage**: AWS S3
- **Email**: SendGrid
- **Cache**: Vercel KV (Redis) or Upstash

### CI/CD
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run build
      - run: npx prisma migrate deploy
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
```

### Environment Setup
1. Development: Local PostgreSQL, Stripe test mode, Divinity testnet
2. Staging: Vercel preview, Vercel Postgres, Stripe test, Divinity testnet
3. Production: Vercel production, Vercel Postgres, Stripe live, Divinity mainnet

---

## Success Metrics

### Platform KPIs
- Projects launched per month
- Total funding volume
- Average pledge amount
- Platform fee revenue
- User retention rate
- Creator return rate

### Technical Metrics
- Page load time (< 2s)
- API response time (< 500ms)
- Error rate (< 0.1%)
- Uptime (> 99.9%)
- Payment success rate (> 95%)

---

## Future Enhancements

### Phase 2 Features (Post-MVP)
- Mobile apps (React Native)
- Social sharing improvements
- AI-powered project insights
- Automated marketing tools
- Pledge Manager (full post-campaign store)
- Multi-currency support
- International payment methods
- Project categories and discovery
- Featured projects
- Search and filtering
- Creator verification badges
- Backer badges/achievements
- Community forums
- Live chat support

---

## Support & Documentation

### For Creators
- Creator handbook (help center)
- Video tutorials
- FAQs
- Best practices guides
- Email support
- Live chat (for urgent issues)

### For Backers
- How to back a project
- Payment methods
- Refund policy
- Survey completion guide
- Tracking rewards

### Technical Docs
- API documentation (if public API)
- DivinityCoin integration guide
- Webhook setup guide
- Analytics setup guide

---

## Payment System FAQs

### For Creators

**Q: What payment methods can backers use for my project?**
A: Backers can pay using:
- **Credit/Debit Card**: Direct payment via Stripe
- **DivinityCoin Credits**: A universal creator currency - backers buy credits at divinitycoin.com and use them across all partner platforms

**Q: How do I receive funds from pledges?**
A: All payouts are processed via **Stripe Connect**:
- **Card payments**: Processed immediately, deposited within 2 business days
- **DivinityCoin credits**: Settled weekly/monthly, then paid to you via Stripe Connect

**Q: What are the fees?**
A:
- **Card payments (Stripe)**: 2.9% + $0.30 per transaction + 5% platform fee
- **DivinityCoin credits**: Platform receives 94% after 6% DivinityCoin fee, then 5% platform fee on your earnings

**Example breakdown for $100 pledge with DivinityCoin:**
| Stage | Amount |
|-------|--------|
| Backer pays | $100.00 |
| DivinityCoin fee (6%) | -$6.00 |
| Platform receives | $94.00 |
| Platform fee (5%) | -$4.70 |
| Stripe Connect fee (~0.25%) | -$0.25 |
| **You receive** | **~$89.05** |

**Q: Do I need to set anything up for DivinityCoin?**
A: No! DivinityCoin integration is handled at the platform level. You just need to connect your Stripe account to receive payouts.

**Q: When are DivinityCoin settlements paid?**
A: DivinityCoin settles with the platform on a regular schedule (typically weekly). Once received, creator payouts are processed within 2 business days via Stripe Connect.

**Q: What happens if a project fails?**
A: For DivinityCoin credit pledges, the held credits are released back to the backer's balance. For card payments, refunds are processed via Stripe.

### For Backers

**Q: What payment methods can I use?**
A: You have two options:
1. **Credit/Debit Card**: Pay directly via Stripe at checkout
2. **DivinityCoin Credits**: Use credits you've purchased at divinitycoin.com

**Q: What is DivinityCoin?**
A: DivinityCoin is a universal creator currency. You buy credits once at [divinitycoin.com](https://divinitycoin.com) and can use them to support creators across all partner platforms.

**Q: How do I use DivinityCoin credits?**
A:
1. Buy credits at [divinitycoin.com](https://divinitycoin.com) (pay with your card via Stripe)
2. You'll receive a redemption code (format: XXXX-XXXX-XXXX-XXXX)
3. Enter the code on this platform to add credits to your balance
4. Use your credits to back projects!

**Q: How do I redeem a DivinityCoin code?**
A:
1. Go to your account settings or the checkout page
2. Enter your 16-character code (e.g., ABCD-1234-EFGH-5678)
3. Credits are instantly added to your balance
4. You can now use them to back projects

**Q: What happens to my credits when I back a project?**
A: When you pledge using credits:
1. Credits are "held" (reserved) for your pledge
2. If the project funds successfully, credits are captured and sent to the creator
3. If the project fails, credits are released back to your available balance

**Q: Can I get a refund on DivinityCoin credits?**
A:
- **Unused credits**: Contact DivinityCoin support at divinitycoin.com for refund policies
- **Pledged credits (project funded)**: Contact the creator directly for refund requests
- **Pledged credits (project failed)**: Automatically returned to your balance

**Q: Do my DivinityCoin credits expire?**
A: Check DivinityCoin's terms at divinitycoin.com for credit expiration policies.

**Q: Can I check my credit balance?**
A: Yes! Your available balance and held balance are shown in your account dashboard and at checkout.

**Q: Why would I use DivinityCoin instead of a card?**
A: Benefits of DivinityCoin credits:
- **Support multiple creators**: Buy credits once, use across all partner platforms
- **Gift credits**: Buy credits as a gift for someone else
- **Budget control**: Pre-purchase credits to manage your backing budget
- **Privacy**: Your payment details stay with DivinityCoin, not shared with each platform

### For Platform Admins

**Q: How does DivinityCoin integration work?**
A:
1. Partner with DivinityCoin and receive API credentials
2. Integrate the API to validate codes, manage holds, and capture payments
3. DivinityCoin handles all credit purchases and holds funds
4. Receive weekly/monthly wire settlements (net of 6% fee)
5. Pay creators via Stripe Connect from settled funds

**Q: What's the settlement process?**
A:
1. Backers pledge using credits → holds placed via API
2. Project succeeds → captures sent via API
3. DivinityCoin generates settlement (weekly/monthly)
4. Wire transfer sent to platform (gross - 6% = net)
5. Platform pays creators via Stripe Connect (net - 5% platform fee)

---

## Questions for Product Team

Before starting development, clarify:

1. **Payment Processing Details**:
   - DivinityCoin partner application submitted?
   - API credentials received (production + sandbox)?
   - Settlement frequency preference (weekly/monthly)?

2. **Platform Fees**:
   - What percentage does the platform take?
   - How are fees calculated (on gross or net)?
   - Any fee variations by project type/category?

3. **Rewards/Add-ons**:
   - Can add-ons have quantity limits?
   - Can add-ons have delivery dates separate from main reward?
   - Can backers change add-on selections after pledging?

4. **Project Approval**:
   - Is there a manual review process?
   - What are approval criteria?
   - How long does approval take?

5. **Fulfillment**:
   - Is Easyship integration required or optional?
   - Any other fulfillment partners to integrate?
   - How are international shipping costs handled?

6. **Scalability**:
   - Expected number of concurrent users?
   - Expected number of projects?
   - Expected pledge volume?

---

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- DivinityCoin API key (sandbox for dev)
- AWS account (for S3)
- SendGrid account (for emails)

### Installation

```bash
# Clone repository
git clone <repo-url>
cd crowdfunding-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your values

# Set up database
npx prisma migrate dev
npx prisma generate
npx prisma db seed

# Run development server
npm run dev
```

### First Steps
1. Create admin user
2. Set up Stripe test mode and DivinityCoin sandbox
3. Create test project
4. Test pledge flow end-to-end
5. Verify webhooks work locally (use ngrok)

---

## Conclusion

This specification provides a complete blueprint for building a modern crowdfunding platform with:
- ✅ **Dual payment support** (Stripe for cards + DivinityCoin for credits)
- ✅ **No pay-over-time** (single payment only)
- ✅ **Copy rewards to add-ons** functionality
- ✅ **Comprehensive dashboard** and analytics
- ✅ **Full creator workflow** from project creation to fulfillment
- ✅ **Backer experience** with rewards and add-ons
- ✅ **Modern tech stack** (Next.js, TypeScript, Prisma, PostgreSQL)

This document is ready to hand off to Claude Code or any development team to start building immediately.

---

## Appendix

### Useful Links
- [Divinity Coin Developer Portal](https://divinitycoin.com/developers)
- [Stripe Documentation](https://stripe.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Shadcn/ui Components](https://ui.shadcn.com)
- [Recharts Documentation](https://recharts.org)

### Contact
For questions or clarifications during development:
- Product Manager: [email]
- Tech Lead: [email]
- Designer: [email]

---

**Document Version**: 2.0
**Last Updated**: December 2025
**Status**: Ready for Development
**Changes in v2.0**: Replaced CCBill with DivinityCoin credit-based payment system. Platform now supports dual payment methods (Stripe for direct card payments, DivinityCoin for universal creator credits).
