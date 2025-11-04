# Indiecrowdfund - Comic Book & Graphic Novel Crowdfunding Platform

A comprehensive crowdfunding platform built with Next.js 14, specifically designed for comic books, graphic novels, manga, and indie comics creators.

## 🚀 Features

### ✅ Core Infrastructure (100% Complete)
- Next.js 14 with TypeScript and App Router
- Comprehensive Prisma database schema (15+ models)
- NextAuth.js authentication with session management
- shadcn/ui component library (10+ components)
- Tailwind CSS with custom theme
- Form validation with React Hook Form and Zod
- Toast notification system
- Environment-based configuration

### ✅ Authentication & User Management (100% Complete)
- User registration with email/username/password
- Login system with bcrypt password hashing
- Role-based access control (ADMIN, CREATOR, BACKER, COLLABORATOR)
- Protected routes and middleware
- Session-based authentication

### ✅ Project Builder (100% Complete)
Complete 6-step wizard for creating projects:
- **Step 1: Basics** - Title, category, funding goal, duration, media
- **Step 2: Rewards** - Managed in dashboard post-creation
- **Step 3: Story** - Rich text story, risks & challenges, AI disclosure
- **Step 4: People** - Managed in dashboard post-creation
- **Step 5: Payment** - Stripe/CCBill selection, contact email, project type
- **Step 6: Promotion** - Custom URL, Google Analytics, Meta Pixel
- Progress indicator and validation
- Draft saving to database
- Automatic slug generation

### ✅ Creator Dashboard (80% Complete)
Comprehensive project management with 5 tabs:
- **Overview Tab** - Funding metrics, recent activity, project stats
- **Rewards Tab** - Create/edit rewards, view reward details
- **Backers Tab** - Complete backer listing with payment status
- **Updates Tab** - Draft/publish updates, backers-only targeting
- **Settings Tab** - Project configuration and danger zone

### ✅ Public Pages (100% Complete)
- Homepage with hero section and category grid
- Explore page with category filtering
- Public project pages with full details
- Project cards with funding progress
- Creator profiles display
- Responsive design

### ✅ Payment Processing (100% Complete)
Dual payment processor support:
- **Stripe Integration** - Payment intents, refunds, webhooks
- **CCBill Integration** - For adult/restricted content, postback handling
- Unified payment API
- Automatic pledge creation
- Project stats updates
- Confirmation emails

### ✅ File Uploads (100% Complete)
UploadThing integration with 5 upload types:
- Project images (4MB max)
- Reward images (2MB max)
- User avatars (1MB max)
- Project gallery (10 images)
- PDF documents (5 files)

### ✅ Behavioral Tracking & Recommendations (100% Complete)
- Track 7 event types (VIEW, CLICK, SEARCH, WATCH, etc.)
- User behavior profiles
- Content-based filtering
- Collaborative filtering
- Personalized recommendations
- Category and project tracking

### ✅ Email System (100% Complete)
React Email templates with Resend:
- Welcome email on registration
- Pledge confirmation
- Project launched notification
- Project updates with draft support
- Backers-only vs public updates
- Automatic notifications to backers and watchers

### ✅ Rewards & Add-ons (100% Complete)
- Full CRUD API for rewards
- One-click copy reward to add-on
- Quantity tracking and limits
- Shipping configuration
- Image uploads
- Estimated delivery dates

### ✅ Project Updates (100% Complete)
- Draft saving capability
- Public vs backers-only targeting
- Automatic notifications on publish
- Email to all backers and watchers
- Update management interface

### ✅ Admin Panel (60% Complete)
- Platform metrics dashboard
- User management (view, statistics)
- Project management (view, statistics, approval workflow UI)
- Site settings (general, theme, SEO)
- Admin-only access control

### ✅ Analytics Dashboard (100% Complete)
- Comprehensive analytics with Recharts visualizations
- Funding progress chart (area chart with cumulative data)
- Daily activity chart (bar chart for daily pledges)
- Traffic sources pie chart
- Device breakdown analytics
- Top referrers tracking
- Reward performance metrics
- Geographic distribution of backers
- Export to CSV/JSON

### ✅ Backer Survey System (100% Complete)
- Survey builder with 6 question types:
  - Short text and long text
  - Dropdown, radio buttons, checkboxes
  - Full address collection
- Drag-and-drop question ordering
- Required field validation
- Survey activation/deactivation
- Response collection from backers
- View individual responses
- Export responses to CSV
- Email integration for survey notifications

### ✅ Messaging System (100% Complete)
- Direct messaging between creators and backers
- Threaded conversations
- Unread message badges
- Mark messages as read
- Real-time message sending
- User-friendly chat interface

### ✅ Search & Discovery (100% Complete)
- Full-text search across title, tagline, and story
- Category filtering
- Sort options (relevance, popular, funded, ending soon, newest)
- Dedicated category pages for all 8 categories
- Enhanced explore page with three sections:
  - Staff Picks (featured projects)
  - Trending Now (popular this week)
  - Successfully Funded (reached goal)

### ✅ User Profiles (100% Complete)
- Public user profile pages
- Statistics cards (projects created, total funded, projects backed)
- Tabs for created and backed projects
- Full project cards with funding progress

### ✅ Email Admin Interface (100% Complete)
- Template management for all email types
- SMTP configuration (Resend, SendGrid, custom SMTP)
- Test email sending
- Email delivery logs with metrics
- From/reply-to email settings
- Notification preferences

### ✅ Payout Management (100% Complete)
- Request payouts from funded projects
- Financial summary dashboard (total raised, paid out, pending, available)
- Payout history with status tracking
- Validation for sufficient funds
- Bank account information collection
- Admin approval workflow

### ✅ Watchlist Feature (100% Complete)
- Add/remove projects from watchlist
- View all saved projects
- Receive notifications for watched projects

### 🔨 In Progress / Planned
- Testing and optimization
- Performance improvements
- Additional admin features
- Mobile app development

## 🛠 Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- shadcn/ui (Radix UI components)
- React Hook Form + Zod
- Zustand (state management)
- Recharts (data visualization)

**Backend:**
- Next.js API Routes
- Prisma ORM
- PostgreSQL
- NextAuth.js
- Resend (email)
- UploadThing (file uploads)

**Payments:**
- Stripe
- CCBill

**Analytics:**
- Google Analytics
- Meta Pixel

## 📋 Database Schema

The platform includes comprehensive models for:
- Users (with role-based access)
- Projects (with 6-step builder data)
- Rewards & Add-ons
- Pledges & Payments
- Surveys & Responses
- Updates & Messages
- Collaborators & Permissions
- Payouts
- Behavioral Logs & Analytics
- Admin settings (Site Settings, Audit Logs, Static Pages, Email Templates)

## 🎯 Categories

The platform is focused exclusively on:
- Comic Books
- Graphic Novels
- Manga
- Webcomics
- Indie Comics
- Anthology
- Art Books
- Zines

## 🔧 Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL database
- (Optional) Redis for caching

### Installation

1. Clone the repository:
\`\`\`bash
git clone <repository-url>
cd indiecrowdfund_2.0
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Set up environment variables:
\`\`\`bash
cp .env.example .env
\`\`\`

Edit `.env` with your credentials:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - Random secret for NextAuth
- `STRIPE_SECRET_KEY` - Stripe API key
- `CCBILL_MERCHANT_ACCOUNT` - CCBill credentials
- `UPLOADTHING_SECRET` - UploadThing API key
- `RESEND_API_KEY` - Resend API key for emails

4. Run database migrations:
\`\`\`bash
npx prisma migrate dev
\`\`\`

5. Seed the database (optional):
\`\`\`bash
npx prisma db seed
\`\`\`

6. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

7. Open [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

\`\`\`
├── app/                    # Next.js 14 app directory
│   ├── (auth)/            # Auth pages (login, register)
│   ├── (dashboard)/       # Creator dashboard pages
│   ├── (admin)/           # Admin panel pages
│   ├── (public)/          # Public project pages
│   ├── api/               # API routes
│   └── page.tsx           # Homepage
├── components/
│   ├── ui/                # shadcn/ui components
│   ├── auth/              # Auth-specific components
│   ├── project/           # Project builder components
│   ├── dashboard/         # Dashboard components
│   └── admin/             # Admin panel components
├── lib/
│   ├── db.ts              # Prisma client
│   ├── auth.ts            # NextAuth configuration
│   ├── utils.ts           # Utility functions
│   ├── validations.ts     # Zod schemas
│   └── payments/          # Payment processor integrations
├── hooks/                 # Custom React hooks
├── prisma/
│   └── schema.prisma      # Database schema
└── public/                # Static assets
\`\`\`

## 🎨 Key Features Detail

### Multi-Step Project Builder
1. **Basics**: Title, category, funding goal, campaign duration
2. **Rewards**: Tiered rewards with shipping, quantity limits
3. **Add-ons**: Optional extras with "copy from rewards" feature
4. **Items**: Individual products within rewards
5. **Story**: Rich text editor, risks, AI disclosure, FAQs
6. **People**: Creator profile, collaborator management
7. **Payment**: Processor selection (Stripe/CCBill), bank setup
8. **Promotion**: Custom URL, analytics integration

### Creator Dashboard (8 Tabs)
- Overview: Funding metrics, charts, backer sources
- Activity: Real-time feed, video analytics
- Analytics: Advanced metrics, channel analysis
- Fulfillment: Easyship integration, shipping tracking
- Updates: Draft and publish announcements
- Messages: Backer communication
- Payouts: Transaction history
- Collaborators: Permission management

### Admin Panel
Complete backend control including:
- User management (edit, suspend, roles)
- Project management (approve, feature, suspend)
- Site appearance (themes, colors, custom CSS)
- Content management (pages, terms, privacy)
- Email templates
- Payment configuration
- Analytics dashboard
- Category management
- Fee configuration
- API & webhook management
- Security & audit logs
- SEO management

### Payment Processing
- Dual processor support (Stripe & CCBill)
- Content-based processor selection
- Unified payment interface
- Webhook handling for both processors
- PCI-DSS compliance

### Recommendation Engine
- Behavioral tracking (views, clicks, searches)
- Content-based filtering
- Collaborative filtering
- Personalized project recommendations
- Email notification system

## 📊 Analytics Integration

- Google Analytics tracking
- Meta Pixel integration
- Custom referral tag tracking
- Channel analysis (Desktop, Mobile, iOS)
- Video play analytics
- Backer source tracking

## 🔐 Security

- bcrypt password hashing
- NextAuth.js session management
- Role-based access control (RBAC)
- Input validation with Zod
- SQL injection prevention (Prisma)
- CSRF protection
- Audit logging

## 🚢 Deployment

The platform is designed for deployment on:
- **Hosting**: Vercel (recommended)
- **Database**: Vercel Postgres, Supabase, or any PostgreSQL host
- **File Storage**: UploadThing or AWS S3

### Production Deployment

1. Set up production database
2. Configure environment variables in hosting platform
3. Deploy via Git integration
4. Run migrations in production
5. Configure custom domain

## 📝 API Documentation

### Authentication Routes
- `POST /api/auth/register` - User registration
- `POST /api/auth/[...nextauth]` - NextAuth.js authentication

### Project Routes
- `GET /api/projects` - List projects with filters (category, status, limit)
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]/rewards` - Get project rewards
- `POST /api/projects/[id]/rewards` - Create reward
- `GET /api/projects/[id]/addons` - Get project add-ons
- `POST /api/projects/[id]/addons` - Create add-on
- `GET /api/projects/[id]/updates` - Get project updates
- `POST /api/projects/[id]/updates` - Create/publish update
- `PATCH /api/projects/[id]/updates/[updateId]` - Update existing update
- `DELETE /api/projects/[id]/updates/[updateId]` - Delete update

### Reward Routes
- `POST /api/rewards/[id]/copy-to-addon` - Copy reward to add-on

### Payment Routes
- `POST /api/payments/stripe/intent` - Create Stripe payment intent
- `POST /api/payments/ccbill/url` - Generate CCBill payment URL

### Webhook Routes
- `POST /api/webhooks/stripe` - Stripe webhook handler
- `POST /api/webhooks/ccbill` - CCBill postback handler

### Behavioral Tracking
- `POST /api/tracking` - Track user behavior events
- `GET /api/recommendations` - Get personalized recommendations

### File Upload
- `POST /api/uploadthing` - Handle file uploads (UploadThing)

### Survey Routes
- `GET /api/projects/[id]/surveys` - Get all surveys for a project
- `POST /api/projects/[id]/surveys` - Create a new survey
- `GET /api/projects/[id]/surveys/[surveyId]` - Get survey details
- `PATCH /api/projects/[id]/surveys/[surveyId]` - Update survey
- `DELETE /api/projects/[id]/surveys/[surveyId]` - Delete survey
- `GET /api/surveys/[surveyId]` - Get public survey details
- `GET /api/surveys/[surveyId]/responses` - Get survey responses (creators only)
- `POST /api/surveys/[surveyId]/responses` - Submit survey response (backers)
- `GET /api/surveys/[surveyId]/export` - Export responses to CSV

### Message Routes
- `GET /api/messages` - Get all conversations or specific thread messages
- `POST /api/messages` - Send a new message
- `PATCH /api/messages` - Mark messages as read

### Search Routes
- `GET /api/search` - Search projects with filters (query, category, sortBy, status)

### Watchlist Routes
- `GET /api/watchlist` - Get user's watchlist
- `POST /api/watchlist` - Add project to watchlist
- `DELETE /api/watchlist?projectId=[id]` - Remove from watchlist

### Analytics Routes
- `GET /api/projects/[id]/analytics` - Get comprehensive project analytics
- `GET /api/recommendations` - Get personalized project recommendations

### Payout Routes
- `GET /api/projects/[id]/payouts` - Get all payouts for a project
- `POST /api/projects/[id]/payouts` - Request a new payout

### User Routes
- `GET /api/user/pledges` - Get user's pledges

## 🤝 Contributing

This is a private project for Indiecrowdfund. Please refer to the contributing guidelines before making changes.

## 📄 License

Proprietary - All rights reserved

## 🐛 Known Issues & Roadmap

See `implementation.md` for detailed implementation status and roadmap.

## 💬 Support

For technical support or questions, please contact the development team.

---

**Version**: 1.0.0 (In Development)
**Last Updated**: November 4, 2025
