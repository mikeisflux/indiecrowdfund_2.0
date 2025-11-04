# Indiecrowdfund - Comic Book & Graphic Novel Crowdfunding Platform

A comprehensive crowdfunding platform built with Next.js 14, specifically designed for comic books, graphic novels, manga, and indie comics creators.

## 🚀 Features

### Completed
- ✅ Next.js 14 project structure with TypeScript
- ✅ Prisma schema with complete database models
- ✅ Tailwind CSS + shadcn/ui components
- ✅ Authentication system (NextAuth.js with credentials provider)
- ✅ User registration and login pages
- ✅ Homepage with categories and hero section
- ✅ Base layout and navigation
- ✅ Toast notifications system
- ✅ Comprehensive validations with Zod

### In Progress (See implementation.md for detailed checklist)
- 🔨 Multi-step project builder (6 steps)
- 🔨 Project dashboard (8 tabs)
- 🔨 Admin panel (comprehensive backend management)
- 🔨 Payment processing (Stripe & CCBill)
- 🔨 Behavioral tracking & recommendations
- 🔨 Email notification system
- 🔨 File upload system
- 🔨 API routes for all functionality

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

API routes are organized as:
- `/api/auth/*` - Authentication
- `/api/projects/*` - Project CRUD
- `/api/rewards/*` - Rewards management
- `/api/addons/*` - Add-ons management
- `/api/pledges/*` - Pledge processing
- `/api/payments/*` - Payment handling
- `/api/admin/*` - Admin operations

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
