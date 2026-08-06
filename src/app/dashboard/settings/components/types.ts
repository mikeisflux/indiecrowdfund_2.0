export interface EmailPreferences {
  // Backer notifications
  backedProjectUpdates: boolean;
  projectFunded: boolean;
  commentReplies: boolean;
  surveyReminders: boolean;
  // Creator messages
  creatorMessages: boolean;
  // Following
  projectUpdates: boolean;
  creatorLaunches: boolean;
  // Discovery
  newProjects: boolean;
  endingSoon: boolean;
  fundingMilestones: boolean;
  // Digest & Marketing
  weeklyDigest: boolean;
  marketingEmails: boolean;
}

export interface UserSettings {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  bio: string | null;
  location: string | null;
  timezone: string | null;
  vanityUrl: string | null;
  websites: string[];
  showNameOnly: boolean;
  emailVerified: Date | null;
  createdAt: string;
  connectedAccounts: string[];
  emailPreferences: EmailPreferences;
  // False for OAuth-only accounts, which skip password re-entry when
  // confirming a destructive action.
  hasPassword: boolean;
}

export interface DeleteAccountState {
  password: string;
  confirmText: string;
  // Explicit consent to the forfeiture/release terms in the Data Deletion
  // Policy. Enforced server-side too — deletion is a legal waiver, so the
  // acknowledgement has to be a deliberate act, not just displayed text.
  acknowledged: boolean;
  isDeleting: boolean;
  error: string | null;
  success: boolean;
}

export interface EmailChangeState {
  newEmail: string;
  confirmEmail: string;
  password: string;
  isChanging: boolean;
  error: string | null;
  success: boolean;
}

export interface PasswordChangeState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  isChanging: boolean;
  error: string | null;
  success: boolean;
}

export const TIMEZONES = [
  { value: "America/New_York", label: "Eastern Time (ET)" },
  { value: "America/Chicago", label: "Central Time (CT)" },
  { value: "America/Denver", label: "Mountain Time (MT)" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
  { value: "America/Anchorage", label: "Alaska Time (AKT)" },
  { value: "Pacific/Honolulu", label: "Hawaii Time (HT)" },
  { value: "Europe/London", label: "London (GMT/BST)" },
  { value: "Europe/Paris", label: "Central European (CET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
];
