'use client';

import { useState } from 'react';
import {
  Lightbulb,
  Gift,
  BookOpen,
  Users,
  CreditCard,
  Megaphone,
  ShoppingBag,
  ShieldCheck,
  Info,
  ArrowLeft,
  AlertCircle,
  Rocket,
  Activity,
  Package,
} from 'lucide-react';
import Link from 'next/link';
import { Footer } from "@/components/footer";

const tabs = [
  { id: 'verification', label: 'Verification', icon: ShieldCheck },
  { id: 'basics', label: 'Project Basics', icon: Lightbulb },
  { id: 'rewards', label: 'Rewards & Add-ons', icon: Gift },
  { id: 'story', label: 'Story', icon: BookOpen },
  { id: 'people', label: 'People', icon: Users },
  { id: 'payment', label: 'Payment', icon: CreditCard },
  { id: 'promotion', label: 'Promotion', icon: Megaphone },
  { id: 'launch', label: 'Submit & Launch', icon: Rocket },
  { id: 'manage', label: 'During the Campaign', icon: Activity },
  { id: 'after-funding', label: 'After Funding', icon: Package },
  { id: 'marketplace', label: 'Digital Marketplace', icon: ShoppingBag },
];

interface FieldInfo {
  name: string;
  required: boolean;
  description: string;
  tips?: string;
}

const tabContent: Record<string, { title: string; description: string; fields: FieldInfo[] }> = {
  'verification': {
    title: 'Creator Verification & Due Diligence',
    description: 'Before your campaign can go live, our admin team reviews your account. This protects backers and keeps the platform trustworthy. Plan for 2-5 business days from submission to approval.',
    fields: [
      { name: 'Government-Issued Photo ID', required: true, description: 'New creators upload a clear photo of a government-issued ID — driver\'s license, passport, or state ID. The image must be readable and the document must not be expired.', tips: 'Take the photo on a flat, dark surface in good light so all four corners and the photo are visible. Returning creators with already-verified accounts may skip this step.' },
      { name: 'Business Filing', required: true, description: 'Provide a current business filing from your state\'s Secretary of State office. Examples: LLC articles of organization, business registration certificate, DBA filing.', tips: 'If you operate as a sole proprietor, a DBA ("Doing Business As") filing is acceptable. The document must be current and verifiable through the state office.' },
      { name: 'Social Media Accounts', required: true, description: 'Link your active social media accounts (Twitter/X, Instagram, YouTube, TikTok, etc.) to your creator profile. Our team logs and verifies each one for authenticity and consistency.', tips: 'Link your most active and professional accounts. Accounts with established history (older posts, real engagement) strengthen your application.' },
      { name: 'Cross-Platform Campaign Audit', required: true, description: 'Our team searches Kickstarter, Indiegogo, GoFundMe, and other crowdfunding platforms to review your prior campaign history. We look at backer reviews, comments, public feedback, and fulfillment track record.', tips: 'Be transparent about previous campaigns up front — proactively disclose any past delays or issues. Honesty during review is valued and shortens the back-and-forth.' },
      { name: 'Fulfillment History Check', required: true, description: 'We validate your fulfillment history by reviewing backer feedback across all platforms. We may contact prior creators or backers directly if we see discrepancies. Findings are documented internally.', tips: 'If you had fulfillment delays on past projects, prepare a short written summary explaining the circumstances and how you resolved them.' },
      { name: 'Automatic Disqualification Rules', required: false, description: 'Two rules trigger automatic disqualification: (1) three or more unfulfilled campaigns on any platform, OR (2) any single campaign more than one year past its stated delivery date regardless of fulfillment status. These apply across ALL platforms, not just IndieCrowdfund.', tips: 'There are no exceptions. If you fall under these rules, contact support before submitting — sometimes there are extenuating circumstances we can document.' },
      { name: 'Payout Account Verification', required: true, description: 'Add the bank account where IndieCrowdfund will deposit your campaign earnings. The platform collects all pledges and pays out your net (gross minus fees) directly to this account — no PayPal account required even for PayPal-processor campaigns.', tips: 'Open Dashboard → Settings → Payments to add bank routing + account number. Encrypted at rest with AES-256. You can update this later but the new account must also be verified.' },
      { name: 'Internal Review & Outcome', required: false, description: 'All findings, correspondence, and decisions are documented internally for compliance and audit. Approval typically takes 2-5 business days.', tips: 'You\'ll get an email when your account is approved or if our team needs more information. Until then, you can build your project draft but cannot submit for launch.' },
    ]
  },
  'basics': {
    title: 'Step 1: Project Basics',
    description: 'The foundation of your campaign. This information shows up on your project page, in search results, and in social previews. Most can be edited until you submit; some lock at launch.',
    fields: [
      { name: 'Project Title', required: true, description: 'The name of your project. Shown everywhere — project page header, search results, social shares. Locked once the campaign launches.', tips: 'Aim for 5-10 words. Be specific. "The Quiet Forest: A Solo Tabletop RPG" is better than "Cool New RPG". Include keywords backers might search for.' },
      { name: 'Subtitle / Tagline', required: false, description: 'A one-line elevator pitch shown right under the title. Best for clarifying the genre or hook ("A noir comic about a cat detective").', tips: 'Use it to fill in details the title cannot. If your title is poetic, use the subtitle to be concrete.' },
      { name: 'Category', required: true, description: 'The primary category for your project (Comics, Books, Film, Music, Tabletop, Video Games, etc.). Backers filter Discover by category, so picking right matters for discoverability.', tips: 'Choose the most specific category that fits. Cross-genre? Pick the one with the strongest niche audience.' },
      { name: 'Location', required: true, description: 'Where YOU (the creator) are based. This sets shipping origin defaults and tax expectations.', tips: 'Be accurate. International backers see this and use it to estimate shipping time.' },
      { name: 'Project Image (Hero)', required: true, description: 'The main image that represents your project. Shown on Discover cards, search results, and the top of the project page. Minimum 1024x576px (16:9). Make sure it looks good cropped to a square for thumbnails.', tips: 'High-quality. Show your product clearly. If you have art or a hero shot, use it. Do not use blurry phone photos.' },
      { name: 'Project Video', required: false, description: 'A YouTube or Vimeo video that plays at the top of your project page. Optional, but campaigns with a video raise 2-3x more on average.', tips: 'Keep it under 3 minutes. Show yourself, show your product, explain the pitch in one sentence in the first 10 seconds. Even a phone selfie video is better than no video.' },
      { name: 'Funding Goal', required: true, description: 'The minimum dollar amount you need to make the project happen. For All-or-Nothing campaigns, you only get the money if you reach this goal.', tips: 'Calculate ALL real costs: production, packaging, shipping, processing fees (~7.5% combined platform + processor), the 10% rolling reserve held for 180 days, taxes. Set the goal at the bare minimum that lets you ship — set it higher and you risk not funding; set it lower and you risk losing money on fulfillment.' },
      { name: 'Campaign Duration', required: true, description: 'How long the campaign runs. Either fixed days (1-60) or a specific end date.', tips: '30 days is the sweet spot. Day 1 and the last 48 hours drive most pledges; the middle is quiet. Shorter campaigns create urgency, but you need an audience to support a sprint.' },
      { name: 'Target Launch Date', required: false, description: 'When you plan to go live. This is for your planning — it does not auto-launch the campaign. You manually click Launch after approval.', tips: 'Tuesday or Wednesday at 10am-2pm in your audience\'s timezone has the highest day-1 backers. Avoid major holidays.' },
    ]
  },
  'rewards': {
    title: 'Step 2: Rewards & Add-ons',
    description: 'Reward tiers are the menu of "what backers get for what they pledge." Add-ons are extras backers can buy on top of their tier — they show up in the post-campaign survey.',
    fields: [
      { name: 'Reward Title', required: true, description: 'A short name for the tier. Backers see this prominently on the right side of the project page.', tips: 'Concrete + descriptive: "Hardcover Edition", "Collector\'s Bundle", "Early Bird Hardcover (first 100)". Avoid vague names like "Tier 2".' },
      { name: 'Description', required: true, description: 'Rich-text description of everything the tier includes. Use bullet points or a numbered list. Include images of each item if possible.', tips: 'List every item. Be specific about colors, sizes, signatures, edition numbers. Backers compare tiers carefully — a great description converts.' },
      { name: 'Pledge Amount', required: true, description: 'The minimum a backer must pledge to receive this tier. Each tier has a single price.', tips: 'Price to cover production cost + per-unit shipping + a margin for fees. Even out-of-pocket costs add up — calculate what 1,000 of these costs you and divide.' },
      { name: 'Reward Image', required: false, description: 'A photo or mockup of what backers receive at this tier. Shown on the tier card.', tips: 'Even a low-fi mockup outperforms no image. Use Photoshop, Procreate, or even a phone photo. Multiple items? Lay them out flat and shoot top-down.' },
      { name: 'Estimated Delivery', required: true, description: 'Month and year when you expect to ship this tier. Shown on the tier card and the project page.', tips: 'Build in buffer time. Better to deliver a month early than three months late. Production almost always slips — assume 2-3 month buffer.' },
      { name: 'Shipping Options', required: true, description: 'Where you can ship this tier: worldwide, specific countries, local pickup, digital-only. Set base rates per region in the post-campaign survey setup.', tips: 'International shipping is expensive — research real carrier rates before promising worldwide shipping. Charging the actual cost is fine.' },
      { name: 'Quantity Limits', required: false, description: 'Optional cap on how many backers can claim this tier. Once claimed, the tier shows "X of Y remaining" or marks itself sold-out.', tips: 'Limited tiers create urgency and exclusivity. "Early Bird" with a 100-backer cap is a classic. Don\'t set caps so low they sell out before your audience sees them.' },
      { name: 'Add-ons', required: false, description: 'Optional extras backers can purchase on top of their tier. Add-ons appear in the post-campaign survey, not at pledge time. Examples: extra copies, sticker pack, T-shirt, signed bookplate.', tips: 'Price add-ons slightly higher than the equivalent tier value — they have lower fixed marketing cost. Add-ons can add 10-30% to total revenue.' },
    ]
  },
  'story': {
    title: 'Step 3: Story',
    description: 'The pitch. The "why this project matters" page. Backers spend 30 seconds skimming and a few minutes reading the parts that hook them — make every section count.',
    fields: [
      { name: 'Project Description', required: true, description: 'The main pitch. Use the rich-text editor. You can add headings, paragraphs, images, embedded video, bullet points. Length varies by category — books often have 1500-2500 words, comics often less, tabletop more.', tips: 'Structure: (1) one-sentence hook at the top, (2) hero shot of the product, (3) the story behind it, (4) what backers get, (5) detailed specs / sample pages, (6) addressing concerns, (7) a clear call to action at the bottom.' },
      { name: 'Risks & Challenges', required: true, description: 'Required section disclosing what could go wrong and how you\'ll handle it. Things like manufacturing delays, supply chain, your relevant experience.', tips: 'Honesty here builds credibility, not the opposite. Vague risks ("we might be late") are weaker than specific ones ("our printer\'s lead time is 8 weeks, we have buffer for 12"). Backers who read this are sophisticated.' },
      { name: 'AI Usage Disclosure', required: true, description: 'Required disclosure: does your project involve AI-generated content, AI tools, or AI in any creative capacity? Includes art, writing, voice, code, marketing materials.', tips: 'Be transparent. Backers care a lot. AI-assisted vs. AI-generated vs. no-AI are all valid choices, but be honest about which one applies.' },
      { name: 'FAQs', required: false, description: 'Frequently asked questions. Shown as a separate FAQ tab on the project page. Pre-emptively answers the questions backers will ask in comments.', tips: 'Cover shipping, returns, customization, format details, your timeline. Look at comments on similar projects to see what backers ask. 5-15 FAQ entries is a good range.' },
    ]
  },
  'people': {
    title: 'Step 4: People',
    description: 'Who is behind the project. Backers want to know they\'re funding a real person with real experience.',
    fields: [
      { name: 'Creator Name', required: true, description: 'Your name (or your studio/brand name). Shown next to the project everywhere. LOCKED after your first project launches.', tips: 'Use your real name OR your established brand. Don\'t invent something new — backers Google.' },
      { name: 'Avatar', required: true, description: 'Your profile picture. Shown on the project page, your creator profile (/profile/<vanity>), and any reviews you reply to.', tips: 'A clear, friendly headshot beats a logo for trust. Faces convert better than icons.' },
      { name: 'Biography', required: true, description: 'Short bio (300 chars max) introducing yourself. Shown on the People tab of your project.', tips: 'Highlight credentials: prior projects, relevant experience, awards, where else you publish. Skip generic platitudes — backers see those everywhere.' },
      { name: 'Location & Timezone', required: true, description: 'Where you\'re based. Used for shipping defaults and to set your account timezone (for scheduled emails, etc.).', tips: 'Be accurate. International backers see this and use it to gauge shipping time and customer service hours.' },
      { name: 'Vanity URL', required: false, description: 'Customize your profile URL. Default is /profile/<random-id>; with a vanity URL it becomes /<yourname> and projects become /projects/<yourname>/<slug>.', tips: 'Pick the same handle you use elsewhere (Twitter, IG, YouTube). Shorter is better. Once set, changing it breaks any old shared links.' },
      { name: 'Websites & Socials', required: false, description: 'Links to your website, portfolio, or social media. Shown on your project page and creator profile.', tips: 'Include only your most professional links. A dead Tumblr from 2014 hurts more than no link.' },
      { name: 'Collaborators', required: false, description: 'Invite team members by email with specific permissions: View, Edit, or Admin. Collaborators show up in IndieKit and can help manage the project.', tips: 'Add early. Once the campaign launches, having a co-pilot for comment moderation, updates, and customer service is invaluable. Invitations expire after 7 days.' },
    ]
  },
  'payment': {
    title: 'Step 5: Payment',
    description: 'How money flows: which processor takes the cards, how the platform pays you out, what fees apply, what reserves are held. Some choices lock at launch — read carefully.',
    fields: [
      { name: 'How Payments Work (Big Picture)', required: false, description: 'Backers pay the platform; the platform pays you. The processor (PayPal, Mentom Payments, DivinityCoin, or Whop — your choice) handles the card transaction. The platform takes its 3% fee, the processor takes its fee, then your net is paid out to your bank account on file.', tips: 'You don\'t need a PayPal/Mentom/DivinityCoin/Whop account on your end — the platform aggregates and pays you direct to your bank. Just pick a processor.' },
      { name: 'Funding Model: All-or-Nothing vs Keep-It-All', required: true, description: 'All-or-Nothing: backers are NOT charged unless the campaign hits its goal. Builds backer trust. Standard for new creators. Keep-It-All: backers are charged immediately at pledge time and you keep everything regardless of goal status. Useful for revenue-guaranteed projects (e.g., a known continuation of an existing series).', tips: 'All-or-Nothing is recommended for new or unproven projects — backers are far more likely to pledge knowing there\'s no charge if the goal misses. Keep-It-All is for established creators with a guaranteed audience.' },
      { name: 'Mentom Payments (Primary Processor for Most Campaigns)', required: false, description: 'Mentom Payments is a high-risk friendly merchant account on the NMI gateway. Backers enter their card directly on your campaign page; the card is tokenized in the browser via Collect.js (the full PAN never touches our servers) and only charged when the campaign hits its goal (or immediately for Keep-It-All). 100% NSFW friendly — accepts all content types.', tips: 'Fees: roughly 4% + $0.38/txn (Mentom) + 3% (platform) ≈ 7.5% total. Best fit for most campaigns including adult content. Funds settle to your bank on Mentom\'s standard schedule.' },
      { name: 'PayPal Processor', required: false, description: 'Use PayPal Advanced Checkout instead of Mentom. Backers can pay with PayPal wallet OR card-only (no PayPal account needed). Best for general-audience campaigns where backer trust in PayPal\'s name matters more than processor flexibility.', tips: 'Fees: roughly 3.49% + $0.49/txn (PayPal) + 3% (platform). PayPal does NOT support adult/NSFW content — Mentom or DivinityCoin are required for those.' },
      { name: 'DivinityCoin Processor', required: false, description: 'A third option for high-risk and adult content. Despite the name, NOT a cryptocurrency — it\'s a regulated card processor. Backers pay with regular credit/debit cards. Supports DivinityCoin\'s saved-card flow for All-or-Nothing campaigns: card saved at pledge time, charged on success.', tips: 'Pick DivinityCoin if your content is NSFW and you\'ve had issues with other processors, or if a partner specifically requires DivinityCoin.' },
      { name: 'Whop Processor', required: false, description: 'A fourth processor option, similar to PayPal in user experience but with different content policy and fee structure. Supports both All-or-Nothing and Keep-It-All. Apple Pay and Google Pay supported where available.', tips: 'Whop\'s fees and policies differ from the others — check the Settings → Payments section for current rates. Pick Whop if their policies fit your project better than the alternatives.' },
      { name: '180-Day Rolling Reserve', required: false, description: 'For Mentom Payments and certain DivinityCoin campaigns: 10% of your gross campaign revenue is held in escrow for 180 days as protection against chargebacks. Calculated BEFORE fees are deducted. Auto-applied to any campaign over $2,500 and on a case-by-case basis for new/high-risk creators. Applies to crowdfunding pledges and IndieKit after-sales (post-campaign add-on charges); does NOT apply to digital marketplace sales.', tips: 'Plan your fulfillment cash flow around an effective payout of ~67.5% of gross until the reserve releases. The reserve releases automatically to your payout balance after 180 days assuming no outstanding chargebacks.' },
      { name: 'International Payouts (non-US bank)', required: false, description: 'Mentom Payments settles into a US merchant account. If your payout bank is outside the US (e.g. United Kingdom), funds are sent by international wire transfer in your local currency. That adds a $25 wire fee plus a 1.50% currency conversion fee on top of the standard processing + platform fees. US bank accounts settle by ACH at no additional cost.', tips: 'When you add your bank account in Settings → Payments, pick your bank country at the top of the form. The international fee notice appears as soon as you select a non-US country so you know the all-in cost before saving.' },
      { name: 'Post-Funding Pledges', required: false, description: 'After your campaign reaches its goal, new backers can still pledge. They are charged immediately. This continues until you manually close late-pledging in IndieKit.', tips: 'Late pledges add 10-30% to total revenue without much effort. Promote on social and in updates after funding to drive them.' },
      { name: 'Payment Retries for Failed Cards', required: false, description: 'When a card fails at charge time (expired, declined, insufficient funds), the system automatically retries up to 3 times over 9 days. The backer also gets emails asking them to update their card.', tips: 'Most failures are expired cards — they happen 5-10% of the time. The retry logic resolves most of them. Only the truly stuck ones need manual handling from the IndieKit Backers tab.' },
      { name: 'Contact Email', required: true, description: 'A verified email used for important platform communications: payout notifications, refund requests, support escalations.', tips: 'Use one you check daily. Add @indiecrowdfund.com to your safe-senders list so platform mail doesn\'t go to spam.' },
      { name: 'Project Type', required: true, description: 'Are you operating as an Individual or a Business/Nonprofit? This affects 1099/tax reporting and the type of verification documents required.', tips: 'Business/Nonprofit usually carries more paperwork up front but smoother tax reporting downstream. Talk to your accountant if unsure.' },
      { name: 'Content Declarations', required: false, description: 'Declare adult or controversial content if your project includes it. Triggers a NSFW review and may restrict which processors are available (PayPal does not allow adult content; Mentom and DivinityCoin do).', tips: 'Declaring up front prevents reviewer back-and-forth. Hidden adult content discovered post-launch can result in campaign suspension.' },
      { name: 'Payout Bank Account', required: true, description: 'The bank account where IndieCrowdfund deposits your net earnings. Encrypted with AES-256 at rest. Settle on the processor\'s standard schedule (usually 1-2 business days for Mentom, T+2 for others). Supports US ACH out of the box and UK Sort Code + Account Number for international creators — additional countries added on request.', tips: 'You can update this later but the new account must also be verified. Don\'t use a bank account you might close — failed payouts cost time. Non-US accounts pay a $25 + 1.50% international wire fee at payout time; US accounts pay $0.' },
    ]
  },
  'promotion': {
    title: 'Step 6: Promotion',
    description: 'Marketing tools and tracking. Set these up BEFORE you launch — analytics that turn on mid-campaign miss the launch-day data, which is the most important data.',
    fields: [
      { name: 'Project URL (Slug)', required: true, description: 'The unique URL for your project page (/projects/<vanity>/<slug>). Auto-generated from the title; you can edit before launch. LOCKED after launch.', tips: 'Edit it to be short and memorable. "the-quiet-forest" is better than "the-quiet-forest-a-solo-tabletop-rpg-by-jane-doe-2026-edition".' },
      { name: 'Pre-Launch / Teaser Page', required: false, description: 'A landing page at /projects/<vanity>/<slug>/prelaunch that goes live BEFORE your campaign launches. Visitors can sign up via email to be notified at launch. Configure in IndieKit → Teaser Pages.', tips: 'Run a teaser for 2-4 weeks before launching. Promise something specific to early signups ("First 100 to back get a free signed bookplate"). Email signups become your day-1 backer base.' },
      { name: 'Custom Referral Tags', required: false, description: 'Trackable URL parameters for different marketing channels (e.g., ?ref=twitter, ?ref=newsletter). View per-channel performance in your analytics.', tips: 'Create unique tags for every channel: Twitter, Instagram, your newsletter, podcast appearances, Reddit posts. The data tells you where to spend your time next campaign.' },
      { name: 'Google Analytics', required: false, description: 'Connect a Google Analytics 4 property (G-XXXXXXXXXX). Tracks visitors, page views, bounce rate, conversions on your project page.', tips: 'Set this up before launch. Once connected, use GA Audience Builder to retarget visitors who didn\'t pledge.' },
      { name: 'Meta Pixel (Facebook/Instagram)', required: false, description: 'Connect a Meta Pixel ID. Tracks visits and conversions for Facebook and Instagram ad campaigns.', tips: 'Essential if you plan to run Meta ads. Set up before launch so the audience pool builds from day one.' },
      { name: 'Meta Conversions API', required: false, description: 'Server-side companion to the Meta Pixel. More accurate conversion tracking that survives ad blockers and iOS privacy changes.', tips: 'Use alongside the pixel, not instead of it. Conversions API delivers the real conversion signal back to Meta even when client-side tracking is blocked.' },
      { name: 'Update Cadence (post-launch)', required: false, description: 'Plan to post 2-3 updates per week during the campaign. Updates email backers, drive returning traffic, and signal an active project to undecided visitors.', tips: 'Schedule updates in advance. Day 1: launch announcement. Day 2-3: first stretch goal teaser. Mid-campaign: behind-the-scenes. Last 48 hours: final push, social proof.' },
    ]
  },
  'launch': {
    title: 'Step 7: Submit & Launch',
    description: 'You\'ve filled in everything. Now: how to actually go live. Submission, admin review, edits, and the launch button.',
    fields: [
      { name: 'Submit for Review', required: true, description: 'When all required fields are green and your draft is ready, click "Submit for Review" at the top of the project builder. The project moves from DRAFT to SUBMITTED status. Our admin team reviews your project against content guidelines, fee structure, and category rules.', tips: 'Most reviews complete in 1-3 business days. Don\'t submit on Friday afternoon if you want a quick turnaround. Triple-check rewards and shipping rates before submitting — fixing them after submission means re-review.' },
      { name: 'Reviewer Feedback', required: false, description: 'If our team has questions or required changes, you\'ll get an email plus an in-platform notification. Open the project, address each note, and resubmit. Common notes: missing AI disclosure, unclear shipping costs, ambiguous reward descriptions, hero image too low-resolution.', tips: 'Address every note in one batch. Going back-and-forth one note at a time can stretch review by a week.' },
      { name: 'Approval', required: false, description: 'Once approved, your project status moves to APPROVED. You can now launch it whenever you\'re ready. Approved projects have a "Launch Now" button at the top of the project builder. Approval does NOT auto-launch — you click the button.', tips: 'Launch on a Tuesday or Wednesday at 10am-2pm in your audience\'s timezone. Avoid major holidays and the weeks of US tax deadline (mid-April).' },
      { name: 'Launch Day Checklist', required: false, description: 'Before clicking Launch: (1) email pre-launch signups via Email Marketing, (2) post on every social channel, (3) prepare your Day-1 update, (4) make sure your bank account is on file in Settings → Payments, (5) tell your nearest 10 friends to back in the first hour (early momentum matters), (6) clear your calendar for the next 48 hours.', tips: 'Day 1 is roughly 30-40% of total campaign performance. Treat it like a product launch.' },
      { name: 'After Launch', required: false, description: 'Project status moves to LIVE. The countdown timer starts. The pledge button works. Backers start coming in. Your job shifts from setup to community management.', tips: 'See the "During the Campaign" tab for what to do once you\'re live.' },
      { name: 'Editing After Launch', required: false, description: 'Most fields LOCK at launch (title, slug, reward tier prices, funding goal, end date). Some fields stay editable: project description (Story tab), FAQ, Risks & Challenges, hero image (with admin re-review), Updates (always).', tips: 'If you discover a typo in a reward tier name after launch, message support — small text fixes are usually OK with admin approval. Functional changes (price, included items) generally are not.' },
    ]
  },
  'manage': {
    title: 'Step 8: During the Campaign',
    description: 'Your project is LIVE. Pledges are coming in. Here\'s how to manage the day-to-day until the campaign ends.',
    fields: [
      { name: 'Comments Tab', required: false, description: 'Backers and visitors ask questions in the project Comments tab. Reply quickly — visible engagement signals an active creator. You can pin important comments to the top, mark questions answered, and remove inappropriate posts.', tips: 'Aim to reply to every comment within 24 hours, sooner during launch and last-48-hours pushes. Use saved replies for repeat questions ("yes, we ship to Australia, see the Shipping section").' },
      { name: 'Updates Tab', required: false, description: 'Post 2-3 updates per week during the campaign. Updates email all backers and show on the public project page. Use them for milestones (50% funded!), behind-the-scenes (here\'s the cover process), stretch-goal reveals, and last-48-hours push.', tips: 'Updates with photos or video get 3x the engagement of text-only. Even a short progress photo from your studio counts.' },
      { name: 'Project Dashboard', required: false, description: 'Open Dashboard → Projects → click on your live project. You see real-time stats: pledges per hour, funding progress, top reward tiers, traffic sources (referral tags), conversion rate. The dashboard updates every few minutes.', tips: 'Check the dashboard once or twice a day, not constantly — obsessive refreshing is a creator-energy killer.' },
      { name: 'Stretch Goals', required: false, description: 'After hitting your funding goal, announce stretch goals: bonus content unlocked at higher funding tiers ($30k = bonus chapter, $40k = audiobook). Stretch goals are added by editing the project description or via Updates.', tips: 'Plan stretch goals BEFORE launch but reveal them gradually. Reveal one as you near your goal, and one each time you cross a stretch.' },
      { name: 'Email Marketing (live campaign)', required: false, description: 'Use Dashboard → Email Marketing to send campaign emails: launch announcement, mid-campaign push, last 48 hours, post-funding thanks. Each creator has their own email handle (yourname@indiecrowdfund.com) so emails come from your brand.', tips: 'Set up your email handle in Settings → Creator Email BEFORE launch. Send the launch email within an hour of going live. Send a "we did it!" email within 30 minutes of hitting goal.' },
      { name: 'Inbox / Backer Messages', required: false, description: 'Backers can DM you from the project page. Find these in Dashboard → Messages. Common questions: address changes, multiple-pledge consolidation, gifting questions.', tips: 'Reply within 48 hours. Loop in collaborators with Edit or Admin permissions to share the load on busy campaigns.' },
      { name: 'Modifying a Live Campaign', required: false, description: 'Most campaign settings lock at launch. You can still: post updates, reply to comments, edit project description (story tab), edit FAQ, edit Risks. You CANNOT: change funding goal, change end date, change tier prices, change tier inclusions, add or remove reward tiers without admin approval.', tips: 'If something MUST change (e.g., a reward item is no longer available), message support immediately. Don\'t silently change descriptions — backers notice and chargeback.' },
      { name: 'Last 48 Hours', required: false, description: 'The final 48 hours typically deliver 20-30% of total funding. Plan a final-push update, increase social activity, and answer every comment fast. Set countdown reminders in the project description.', tips: 'Send a "12 hours left" email and a "campaign ending" final push. Even backers who already pledged share the urgency, which drives new traffic.' },
      { name: 'Campaign Ends', required: false, description: 'When the timer hits zero, the project moves to FUNDED (if you hit goal) or FAILED (if not). Funded projects unlock IndieKit. Failed projects refund any captures (for All-or-Nothing).', tips: 'Whether you funded or failed, post a final update thanking backers within 24 hours. Funded campaigns continue with surveys; failed campaigns can re-launch with adjustments.' },
    ]
  },
  'after-funding': {
    title: 'Step 9: After Funding (IndieKit)',
    description: 'Your campaign funded! Now the real work begins: surveys, charging cards, shipping. All of this happens in IndieKit. This tab is the high-level handoff — see the IndieKit Handbook for full details.',
    fields: [
      { name: 'IndieKit Becomes Available', required: false, description: 'Within minutes of your campaign hitting its goal, the IndieKit option appears in your dashboard sidebar. Click "IndieKit" to enter the post-funding workspace.', tips: 'IndieKit is your back office for everything after funding. Surveys, payments, shipping, refunds, reports. Bookmark /dashboard/indiekit.' },
      { name: 'The Three Phases', required: false, description: 'IndieKit groups work into three phases: Pre-Fulfillment (build and send the survey, lock orders, charge final amounts, lock addresses), Fulfillment (charge cards, deliver digital, ship physical), Post-Fulfillment (final reports, late backers).', tips: 'Tabs from each phase only appear when your project is in that phase, keeping the screen tidy. The Dashboard tab\'s "What\'s Next" banner always tells you the next priority.' },
      { name: 'Survey Setup (Phase 1)', required: false, description: 'In IndieKit → Surveys, build the post-campaign survey: shipping address, T-shirt size, dedication, etc. In IndieKit → Setup, define add-ons (extras backers can buy on top of their tier) and shipping rates per zone.', tips: 'Send the survey within a week of funding. Aim for 90%+ completion before moving to Phase 2.' },
      { name: 'Finalize (still Phase 1)', required: false, description: 'Once surveys are 90%+ complete, IndieKit → Finalize walks you through three locks: Lock Orders (no more reward changes), Charge Cards (collect any extra owed for add-ons + shipping), Lock Addresses. After this, fulfillment can begin safely.', tips: 'Send a "last chance to update" email before each lock. Backers understand "last chance" but resent surprise locks.' },
      { name: 'Fulfillment (Phase 2)', required: false, description: 'IndieKit → Payments handles charge collection. IndieKit → Digital Delivery handles digital files (PDFs, MP3s, ZIPs). IndieKit → Physical Delivery handles physical shipping integration (Shopify, ShipStation, Shippo, EasyPost). Each tab walks you through its workflow.', tips: 'Connect your shipping integration in Settings before you reach Phase 2. Test with 5-10 orders first before pushing 1,000.' },
      { name: 'Post-Fulfillment (Phase 3)', required: false, description: 'IndieKit → Reports gives you full breakdown: revenue, fees, refunds, ship rate, net payout. IndieKit → Late Backers lets you keep selling to people who missed the campaign.', tips: 'Open late pledges for 30-60 days after fulfillment to add 10-30% to revenue. Run final reports to hand to your accountant for tax season.' },
      { name: 'Refund Requests', required: false, description: 'Backers can submit refund requests after the campaign ends from their backer dashboard. You review them in IndieKit → Refund Requests and approve, deny, or message the backer. Approved refunds flow through the original processor.', tips: 'Reply within 48 hours. A high refund rate (>5%) signals fulfillment communication is missing — review your update cadence.' },
      { name: 'Read the IndieKit Handbook', required: false, description: 'For step-by-step instructions on every IndieKit tab, open the IndieKit Handbook (button at the top of this page). It has plain-language how-to guides for each tab plus tips and gotchas.', tips: 'Bookmark both the handbook and /dashboard/indiekit. You\'ll bounce between them often during the first month of fulfillment.' },
    ]
  },
  'marketplace': {
    title: 'Digital Marketplace',
    description: 'A separate storefront for selling completed digital works (ebooks, comics, art packs, music) directly to customers. No funding goal, no campaign — instant purchase and instant delivery. Different from crowdfunding.',
    fields: [
      { name: 'What is the Marketplace?', required: false, description: 'A dedicated /marketplace storefront for selling already-finished digital works. No campaign, no funding goal, no surveys, no shipping. Customers buy a file, get the file. Useful for backlist titles, completed series, side projects, demos, free samples.', tips: 'Marketplace and crowdfunding can run in parallel. Use marketplace for what\'s done; crowdfund what you\'re still making.' },
      { name: 'Company Profile (Storefront)', required: true, description: 'Set up your storefront before listing items: logo, banner image, description, link to your social/website, content category (Comics, Books, Music, etc.).', tips: 'A complete profile builds trust. Customers checking out your first listing often click through to see who you are.' },
      { name: 'Physical Media Link', required: false, description: 'Add a link to where customers can order physical copies (your own store, Amazon, Bookshop, etc.). Shows on each digital listing as "Want a physical copy?" callout.', tips: 'Even if you\'re selling digital, a physical-copy link captures customers who only buy print.' },
      { name: 'Uploading Books / Files', required: true, description: 'For each item: upload a PDF (or audio/zip), set cover image, title, description, category, price. The file lives in encrypted storage. Customers get a download link after purchase.', tips: 'High-quality PDF optimized for digital reading: searchable text (not a flat scan), reasonable file size (compress to under 50MB if possible), bookmarks for chapter navigation.' },
      { name: 'Setting Price', required: true, description: 'Set your own USD price per item. You can adjust anytime — changes take effect immediately on new sales (existing purchases keep their original price record).', tips: 'Research similar items. A 100-page comic at $3-5 vs a 400-page novel at $7-10 is in normal range. Don\'t undervalue — premium pricing works for premium content.' },
      { name: 'Platform & Processor Fees', required: false, description: 'Marketplace uses PayPal by default: 3% platform fee + PayPal\'s ~3.49% + $0.49/txn. NSFW or restricted content uses Mentom Payments, DivinityCoin, or Whop instead with similar combined effective rates. Marketplace sales do NOT contribute to the 180-day rolling reserve.', tips: 'Example: $10 sale → you receive ~$9.30 after fees. Add your bank account in Dashboard → Settings → Payments to receive payouts directly.' },
      { name: 'Review Process', required: false, description: 'New listings go through a brief content review (1-2 business days) to ensure they comply with content guidelines. Once approved, they go live on the storefront immediately.', tips: 'NSFW content must be declared and tagged. Hidden NSFW discovered post-listing results in removal and possibly account suspension.' },
      { name: 'Sales Analytics', required: false, description: 'Open Dashboard → Marketplace → Analytics for per-item sales, revenue over time, conversion rate from page visit to purchase. Filter by date range and by item.', tips: 'Use analytics to inform pricing. If conversion is low at $10 but volume is 5x at $5, the lower price might be optimal revenue.' },
      { name: 'Where Marketplace Purchases Show Up for Backers', required: false, description: 'When a customer buys, the file appears in their backer dashboard at /dashboard/backer?tab=downloads (the unified Downloads tab) and /dashboard/backer?tab=digital-library (the in-browser reader). They can re-download as many times as they want — the link does not expire.', tips: 'No need to email a download link manually — the platform handles delivery. Customers also get an email receipt with a direct link.' },
    ]
  },
};

function FieldCard({ field }: { field: FieldInfo }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">{field.name}</h4>
        {field.required ? (
          <span className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
            <AlertCircle className="h-3 w-3" />
            Required
          </span>
        ) : (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-zinc-600">
            Optional
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-muted-foreground">{field.description}</p>
      {field.tips && (
        <div className="mt-2 flex gap-2 rounded bg-purple-50 dark:bg-purple-950/30 p-2">
          <Info className="h-4 w-4 flex-shrink-0 text-purple-600 dark:text-purple-400 mt-0.5" />
          <p className="text-xs text-purple-800 dark:text-purple-300">{field.tips}</p>
        </div>
      )}
    </div>
  );
}

export default function CreatorHandbookPage() {
  const [activeTab, setActiveTab] = useState('verification');
  const currentTab = tabContent[activeTab];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-500 py-8 text-white">
        <div className="container mx-auto px-4">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-purple-100 hover:text-white mb-4">
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
          <h1 className="text-xl sm:text-3xl font-bold">Creator Handbook</h1>
          <p className="mt-1 text-purple-100">Everything you need to know about creating a successful project — from verification to fulfillment.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:gap-8">
          {/* Sidebar Navigation */}
          <aside className="w-full md:w-64 md:flex-shrink-0">
            <nav className="flex flex-wrap gap-1 md:sticky md:top-8 md:flex-col md:space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors text-left ${
                      isActive
                        ? 'bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100'
                        : 'text-zinc-600 hover:bg-muted dark:text-muted-foreground dark:hover:bg-zinc-800'
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
                  <p className="mt-1 text-zinc-600 dark:text-muted-foreground">{currentTab.description}</p>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {currentTab.fields.map((field) => (
                    <FieldCard key={field.name} field={field} />
                  ))}
                </div>
              </>
            )}

            {/* Quick Links */}
            <div className="mt-12 rounded-xl bg-gradient-to-r from-purple-600 to-pink-500 p-6 text-white">
              <h3 className="text-xl font-bold mb-2">Ready to Create Your Project?</h3>
              <p className="text-purple-100 mb-4">Start building your campaign today.</p>
              <div className="flex gap-3">
                <Link href="/projects/new" className="inline-flex items-center gap-2 rounded-lg bg-white text-purple-600 px-4 py-2 text-sm font-medium hover:bg-purple-50">
                  <Lightbulb className="h-4 w-4" /> Start a Project
                </Link>
                <Link href="/indiekit-handbook" className="inline-flex items-center gap-2 rounded-lg border border-white/30 px-4 py-2 text-sm font-medium hover:bg-white/10">
                  <BookOpen className="h-4 w-4" /> IndieKit Handbook
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
