import { z } from 'zod'

// Auth Validations
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  username: z.string().min(3, 'Username must be at least 3 characters').regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
})

// Project Validations
export const projectBasicsSchema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title must be less than 100 characters'),
  tagline: z.string().max(200, 'Tagline must be less than 200 characters').optional(),
  category: z.enum(['COMIC_BOOKS', 'GRAPHIC_NOVELS', 'MANGA', 'WEBCOMICS', 'INDIE_COMICS', 'ANTHOLOGY', 'ART_BOOK', 'ZINE']),
  location: z.string().optional(),
  imageUrl: z.string().url().optional(),
  videoUrl: z.string().url().optional(),
  fundingGoal: z.number().min(100, 'Funding goal must be at least $100'),
  currency: z.string().default('USD'),
  duration: z.number().min(1).max(60).optional(),
  endDate: z.date().optional(),
})

export const projectStorySchema = z.object({
  story: z.string().min(100, 'Story must be at least 100 characters'),
  risks: z.string().optional(),
  aiDisclosure: z.string().optional(),
  faqs: z.array(z.object({
    question: z.string(),
    answer: z.string(),
  })).optional(),
})

export const projectPaymentSchema = z.object({
  contactEmail: z.string().email('Invalid email address'),
  projectType: z.enum(['individual', 'business']).optional(),
  paymentProcessor: z.enum(['STRIPE', 'CCBILL']),
  bankAccountId: z.string().optional(),
})

export const projectPromotionSchema = z.object({
  customUrl: z.string().regex(/^[a-z0-9-]+$/, 'URL can only contain lowercase letters, numbers, and hyphens').optional(),
  preLaunchPage: z.boolean().default(false),
  referralTags: z.string().optional(),
  gaTrackingId: z.string().optional(),
  metaPixelId: z.string().optional(),
})

// Reward Validations
export const rewardSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  pledgeAmount: z.number().min(1, 'Pledge amount must be at least $1'),
  imageUrl: z.string().url().optional(),
  estimatedDelivery: z.date().optional(),
  shippingType: z.enum(['NO_SHIPPING', 'DOMESTIC', 'INTERNATIONAL']).default('NO_SHIPPING'),
  shippingCost: z.number().min(0).optional(),
  quantityLimit: z.number().min(1).optional(),
  quantityAvailable: z.number().min(0).optional(),
})

export const addonSchema = z.object({
  title: z.string().min(3, 'Title must be at least 3 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  price: z.number().min(1, 'Price must be at least $1'),
  imageUrl: z.string().url().optional(),
  shippingCost: z.number().min(0).optional(),
  quantityLimit: z.number().min(1).optional(),
  quantityAvailable: z.number().min(0).optional(),
})

// Pledge Validations
export const pledgeSchema = z.object({
  projectId: z.string(),
  rewardId: z.string().optional(),
  amount: z.number().min(1),
  paymentProcessor: z.enum(['STRIPE', 'CCBILL']),
  addonIds: z.array(z.string()).optional(),
})

// Admin Validations
export const siteSettingsSchema = z.object({
  siteName: z.string().min(1),
  siteUrl: z.string().url(),
  logoUrl: z.string().url().optional(),
  faviconUrl: z.string().url().optional(),
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  accentColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  platformFeePercent: z.number().min(0).max(100),
  metaTitle: z.string().optional(),
  metaDescription: z.string().optional(),
})

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ProjectBasicsInput = z.infer<typeof projectBasicsSchema>
export type ProjectStoryInput = z.infer<typeof projectStorySchema>
export type ProjectPaymentInput = z.infer<typeof projectPaymentSchema>
export type ProjectPromotionInput = z.infer<typeof projectPromotionSchema>
export type RewardInput = z.infer<typeof rewardSchema>
export type AddonInput = z.infer<typeof addonSchema>
export type PledgeInput = z.infer<typeof pledgeSchema>
export type SiteSettingsInput = z.infer<typeof siteSettingsSchema>
