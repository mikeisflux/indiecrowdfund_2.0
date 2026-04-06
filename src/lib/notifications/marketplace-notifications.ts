import { db } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { createNotification } from "./core";
import {
  sendMarketplacePurchaseEmail,
  sendMarketplaceSaleEmail,
} from "./email-templates";
import { APP_NAME, APP_URL } from "./types";

import { logger } from "@/lib/logger";

const notificationsMarketplaceNotificationsLogger = logger.child({ module: "notifications-marketplace-notifications" });

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}


/**
 * Notify buyer when their marketplace purchase is confirmed
 */
export async function notifyMarketplacePurchase(
  purchaseId: string,
  paymentMethod: "STRIPE" | "DIVINITYCOIN" | "PAYPAL" | "WHOP"
) {
  const purchase = await db.marketplacePurchase.findUnique({
    where: { id: purchaseId },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          slug: true,
          coverImageUrl: true,
          pdfCoverImageUrl: true,
        },
      },
      buyer: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  if (!purchase || !purchase.buyer.email) return;

  const libraryUrl = `/dashboard/backer?tab=digital-library`;

  // Create in-app notification for buyer
  await createNotification({
    userId: purchase.buyer.id,
    type: "MARKETPLACE_PURCHASE",
    title: "Purchase Confirmed!",
    message: `"${purchase.book.title}" has been added to your Digital Library.`,
    actionUrl: libraryUrl,
  });

  // Send email to buyer
  try {
    await sendMarketplacePurchaseEmail(
      purchase.buyer.email,
      purchase.buyer.name || "there",
      purchase.book.title,
      purchase.book.slug,
      Number(purchase.amount),
      purchase.currency,
      paymentMethod,
      purchase.book.coverImageUrl || purchase.book.pdfCoverImageUrl
    );
    notificationsMarketplaceNotificationsLogger.info(`Sent marketplace purchase email to ${purchase.buyer.email} for purchase ${purchaseId}`);
  } catch (error) {
    notificationsMarketplaceNotificationsLogger.error({ err: error }, `Failed to send marketplace purchase email for ${purchaseId}:`);
  }
}

/**
 * Notify creator when they receive a marketplace sale
 */
export async function notifyMarketplaceSale(
  purchaseId: string,
  paymentMethod: "STRIPE" | "DIVINITYCOIN" | "PAYPAL" | "WHOP"
) {
  const purchase = await db.marketplacePurchase.findUnique({
    where: { id: purchaseId },
    include: {
      book: {
        select: {
          id: true,
          title: true,
          slug: true,
          creator: {
            select: { id: true, email: true, name: true },
          },
        },
      },
      buyer: {
        select: { name: true },
      },
    },
  });

  if (!purchase || !purchase.book.creator.email) return;

  const dashboardUrl = `/dashboard/marketplace`;
  const buyerName = purchase.buyer.name || "A customer";

  // Create in-app notification for creator
  await createNotification({
    userId: purchase.book.creator.id,
    type: "MARKETPLACE_SALE",
    title: "New Sale!",
    message: `${buyerName} purchased "${purchase.book.title}" for $${Number(purchase.amount).toFixed(2)}`,
    actionUrl: dashboardUrl,
  });

  // Send email to creator
  try {
    await sendMarketplaceSaleEmail(
      purchase.book.creator.email,
      purchase.book.creator.name || "Creator",
      purchase.book.title,
      purchase.book.slug,
      Number(purchase.amount),
      Number(purchase.platformFee),
      Number(purchase.creatorPayout),
      purchase.currency,
      paymentMethod,
      buyerName
    );
    notificationsMarketplaceNotificationsLogger.info(`Sent marketplace sale email to ${purchase.book.creator.email} for purchase ${purchaseId}`);
  } catch (error) {
    notificationsMarketplaceNotificationsLogger.error({ err: error }, `Failed to send marketplace sale email for ${purchaseId}:`);
  }
}

/**
 * Notify creator when their marketplace book is reviewed (approved or rejected)
 */
export async function notifyMarketplaceBookReview(
  bookId: string,
  action: "APPROVED" | "REJECTED",
  rejectionReason?: string
) {
  const book = await db.marketplaceBook.findUnique({
    where: { id: bookId },
    include: {
      creator: {
        select: { id: true, email: true, name: true },
      },
    },
  });

  if (!book || !book.creator.email) return;

  const isApproved = action === "APPROVED";
  const dashboardUrl = `/dashboard/marketplace`;
  const bookUrl = isApproved ? `/marketplace/books/${book.slug}` : dashboardUrl;

  // Create in-app notification
  await createNotification({
    userId: book.creator.id,
    type: isApproved ? "MARKETPLACE_BOOK_APPROVED" : "MARKETPLACE_BOOK_REJECTED",
    title: isApproved ? "Book Approved! 🎉" : "Book Review Update",
    message: isApproved
      ? `Your book "${book.title}" has been approved and is now live on the marketplace!`
      : `Your book "${book.title}" was not approved. ${rejectionReason ? `Reason: ${rejectionReason}` : "Please check your dashboard for details."}`,
    actionUrl: bookUrl,
  });

  // Send email
  try {
    const creatorName = book.creator.name || "Creator";

    if (isApproved) {
      await sendEmail({
        to: book.creator.email,
        subject: `🎉 "${book.title}" is now live on the marketplace!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
              .book-title { font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 16px; }
              .button { display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Your Book is Live!</h1>
              </div>
              <div class="content">
                <p>Hi ${escapeHtml(creatorName)},</p>
                <p>Great news! Your book has been approved and is now live on the marketplace:</p>
                <p class="book-title">&ldquo;${escapeHtml(book.title)}&rdquo;</p>
                <p>Readers can now discover and purchase your book. Share the link with your audience to start making sales!</p>
                <p style="text-align: center;">
                  <a href="${APP_URL}${bookUrl}" class="button">View Your Book</a>
                </p>
                <p>Tips for success:</p>
                <ul>
                  <li>Share your book link on social media</li>
                  <li>Add it to your email signature</li>
                  <li>Consider creating promotional content</li>
                </ul>
                <p>Congratulations on publishing your book!</p>
                <p>Best,<br>The ${APP_NAME} Team</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    } else {
      await sendEmail({
        to: book.creator.email,
        subject: `Update on your book "${book.title}"`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0; }
              .header h1 { color: white; margin: 0; font-size: 24px; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px; }
              .book-title { font-size: 20px; font-weight: bold; color: #1f2937; margin-bottom: 16px; }
              .reason-box { background: #FEF3C7; border-left: 4px solid #F59E0B; padding: 16px; margin: 20px 0; border-radius: 0 8px 8px 0; }
              .button { display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #EC4899 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 20px 0; }
              .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Book Review Update</h1>
              </div>
              <div class="content">
                <p>Hi ${escapeHtml(creatorName)},</p>
                <p>We've reviewed your book submission:</p>
                <p class="book-title">&ldquo;${escapeHtml(book.title)}&rdquo;</p>
                <p>Unfortunately, we were unable to approve it at this time.</p>
                ${rejectionReason ? `
                <div class="reason-box">
                  <strong>Feedback:</strong><br>
                  ${escapeHtml(rejectionReason)}
                </div>
                ` : ""}
                <p>You can make changes to your book and resubmit it for review. We're here to help you succeed!</p>
                <p style="text-align: center;">
                  <a href="${APP_URL}${dashboardUrl}" class="button">Edit Your Book</a>
                </p>
                <p>If you have questions about the review, please don't hesitate to reach out to our support team.</p>
                <p>Best,<br>The ${APP_NAME} Team</p>
              </div>
              <div class="footer">
                <p>© ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
              </div>
            </div>
          </body>
          </html>
        `,
      });
    }
    notificationsMarketplaceNotificationsLogger.info(`Sent marketplace book review email to ${book.creator.email} for book ${bookId}`);
  } catch (error) {
    notificationsMarketplaceNotificationsLogger.error({ err: error }, `Failed to send marketplace book review email for ${bookId}:`);
  }
}
