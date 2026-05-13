// Export types
export type { NotificationType, CreateNotificationParams } from "./types";
export { APP_NAME, APP_URL } from "./types";

// Export core notification functions
export {
  createNotification,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
} from "./core";

// Export project notifications
export {
  notifyProjectFunded,
  notifyProjectLaunched,
  notifyProjectUpdate,
  notifyNewProjectComment,
  notifyProjectEnded,
} from "./project-notifications";

// Export pledge notifications
export {
  notifyPledgeReceived,
  notifyPledgeFailed,
  notifyNmiChargeFailed,
  notifyPledgeShipped,
  notifyPledgeDelivered,
  notifyBackerPledgeConfirmed,
  notifySurveySent,
  notifySurveyReminder,
  notifySurveyUpdateRequested,
  processUnsentConfirmationEmails,
} from "./pledge-notifications";

// Export marketplace notifications
export {
  notifyMarketplacePurchase,
  notifyMarketplaceSale,
  notifyMarketplaceBookReview,
} from "./marketplace-notifications";

// Export social notifications
export {
  notifyMessageReceived,
  notifyCommentReply,
  notifyNewComment,
  notifyCollaboratorInvite,
} from "./social-notifications";

// Export email template functions (in case they're needed directly)
export {
  sendProjectFundedEmail,
  sendProjectLaunchEmail,
  sendProjectUpdateEmail,
  sendCommentReplyEmail,
  sendMarketplacePurchaseEmail,
  sendMarketplaceSaleEmail,
} from "./email-templates";
