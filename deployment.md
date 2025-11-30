# IndieCrowdfund - Deployment Guide

This document provides comprehensive instructions for deploying the IndieCrowdfund platform to production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Setup](#database-setup)
4. [Authentication Configuration](#authentication-configuration)
5. [Payment Processing Setup](#payment-processing-setup)
6. [Deployment Options](#deployment-options)
7. [Post-Deployment Tasks](#post-deployment-tasks)
8. [Monitoring & Maintenance](#monitoring--maintenance)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

- **Node.js**: v18.17.0 or higher (LTS recommended)
- **npm**: v9.0.0 or higher (or yarn/pnpm)
- **PostgreSQL**: v14.0 or higher
- **Git**: v2.30.0 or higher

### Accounts Required

- **Vercel/Railway/AWS/DigitalOcean** account (for hosting)
- **PostgreSQL** hosting (Supabase, PlanetScale, Neon, Railway, or self-hosted)
- **Stripe** account (for standard payment processing)
- **CCBill** merchant account (for adult/NSFW content - NSFW-friendly)
- **SendGrid/Resend** account (for transactional emails)
- **Cloudinary/AWS S3** account (for media storage)
- **Google Cloud** account (optional, for analytics)
- **Meta/Facebook** developer account (optional, for pixel tracking)

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/indiecrowdfund.git
cd indiecrowdfund
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Environment Variables

Create a `.env` file in the root directory. Use `.env.example` as a template:

```bash
cp .env.example .env
```

Configure the following environment variables:

```env
# ===================
# Application
# ===================
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NODE_ENV=production

# ===================
# Database (PostgreSQL)
# ===================
DATABASE_URL="postgresql://user:password@host:5432/indiecrowdfund?schema=public"

# ===================
# Authentication (NextAuth.js)
# ===================
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=your-super-secret-key-min-32-chars

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret

# ===================
# Payment Processing
# ===================
# Stripe (Standard Projects)
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# CCBill (Adult/NSFW Content - NSFW-Friendly Processor)
CCBILL_ACCOUNT_NUMBER=your-account-number
CCBILL_SUBACCOUNT_NUMBER=your-subaccount
CCBILL_FLEX_FORM_ID=your-flex-form-id
CCBILL_SALT=your-ccbill-salt
CCBILL_WEBHOOK_SECRET=your-webhook-secret

# ===================
# Email Service
# ===================
# SendGrid
SENDGRID_API_KEY=SG.xxx
EMAIL_FROM=noreply@yourdomain.com

# OR Resend
RESEND_API_KEY=re_xxx

# ===================
# File Storage
# ===================
# Cloudinary
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

# OR AWS S3
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket-name

# ===================
# Analytics (Optional)
# ===================
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
NEXT_PUBLIC_META_PIXEL_ID=your-pixel-id

# ===================
# Retailer Portal JWT
# ===================
RETAILER_JWT_SECRET=your-retailer-jwt-secret-min-32-chars

# ===================
# AI Features (Optional)
# ===================
OPENAI_API_KEY=sk-xxx
```

### Important Security Notes

- Never commit `.env` files to version control
- Use strong, unique secrets for all keys
- Rotate secrets periodically
- Use environment-specific variables for staging/production

---

## Database Setup

### 1. Create PostgreSQL Database

Using your preferred PostgreSQL provider, create a new database.

**Supabase Example:**
1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > Database
3. Copy the connection string (use "Direct connection" for migrations)

**Neon Example:**
1. Create a new project at [neon.tech](https://neon.tech)
2. Copy the connection string from the dashboard

### 2. Run Prisma Migrations

```bash
# Generate Prisma client
npx prisma generate

# Run migrations (creates all tables)
npx prisma migrate deploy

# (Optional) Seed the database with sample data
npx prisma db seed
```

### 3. Verify Database

```bash
# Open Prisma Studio to verify tables
npx prisma studio
```

### Database Schema Overview

The platform includes the following main tables:

- **Users & Auth**: User, Account, Session, VerificationToken
- **Projects**: Project, Reward, RewardItem, ProjectMedia, ProjectTag
- **Pledges**: Pledge, PledgeReward, Referral
- **Reviews**: ProjectReview
- **Retailers**: Retailer, RetailerPledge
- **Analytics**: PageView, Event, Recommendation
- **Admin**: Email campaigns, Settings, Pages

---

## Authentication Configuration

### NextAuth.js Setup

1. Generate a secure secret:

```bash
openssl rand -base64 32
```

2. Configure OAuth providers in your `.env`

3. Set callback URLs in each OAuth provider:
   - Google: `https://yourdomain.com/api/auth/callback/google`
   - GitHub: `https://yourdomain.com/api/auth/callback/github`
   - Discord: `https://yourdomain.com/api/auth/callback/discord`

### Email Authentication

Email verification is handled automatically. Ensure your email service is configured correctly.

---

## Payment Processing Setup

### Stripe Configuration

1. **Create Stripe Account**: Sign up at [stripe.com](https://stripe.com)

2. **Get API Keys**: Dashboard > Developers > API keys
   - Use test keys for development (`sk_test_xxx`, `pk_test_xxx`)
   - Use live keys for production (`sk_live_xxx`, `pk_live_xxx`)

3. **Configure Webhooks**:
   - Go to Developers > Webhooks
   - Add endpoint: `https://yourdomain.com/api/webhooks/stripe`
   - Select events:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `charge.refunded`
     - `customer.subscription.updated`
   - Copy webhook signing secret

4. **Enable Stripe Connect** (for creator payouts):
   - Enable Connect in your Stripe dashboard
   - Configure onboarding settings

### CCBill Configuration (NSFW-Friendly)

CCBill is our NSFW-friendly payment processor, ensuring no payment disruptions for adult content creators.

1. **Apply for CCBill Merchant Account**: [ccbill.com](https://www.ccbill.com)
   - CCBill specializes in adult/high-risk content
   - No unexpected account shutdowns for NSFW content
   - Industry-leading chargeback protection

2. **Configure FlexForms**:
   - Create a FlexForm in CCBill admin
   - Set approval/denial URLs
   - Configure webhook URL: `https://yourdomain.com/api/webhooks/ccbill`

3. **Get Credentials**:
   - Account number
   - Subaccount number
   - FlexForm ID
   - Salt key (for dynamic pricing)

4. **Webhook Events**:
   - NewSaleSuccess
   - Cancellation
   - Refund
   - Chargeback

---

## Deployment Options

### Option 1: Vercel (Recommended)

1. **Connect Repository**:
```bash
npm i -g vercel
vercel login
vercel
```

2. **Configure Project**:
   - Framework: Next.js
   - Build command: `npm run build`
   - Output directory: `.next`

3. **Add Environment Variables**:
   - Go to Project Settings > Environment Variables
   - Add all variables from your `.env` file

4. **Deploy**:
```bash
vercel --prod
```

### Option 2: Railway

1. **Create Project**: [railway.app](https://railway.app)

2. **Add Services**:
   - Add PostgreSQL service (or use external)
   - Add application from GitHub

3. **Configure Variables**: Add all environment variables

4. **Deploy**: Automatic on push to main branch

### Option 3: Docker

1. **Build Image**:
```bash
docker build -t indiecrowdfund .
```

2. **Run Container**:
```bash
docker run -p 3000:3000 \
  --env-file .env \
  indiecrowdfund
```

3. **Docker Compose** (with PostgreSQL):
```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/indiecrowdfund
    depends_on:
      - db

  db:
    image: postgres:15
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=indiecrowdfund
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

### Option 4: AWS/DigitalOcean

1. **Setup Server**: EC2, Lightsail, or Droplet with Ubuntu

2. **Install Dependencies**:
```bash
# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PM2
npm install -g pm2
```

3. **Deploy Application**:
```bash
git clone https://github.com/your-org/indiecrowdfund.git
cd indiecrowdfund
npm install
npm run build
pm2 start npm --name "indiecrowdfund" -- start
```

4. **Configure Nginx**:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

5. **SSL with Certbot**:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Post-Deployment Tasks

### 1. Run Database Migrations

```bash
npx prisma migrate deploy
```

### 2. Create Admin User

```bash
npx prisma db seed
# Or manually create via Prisma Studio
```

### 3. Configure DNS

Point your domain to your deployment:
- A record: `@` → Server IP
- CNAME record: `www` → `yourdomain.com`

### 4. Verify Webhooks

Test webhook endpoints:
```bash
# Stripe
stripe trigger payment_intent.succeeded

# CCBill - Use CCBill test mode
```

### 5. Setup Monitoring

- Enable error tracking (Sentry, LogRocket)
- Configure uptime monitoring (UptimeRobot, Pingdom)
- Set up log aggregation (Papertrail, LogDNA)

---

## Monitoring & Maintenance

### Health Checks

The platform includes a health check endpoint:
```
GET /api/health
```

### Database Backups

**Automated Backups** (recommended):
- Supabase: Automatic daily backups
- Neon: Point-in-time recovery
- Railway: Automatic backups

**Manual Backup**:
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Performance Monitoring

1. **Vercel Analytics**: Enable in project settings
2. **Database Monitoring**: Use provider dashboard
3. **APM**: New Relic, Datadog, or similar

### Log Management

```bash
# View PM2 logs
pm2 logs indiecrowdfund

# View systemd logs
journalctl -u indiecrowdfund -f
```

---

## Troubleshooting

### Common Issues

#### Database Connection Errors

```
Error: Can't reach database server
```

**Solution**:
- Verify DATABASE_URL is correct
- Check database server is running
- Ensure IP whitelist includes your server

#### Authentication Failures

```
Error: OAuth error callback
```

**Solution**:
- Verify callback URLs match exactly
- Check OAuth credentials are correct
- Ensure NEXTAUTH_URL matches your domain

#### Payment Processing Issues

**Stripe**:
- Check webhook signature
- Verify API keys are for correct environment
- Ensure webhook events are configured

**CCBill**:
- Verify FlexForm configuration
- Check salt key is correct
- Ensure webhook URL is accessible

#### Build Failures

```
Error: Build optimization failed
```

**Solution**:
- Clear `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check for TypeScript errors: `npm run type-check`

### Getting Help

- **Documentation**: Check `/docs` folder
- **GitHub Issues**: Open an issue for bugs
- **Support**: support@indiecrowdfund.com

---

## Security Checklist

Before going live, ensure:

- [ ] All environment variables are set
- [ ] Database is secured with strong password
- [ ] HTTPS is enabled (SSL certificate)
- [ ] Stripe is in live mode (not test)
- [ ] CCBill is configured for production
- [ ] Admin accounts have strong passwords
- [ ] Webhook secrets are configured
- [ ] Rate limiting is enabled
- [ ] CORS is properly configured
- [ ] File upload restrictions are in place
- [ ] Error messages don't leak sensitive info
- [ ] Regular backup schedule is configured

---

## Scaling Considerations

### Horizontal Scaling

- Use load balancer for multiple instances
- Configure session storage (Redis)
- Use CDN for static assets

### Database Optimization

- Add indexes for frequently queried columns
- Use connection pooling (PgBouncer)
- Consider read replicas for high traffic

### Caching

- Enable Next.js ISR for static pages
- Use Redis for session/API caching
- Configure CDN for media files

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2024-01-15 | Initial release |
| 1.1.0 | 2024-01-20 | Added retailer module |
| 1.2.0 | 2024-01-27 | Added NSFW-friendly billing section |

---

*Last updated: November 2024*
