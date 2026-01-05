export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export type NotificationType =
  | "COLLABORATOR_INVITE"
  | "COLLABORATOR_ACCEPTED"
  | "COLLABORATOR_DECLINED"
  | "PROJECT_UPDATE"
  | "PROJECT_FUNDED"
  | "PROJECT_LAUNCHED"
  | "PROJECT_ENDED"
  | "PLEDGE_RECEIVED"
  | "PLEDGE_FAILED"
  | "PLEDGE_SHIPPED"
  | "PLEDGE_DELIVERED"
  | "COMMENT_REPLY"
  | "COMMENT_NEW"
  | "MESSAGE_RECEIVED"
  | "SURVEY_SENT"
  | "SURVEY_REMINDER"
  | "FOLLOWED_PROJECT_LAUNCHED"
  | "MARKETPLACE_PURCHASE"
  | "MARKETPLACE_SALE"
  | "MARKETPLACE_BOOK_APPROVED"
  | "MARKETPLACE_BOOK_REJECTED"
  | "SYSTEM";

export interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  projectId?: string;
  senderId?: string;
}
