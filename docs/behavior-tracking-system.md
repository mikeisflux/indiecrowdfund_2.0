# Behavior Tracking System

A comprehensive guide to the user behavior tracking system in IndieCrowdfund.

## Overview

The behavior tracking system captures user interactions across the platform to enable:
- Personalized recommendations
- AI-powered marketing campaigns
- Conversion optimization
- User segmentation
- Analytics and insights

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Side                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │ TrackingProvider│───▶│  tracking.ts    │───▶│ /api/track  │ │
│  │   (React)       │    │  (Library)      │    │ (API Route) │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                        Server Side                               │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────┐ │
│  │  UserBehavior   │◀───│  Prisma DB      │◀───│ API Routes  │ │
│  │  (Model)        │    │  (PostgreSQL)   │    │             │ │
│  └─────────────────┘    └─────────────────┘    └─────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Admin Dashboard                             │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Behavior Tab    │◀───│ /behavior API   │                     │
│  │ (Real-time)     │    │ (Stats/Events)  │                     │
│  └─────────────────┘    └─────────────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Tracking Library (`/src/lib/tracking.ts`)

The core tracking library that handles all event capture and transmission.

#### Event Types

| Event Type | Description | Data Captured |
|------------|-------------|---------------|
| `PAGE_VIEW` | User visits a page | path, referrer |
| `PAGE_EXIT` | User leaves a page | path, timeSpent |
| `PROJECT_VIEW` | User views a project | projectId |
| `PROJECT_CLICK` | User clicks on a project card | projectId |
| `REWARD_CLICK` | User clicks on a reward tier | projectId, rewardId |
| `VIDEO_PLAY` | User starts watching video | projectId |
| `VIDEO_COMPLETE` | User finishes video | projectId |
| `SEARCH` | User performs a search | searchQuery |
| `FILTER_APPLY` | User applies a category filter | categoryId |
| `PROJECT_SAVE` | User saves a project | projectId |
| `PROJECT_SHARE` | User shares a project | projectId, platform |
| `COMMENT_POST` | User posts a comment | projectId |
| `PLEDGE_START` | User starts pledge flow | projectId, rewardId |
| `PLEDGE_COMPLETE` | User completes pledge | projectId, rewardId, amount |
| `SCROLL_DEPTH` | User scrolls to threshold | scrollDepth (25/50/75/90/100%) |
| `HOVER` | User hovers on project | projectId |
| `CREATOR_VIEW` | User views creator profile | creatorId |

#### Usage

```typescript
import { tracking } from '@/lib/tracking';

// Track a project view
tracking.projectView('project-id-123');

// Track a search
tracking.search('solar powered');

// Track pledge completion
tracking.pledgeComplete('project-id', 'reward-id', 50);

// Track scroll depth
tracking.scrollDepth(75, 'project-id');
```

#### Low-Level API

```typescript
import { trackEvent } from '@/lib/tracking';

// Custom event tracking
await trackEvent({
  eventType: 'PROJECT_VIEW',
  projectId: 'abc123',
  metadata: { source: 'homepage-featured' }
});
```

### 2. Tracking Provider (`/src/components/tracking-provider.tsx`)

A React component that automatically tracks page views, scroll depth, and time on page.

#### Automatic Tracking

When wrapped around your app, it automatically:
- Tracks page views on route changes
- Sets up scroll depth tracking (25%, 50%, 75%, 90%, 100%)
- Tracks time spent on each page
- Sends page exit events with duration

#### Usage

```tsx
// Already added to /src/app/layout.tsx
import { TrackingProvider } from '@/components/tracking-provider';

<TrackingProvider enabled={true}>
  {children}
</TrackingProvider>
```

#### Project-Specific Tracking Hook

```tsx
import { useProjectTracking } from '@/components/tracking-provider';

function ProjectPage({ projectId }) {
  const {
    trackRewardClick,
    trackVideoPlay,
    trackSave,
    trackShare,
    trackPledgeStart
  } = useProjectTracking(projectId);

  return (
    <button onClick={() => trackRewardClick('reward-123')}>
      Select Reward
    </button>
  );
}
```

#### Search Tracking Hook

```tsx
import { useSearchTracking } from '@/components/tracking-provider';

function SearchComponent() {
  const { trackSearch, trackFilterApply } = useSearchTracking();

  const handleSearch = (query) => {
    trackSearch(query);
    // ... perform search
  };
}
```

### 3. Tracking API (`/src/app/api/track/route.ts`)

The server endpoint that receives and stores tracking events.

#### Endpoint

```
POST /api/track
```

#### Request Body

```json
{
  "eventType": "PROJECT_VIEW",
  "sessionId": "session_1234567890_abc123def",
  "path": "/projects/my-project",
  "projectId": "clx123abc",
  "referrer": "https://google.com",
  "timeSpent": 45,
  "scrollDepth": 75,
  "metadata": {
    "source": "email-campaign"
  }
}
```

#### Response

```json
{
  "success": true
}
```

#### Features

- Automatically captures user agent and IP address
- Links to authenticated user if logged in
- Uses `sendBeacon` for reliable delivery on page unload
- Falls back to `fetch` with `keepalive` option

### 4. Database Model (`UserBehavior`)

Defined in `/prisma/schema.prisma`:

```prisma
model UserBehavior {
  id          String            @id @default(cuid())
  userId      String?           // Null for anonymous users
  sessionId   String            // Browser session identifier
  eventType   BehaviorEventType

  // Event context
  projectId   String?
  categoryId  String?
  rewardId    String?
  searchQuery String?

  // Page context
  path        String
  referrer    String?
  userAgent   String?
  ipAddress   String?
  country     String?

  // Engagement metrics
  timeSpent   Int?              // Seconds
  scrollDepth Float?            // 0-100 percentage

  metadata    Json?             // Additional custom data
  timestamp   DateTime @default(now())

  // Relations
  user        User?    @relation(fields: [userId], references: [id])
  project     Project? @relation(fields: [projectId], references: [id])

  @@index([userId, eventType, timestamp])
  @@index([sessionId])
  @@index([projectId, eventType])
}
```

### 5. Admin Behavior API (`/src/app/api/admin/ai-marketing/behavior/route.ts`)

Provides aggregated behavior data for the admin dashboard.

#### Endpoint

```
GET /api/admin/ai-marketing/behavior
```

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Max events to return (default: 50) |
| `eventType` | string | Filter by event type |
| `startDate` | ISO date | Filter events after this date |
| `endDate` | ISO date | Filter events before this date |

#### Response

```json
{
  "events": [
    {
      "id": "clx123abc",
      "sessionId": "session_12...",
      "eventType": "PROJECT_VIEW",
      "path": "/projects/my-project",
      "projectTitle": "My Amazing Project",
      "timestamp": "2024-01-15T10:30:00Z",
      "userName": "john_doe"
    }
  ],
  "stats": {
    "todayCount": 1234,
    "yesterdayCount": 1100,
    "weekCount": 8500,
    "trend": "+12.2%"
  },
  "eventTypeBreakdown": [
    { "eventType": "PAGE_VIEW", "count": 5000 },
    { "eventType": "PROJECT_VIEW", "count": 2000 }
  ],
  "topProjects": [
    { "projectId": "abc", "projectTitle": "Popular Project", "count": 500 }
  ],
  "topSearches": [
    { "query": "solar powered", "count": 150 }
  ]
}
```

## Session Management

Sessions are managed client-side using `sessionStorage`:

```typescript
function getSessionId(): string {
  let sessionId = sessionStorage.getItem('tracking_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('tracking_session_id', sessionId);
  }
  return sessionId;
}
```

- Session ID persists for the browser tab lifetime
- New tab = new session
- Closing and reopening browser = new session

## Data Flow

### 1. Page View Tracking

```
User navigates to /projects/abc
         │
         ▼
TrackingProvider detects route change
         │
         ▼
tracking.pageView() called
         │
         ▼
Event sent to /api/track via sendBeacon
         │
         ▼
API extracts session, user (if auth), metadata
         │
         ▼
UserBehavior record created in database
```

### 2. Scroll Depth Tracking

```
User scrolls page
         │
         ▼
setupScrollTracking() monitors scroll position
         │
         ▼
When crossing 25/50/75/90/100% threshold
         │
         ▼
tracking.scrollDepth(threshold) called
         │
         ▼
Event stored (each threshold tracked once per page)
```

### 3. Page Exit Tracking

```
User navigates away or closes tab
         │
         ▼
beforeunload/pagehide event fires
         │
         ▼
tracking.pageExit(timeSpent) called
         │
         ▼
sendBeacon ensures delivery even during unload
```

## Admin Dashboard Integration

The AI Marketing page (`/admin/ai-marketing`) displays behavior data in the "Behavior Tracking" tab:

### Stats Cards
- Today's events with trend percentage
- Weekly event totals
- Unique search queries count
- Top projects count

### Most Viewed Projects
Shows top 5 projects by engagement (views + clicks + pledge starts)

### Popular Searches
Shows top 5 search queries by frequency

### Real-Time Event Stream
Live feed of recent user events with:
- Time ago (e.g., "2s ago", "5m ago")
- Event type badge
- User identifier (name or session ID)
- Event details (project title, search query, etc.)

## Privacy Considerations

### Data Collected
- Page paths and referrers
- Project/reward interactions
- Search queries
- Scroll depth and time on page
- IP addresses (for geographic insights)
- User agents (for device/browser stats)

### Data NOT Collected
- Personal identifying information (beyond user ID if logged in)
- Form input contents (except search queries)
- Cross-site tracking
- Third-party cookies

### Compliance
- All data stored server-side in your database
- No third-party analytics services
- Easy to implement consent mechanisms
- Data retention configurable via admin settings

## Configuration

### Tracking Settings (Admin Dashboard)

| Setting | Description | Default |
|---------|-------------|---------|
| Track Page Views | Record page navigation | On |
| Track Scroll Depth | Record scroll milestones | Off |
| Track Time on Page | Record page duration | On |
| Track Clicks | Record click events | On |
| Track Video Engagement | Record video plays | Off |
| Track Abandoned Carts | Record pledge dropoffs | On |
| Data Retention | Days to keep data | 90 |

### Enabling/Disabling Tracking

```tsx
// Disable tracking for specific pages
<TrackingProvider enabled={false}>
  <PrivacyPolicyPage />
</TrackingProvider>
```

## Performance

### Optimizations

1. **sendBeacon API**: Used for fire-and-forget requests that survive page unload
2. **Passive scroll listeners**: `{ passive: true }` for smooth scrolling
3. **Threshold-based scroll tracking**: Only tracks at 25/50/75/90/100%, not continuously
4. **Session ID caching**: Stored in sessionStorage, not computed per event
5. **Silent failures**: Tracking errors don't interrupt user experience

### Database Indexes

```sql
-- Optimized queries for common access patterns
CREATE INDEX idx_user_event_time ON UserBehavior(userId, eventType, timestamp);
CREATE INDEX idx_session ON UserBehavior(sessionId);
CREATE INDEX idx_project_event ON UserBehavior(projectId, eventType);
```

## Extending the System

### Adding New Event Types

1. Add to Prisma enum:
```prisma
enum BehaviorEventType {
  // ... existing types
  NEW_EVENT_TYPE
}
```

2. Run migration:
```bash
npx prisma migrate dev
```

3. Add to tracking library:
```typescript
// In /src/lib/tracking.ts
export const tracking = {
  // ... existing methods
  newEvent: (data: string) => trackEvent({
    eventType: 'NEW_EVENT_TYPE',
    metadata: { data }
  }),
};
```

4. Update API validation:
```typescript
// In /src/app/api/track/route.ts
const validEventTypes = [
  // ... existing types
  'NEW_EVENT_TYPE',
];
```

### Custom Metadata

Pass arbitrary data via the `metadata` field:

```typescript
tracking.projectView('project-id');
// or with metadata:
trackEvent({
  eventType: 'PROJECT_VIEW',
  projectId: 'project-id',
  metadata: {
    source: 'email-campaign',
    campaignId: 'camp-123',
    variant: 'A'
  }
});
```

## Troubleshooting

### Events Not Recording

1. Check browser console for errors
2. Verify `/api/track` endpoint is accessible
3. Check database connection
4. Ensure TrackingProvider is in component tree

### Missing User Association

- User must be authenticated
- Session cookie must be valid
- Check auth middleware configuration

### High Database Growth

- Adjust data retention period in settings
- Set up a cron job to purge old records:
```sql
DELETE FROM UserBehavior WHERE timestamp < NOW() - INTERVAL '90 days';
```

## Related Files

| File | Description |
|------|-------------|
| `/src/lib/tracking.ts` | Core tracking library |
| `/src/components/tracking-provider.tsx` | React tracking component |
| `/src/app/api/track/route.ts` | Event ingestion API |
| `/src/app/api/admin/ai-marketing/behavior/route.ts` | Admin stats API |
| `/src/app/admin/ai-marketing/page.tsx` | Admin dashboard UI |
| `/prisma/schema.prisma` | Database model (UserBehavior) |
