import {
  Inbox,
  SendHorizontal,
  FileText,
  Trash2,
  Archive,
  ImageIcon,
  FileAudio,
  FileVideo,
  FileText as FileTextIcon,
  FileIcon,
} from "lucide-react";

export interface Mailbox {
  id: string;
  name: string;
  email: string;
  description?: string;
  color?: string;
  isDefault: boolean;
  isActive: boolean;
  isCreatorMailbox: boolean;
  unreadCount: number;
  totalEmails: number;
  folders?: Record<string, number>;
}

export interface EmailAttachment {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  r2Key: string;
}

export interface Email {
  id: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  toName?: string;
  subject: string;
  bodyHtml?: string;
  bodyText?: string;
  folder: string;
  status: string;
  isRead: boolean;
  isStarred: boolean;
  sentAt?: string;
  receivedAt?: string;
  createdAt: string;
  attachments?: {
    count: number;
    files?: EmailAttachment[];
  };
}

export interface EmailSettings {
  provider: string;
  sendgridApiKey: string;
  smtpFromEmail: string;
  smtpFromName: string;
}

export const FOLDER_ICONS: Record<string, typeof Inbox> = {
  INBOX: Inbox,
  SENT: SendHorizontal,
  DRAFTS: FileText,
  TRASH: Trash2,
  ARCHIVE: Archive,
};

export const FOLDER_LABELS: Record<string, string> = {
  INBOX: "Inbox",
  SENT: "Sent",
  DRAFTS: "Drafts",
  TRASH: "Trash",
  ARCHIVE: "Archive",
};

// Get icon for file type
export function getFileIcon(contentType: string) {
  if (contentType.startsWith("image/")) return ImageIcon;
  if (contentType.startsWith("audio/")) return FileAudio;
  if (contentType.startsWith("video/")) return FileVideo;
  if (contentType.includes("pdf") || contentType.includes("document") || contentType.includes("text"))
    return FileTextIcon;
  return FileIcon;
}

// Format file size
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
