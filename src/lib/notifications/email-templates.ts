import { sendEmail } from "@/lib/email";
import { safeEmailImageUrl } from "@/lib/email/safe-image-url";
import { APP_NAME, APP_URL } from "./types";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Send project funded email
 */
export async function sendProjectFundedEmail(
  email: string,
  projectTitle: string,
  projectUrlPath: string,
  imageUrl?: string | null
) {
  const projectUrl = `${APP_URL}${projectUrlPath}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Funded!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #028858 0%, #10b981 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">Project Funded!</h2>

          ${(() => { const safe = safeEmailImageUrl(imageUrl, APP_URL); return safe ? `<img src="${safe}" alt="${escapeHtml(projectTitle)}" style="width: 100%; max-width: 500px; height: auto; border-radius: 8px; margin: 20px auto; display: block;">` : ""; })()}

          <div style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: white;">${escapeHtml(projectTitle)}</h3>
            <p style="margin: 0; color: rgba(255,255,255,0.9);">has reached its funding goal!</p>
          </div>

          <p style="text-align: center;">Thanks to you and other backers, this project is now fully funded and will become a reality!</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0;"><strong>What happens next?</strong></p>
          <p style="margin: 0; color: #666;">The creator will start working on bringing the project to life. You'll receive updates as the project progresses, and we'll send you a survey to collect your delivery details closer to the estimated delivery date.</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${projectUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            View Project Updates
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because you backed this project.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `"${projectTitle}" has been funded!`,
    html,
  });
}

/**
 * Send project launch email
 */
export async function sendProjectLaunchEmail(
  email: string,
  projectTitle: string,
  projectUrlPath: string,
  creatorName: string,
  imageUrl?: string | null
) {
  const projectUrl = `${APP_URL}${projectUrlPath}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project You Follow Is Live!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">A Project You Follow Is Now Live!</h2>

          ${(() => { const safe = safeEmailImageUrl(imageUrl, APP_URL); return safe ? `<img src="${safe}" alt="${escapeHtml(projectTitle)}" style="width: 100%; max-width: 500px; height: auto; border-radius: 8px; margin-bottom: 20px;">` : ""; })()}

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${escapeHtml(projectTitle)}</h3>
            <p style="margin: 0; color: #666;">by ${escapeHtml(creatorName)}</p>
          </div>

          <p>The project you signed up to be notified about has just launched! Be one of the first backers and help bring this project to life.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${projectUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              View Project & Back Now
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-bottom: 0; text-align: center;">
            Early backers often get the best rewards!
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because you signed up for launch notifications for this project.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `"${projectTitle}" is now live on ${APP_NAME}!`,
    html,
  });
}

/**
 * Send project update email
 */
export async function sendProjectUpdateEmail(
  email: string,
  projectTitle: string,
  projectUrlPath: string,
  updateTitle: string,
  creatorName: string,
  updateContent?: string,
  updateId?: string
) {
  // Link directly to the updates tab with anchor to specific update
  const updateUrl = updateId
    ? `${APP_URL}${projectUrlPath}?tab=updates#update-${updateId}`
    : `${APP_URL}${projectUrlPath}?tab=updates`;

  // Truncate content for email preview (strip HTML and limit length)
  let contentPreview = "";
  if (updateContent) {
    // Strip HTML tags for plain text preview
    const plainText = updateContent.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();
    contentPreview = plainText.length > 500 ? plainText.substring(0, 500) + "..." : plainText;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Project Update</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">New Update from ${escapeHtml(creatorName)}</h2>

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 10px 0; color: #666; font-size: 14px;">${escapeHtml(projectTitle)}</p>
            <h3 style="margin: 0 0 15px 0; color: #333;">${escapeHtml(updateTitle)}</h3>
            ${contentPreview ? `
            <div style="border-top: 1px solid #e5e5e5; padding-top: 15px; margin-top: 10px;">
              <p style="margin: 0; color: #444; font-size: 14px; white-space: pre-wrap;">${escapeHtml(contentPreview)}</p>
            </div>
            ` : ""}
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${updateUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Read Full Update
            </a>
          </div>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because you're following or have backed this project.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `New update for "${projectTitle}": ${updateTitle}`,
    html,
  });
}

/**
 * Send comment reply email
 */
export async function sendCommentReplyEmail(
  email: string,
  userName: string,
  replierName: string,
  projectTitle: string,
  projectUrlPath: string,
  replyContent: string
) {
  const commentsUrl = `${APP_URL}${projectUrlPath}?tab=comments`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Reply to Your Comment</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">Hi ${escapeHtml(userName)},</h2>

          <p><strong>${escapeHtml(replierName)}</strong> replied to your comment on <strong>&ldquo;${escapeHtml(projectTitle)}&rdquo;</strong>:</p>

          <div style="background: #fff; border-left: 4px solid #05ce78; padding: 15px 20px; margin: 20px 0; border-radius: 0 6px 6px 0;">
            <p style="margin: 0; color: #333; white-space: pre-wrap;">${escapeHtml(replyContent)}</p>
          </div>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${commentsUrl}" style="display: inline-block; background: #05ce78; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              View Conversation
            </a>
          </div>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because you commented on this project.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `${replierName} replied to your comment on "${projectTitle}"`,
    html,
  });
}

/**
 * Send marketplace purchase confirmation email to buyer
 */
export async function sendMarketplacePurchaseEmail(
  email: string,
  buyerName: string,
  bookTitle: string,
  bookSlug: string,
  amount: number,
  currency: string,
  paymentMethod: "STRIPE" | "DIVINITYCOIN" | "PAYPAL" | "WHOP",
  coverImageUrl?: string | null
) {
  // Single canonical destination for ALL digital content (crowdfunding
  // rewards + marketplace purchases): the Downloads tab. The tab pulls
  // from /api/backer/digital-library which merges both sources.
  const libraryUrl = `${APP_URL}/dashboard/backer?tab=downloads`;

  const paymentMethodLabel = paymentMethod === "DIVINITYCOIN" ? "DivinityCoin" : "Card";
  const amountFormatted = paymentMethod === "DIVINITYCOIN"
    ? `${amount.toFixed(2)} DC`
    : `$${amount.toFixed(2)} ${currency}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Purchase Confirmed!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME} Marketplace</h1>
        </div>

        <div style="background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">Purchase Confirmed!</h2>

          ${coverImageUrl ? `<img src="${coverImageUrl}" alt="${escapeHtml(bookTitle)}" style="width: 100%; max-width: 300px; height: auto; border-radius: 8px; margin: 20px auto; display: block; box-shadow: 0 4px 20px rgba(0,0,0,0.3);">` : ""}

          <div style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: white;">${escapeHtml(bookTitle)}</h3>
            <p style="margin: 0; color: rgba(255,255,255,0.9);">has been added to your Digital Library!</p>
          </div>

          <div style="background: rgba(255,255,255,0.1); border-radius: 6px; padding: 15px; margin-top: 20px;">
            <table style="width: 100%; color: white;">
              <tr>
                <td style="padding: 5px 0;">Payment Method:</td>
                <td style="text-align: right; padding: 5px 0;">${paymentMethodLabel}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;"><strong>Total:</strong></td>
                <td style="text-align: right; padding: 5px 0;"><strong>${amountFormatted}</strong></td>
              </tr>
            </table>
          </div>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${libraryUrl}" style="display: inline-block; background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%); color: #fff; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            Read in Digital Library
          </a>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0;"><strong>What's next?</strong></p>
          <p style="margin: 0; color: #666;">Your book is now available in your Digital Library. You can read it anytime, on any device. Just sign in to your account and visit the Digital Library.</p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because you made a purchase on ${APP_NAME} Marketplace.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Purchase confirmed: "${bookTitle}"`,
    html,
  });
}

/**
 * Send marketplace sale notification email to creator
 */
export async function sendMarketplaceSaleEmail(
  email: string,
  creatorName: string,
  bookTitle: string,
  bookSlug: string,
  saleAmount: number,
  platformFee: number,
  payout: number,
  currency: string,
  paymentMethod: "STRIPE" | "DIVINITYCOIN" | "PAYPAL" | "WHOP",
  buyerName: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/marketplace`;

  const paymentMethodLabel = paymentMethod === "DIVINITYCOIN" ? "DivinityCoin" : "Stripe";
  const formatAmount = (amt: number) => paymentMethod === "DIVINITYCOIN"
    ? `${amt.toFixed(2)} DC`
    : `$${amt.toFixed(2)} ${currency}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Sale!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME} Marketplace</h1>
        </div>

        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">You made a sale!</h2>

          <div style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: white;">${escapeHtml(bookTitle)}</h3>
            <p style="margin: 0; color: rgba(255,255,255,0.9);">purchased by ${escapeHtml(buyerName)}</p>
          </div>

          <div style="background: rgba(255,255,255,0.1); border-radius: 6px; padding: 15px; margin-top: 20px;">
            <table style="width: 100%; color: white;">
              <tr>
                <td style="padding: 5px 0;">Sale Amount:</td>
                <td style="text-align: right; padding: 5px 0;">${formatAmount(saleAmount)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;">Platform Fee (3%):</td>
                <td style="text-align: right; padding: 5px 0;">-${formatAmount(platformFee)}</td>
              </tr>
              <tr style="border-top: 1px solid rgba(255,255,255,0.3);">
                <td style="padding: 10px 0 5px 0;"><strong>Your Payout:</strong></td>
                <td style="text-align: right; padding: 10px 0 5px 0;"><strong>${formatAmount(payout)}</strong></td>
              </tr>
              <tr>
                <td style="padding: 5px 0; font-size: 14px;">Payment Method:</td>
                <td style="text-align: right; padding: 5px 0; font-size: 14px;">${paymentMethodLabel}</td>
              </tr>
            </table>
          </div>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; padding: 14px 40px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
            View Dashboard
          </a>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0; color: #666;">
            ${paymentMethod === "DIVINITYCOIN"
              ? "Your DivinityCoin balance has been credited automatically."
              : "Your payout will be processed according to your Stripe Connect settings."}
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because someone purchased your book on ${APP_NAME} Marketplace.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `New sale: "${bookTitle}" - ${formatAmount(payout)} earned!`,
    html,
  });
}

/**
 * Send payout created email to creator when an admin initiates a settlement
 */
export async function sendPayoutCreatedEmail(
  email: string,
  creatorName: string,
  projectTitle: string,
  projectUrlPath: string,
  totalRaised: number,
  partnerFee: number,
  platformFee: number,
  payoutAmount: number,
  bankName: string,
  accountLastFour: string
) {
  const projectUrl = `${APP_URL}${projectUrlPath}`;
  const formatAmount = (amt: number) => `$${amt.toFixed(2)}`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Payout Initiated!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #028858 0%, #10b981 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">Payout Initiated!</h2>

          <div style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: white;">${escapeHtml(projectTitle)}</h3>
            <p style="margin: 0; color: rgba(255,255,255,0.9);">A payout has been initiated for your campaign</p>
          </div>

          <div style="background: rgba(255,255,255,0.1); border-radius: 6px; padding: 15px; margin-top: 20px;">
            <table style="width: 100%; color: white;">
              <tr>
                <td style="padding: 5px 0;">Total Raised:</td>
                <td style="text-align: right; padding: 5px 0;">${formatAmount(totalRaised)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;">DivinityCoin Partner Fee:</td>
                <td style="text-align: right; padding: 5px 0;">-${formatAmount(partnerFee)}</td>
              </tr>
              <tr>
                <td style="padding: 5px 0;">Platform Fee (3%):</td>
                <td style="text-align: right; padding: 5px 0;">-${formatAmount(platformFee)}</td>
              </tr>
              <tr style="border-top: 1px solid rgba(255,255,255,0.3);">
                <td style="padding: 10px 0 5px 0;"><strong>Payout Amount:</strong></td>
                <td style="text-align: right; padding: 10px 0 5px 0;"><strong>${formatAmount(payoutAmount)}</strong></td>
              </tr>
            </table>
          </div>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 10px 0;"><strong>Bank Account:</strong></p>
          <p style="margin: 0; color: #666;">${bankName} ending in ****${accountLastFour}</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0;"><strong>What happens next?</strong></p>
          <p style="margin: 0; color: #666;">Your payout is being processed and will be sent to your bank account via wire transfer. This typically takes 3-5 business days. You will receive a confirmation once the transfer is complete.</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${projectUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            View Project
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>You received this email because a payout was initiated for your campaign on ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Payout initiated for "${projectTitle}" - ${formatAmount(payoutAmount)}`,
    html,
  });
}
