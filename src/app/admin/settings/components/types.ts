// Settings types for admin settings page

export interface GeneralSettings {
  siteName: string;
  siteDescription: string;
  supportEmail: string;
  timezone: string;
  currency: string;
  platformFee: string;
  maintenanceMode: boolean;
  googlePlacesApiKey: string;
}

export interface PaymentSettings {
  stripeEnabled: boolean;
  stripePublicKey: string;
  stripeSecretKey: string;
  stripeWebhookSecret: string;
  // DivinityCoin - Credit redemption payment solution
  divinityCoinEnabled: boolean;
  divinityCoinApiKey: string;
  divinityCoinWebhookSecret: string;
  divinityCoinPartnerId: string;
  divinityCoinSettlementFrequency: string;
  // Local UI settings
  autoPayouts: boolean;
  payoutThreshold: string;
  payoutSchedule: string;
}

export interface EmailSettings {
  provider: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPassword: string;
  fromEmail: string;
  fromName: string;
  sendgridApiKey: string;
  mailgunApiKey: string;
  mailgunDomain: string;
  // Local UI settings
  replyToEmail: string;
  emailVerificationRequired: boolean;
  welcomeEmailEnabled: boolean;
  pledgeConfirmationEnabled: boolean;
  projectUpdateNotifications: boolean;
}

export interface SecuritySettings {
  require2FA: boolean;
  sessionDuration: string;
  maxLoginAttempts: string;
  lockoutDuration: string;
  passwordMinLength: string;
  requireSpecialChar: boolean;
  ipWhitelist: string;
  // Global Rate Limiting
  globalRateLimitEnabled: boolean;
  globalRateLimit: string;
  globalRateLimitWindow: string;
  // Login/Sensitive Endpoint Rate Limiting
  loginRateLimitEnabled: boolean;
  loginRateLimit: string;
  loginRateLimitWindow: string;
  // Password Reset Rate Limiting
  passwordResetRateLimit: string;
  passwordResetRateLimitWindow: string;
  csrfProtection: boolean;
  contentSecurityPolicy: boolean;
}

export interface AISettings {
  openaiEnabled: boolean;
  openaiApiKey: string;
  openaiModel: string;
  anthropicEnabled: boolean;
  anthropicApiKey: string;
  anthropicModel: string;
  autoTagging: boolean;
  marketingCopy: boolean;
  contentModeration: boolean;
  fraudDetection: boolean;
  moderationThreshold: string;
}

export interface SocialSettings {
  facebookEnabled: boolean;
  facebookAppId: string;
  facebookAppSecret: string;
  facebookPageAccessToken: string;
  instagramEnabled: boolean;
  youtubeEnabled: boolean;
  youtubeClientId: string;
  youtubeClientSecret: string;
  youtubeApiKey: string;
  twitterEnabled: boolean;
  twitterApiKey: string;
  twitterApiSecret: string;
  twitterBearerToken: string;
  twitterAccessToken: string;
  twitterAccessSecret: string;
  dalleEnabled: boolean;
  dalleApiKey: string;
  stabilityEnabled: boolean;
  stabilityApiKey: string;
  autoPostEnabled: boolean;
  defaultHashtags: string;
  postApprovalRequired: boolean;
}

export interface IDVerificationSettings {
  enabled: boolean;
  clientId: string;
  secretKey: string;
  callbackUrl: string;
  redirectUrl: string;
  minAge: string;
  mode: string;
}

// Props types for section components
export interface SettingsSectionProps<T> {
  settings: T;
  onChange: (settings: T) => void;
}
