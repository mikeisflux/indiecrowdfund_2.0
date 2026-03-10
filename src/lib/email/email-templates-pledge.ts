import { sendEmail } from "./email-config";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

/**
 * Send pledge confirmation email to backer
 */
export async function sendPledgeConfirmationEmail(
  email: string,
  backerName: string,
  projectTitle: string,
  projectSlug: string,
  amount: number,
  rewardTitle: string | null,
  chargedImmediately: boolean,
  imageUrl?: string | null,
  currency: string = "USD",
  addons: Array<{ title: string; quantity: number; amount: number }> = [],
  shippingInfo?: {
    name: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    postalCode: string | null;
    country: string | null;
  } | null,
  projectUrlPath?: string,
  rewardAmount?: number,
  shippingAmount?: number,
  paymentMethod?: "STRIPE" | "DIVINITYCOIN",
  backerNumber?: number | null,
  confirmationNumber?: string
) {
  // Use provided projectUrlPath if available (for vanity URLs), otherwise fallback to legacy format
  const projectUrl = projectUrlPath ? `${APP_URL}${projectUrlPath}` : `${APP_URL}/projects/${projectSlug}`;
  const dashboardUrl = `${APP_URL}/dashboard`;

  // Ensure image URL is absolute
  const absoluteImageUrl = imageUrl
    ? (imageUrl.startsWith("http") ? imageUrl : `${APP_URL}${imageUrl.startsWith("/") ? "" : "/"}${imageUrl}`)
    : null;

  // Format amount with the project's currency
  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(value);

  const formattedAmount = formatCurrency(amount);

  const chargeMessage = chargedImmediately
    ? `Your payment of <strong>${formattedAmount}</strong> has been processed successfully.`
    : `Your card has been saved and will be charged <strong>${formattedAmount}</strong> when the campaign reaches its funding goal.`;

  // Build addons HTML
  const addonsHtml = addons.length > 0 ? addons.map(addon => `
    <tr>
      <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">Add-on: ${addon.title}${addon.quantity > 1 ? ` × ${addon.quantity}` : ""}</td>
      <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatCurrency(addon.amount)}</td>
    </tr>
  `).join("") : "";

  // Payment method label
  const paymentMethodLabel = paymentMethod === "DIVINITYCOIN" ? "DivinityCoin" : "Card";

  // Build shipping HTML
  const hasShipping = shippingInfo && (shippingInfo.address || shippingInfo.city || shippingInfo.country);
  const shippingHtml = hasShipping ? `
    <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h3 style="margin-top: 0;">Shipping Address</h3>
      <p style="margin: 0; color: #333;">
        ${shippingInfo!.name || backerName}<br>
        ${shippingInfo!.address || ""}<br>
        ${[shippingInfo!.city, shippingInfo!.state, shippingInfo!.postalCode].filter(Boolean).join(", ")}<br>
        ${shippingInfo!.country || ""}
      </p>
    </div>
  ` : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pledge Confirmation</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #028858 0%, #10b981 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <h2 style="margin-top: 0; color: white; text-align: center;">Thank You for Your Pledge!</h2>

          ${absoluteImageUrl ? `<img src="${absoluteImageUrl}" alt="${projectTitle}" style="width: 100%; max-width: 500px; height: auto; border-radius: 8px; margin: 20px auto; display: block;">` : ""}

          <div style="background: rgba(255,255,255,0.15); border-radius: 6px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: white;">${projectTitle}</h3>
            ${rewardTitle ? `<p style="margin: 0; color: rgba(255,255,255,0.9);">Reward: ${rewardTitle}</p>` : `<p style="margin: 0; color: rgba(255,255,255,0.9);">Pledge without reward</p>`}
            ${addons.length > 0 ? `<p style="margin: 5px 0 0 0; color: rgba(255,255,255,0.9);">+ ${addons.length} add-on${addons.length > 1 ? "s" : ""}</p>` : ""}
          </div>

          <p style="text-align: center; margin-bottom: 0;">Hi ${backerName || "there"},</p>
          <p style="text-align: center;">${chargeMessage}</p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Pledge Breakdown</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">${rewardTitle || "Pledge (no reward)"}</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${rewardAmount !== undefined ? formatCurrency(rewardAmount) : "—"}</td>
            </tr>
            ${addonsHtml}
            ${shippingAmount && shippingAmount > 0 ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">Shipping${shippingInfo?.country ? ` (${shippingInfo.country})` : ""}</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">${formatCurrency(shippingAmount)}</td>
            </tr>
            ` : ""}
            <tr style="background: #f0f0f0;">
              <td style="padding: 12px 8px; font-weight: 600; font-size: 16px;">Total</td>
              <td style="padding: 12px 8px; text-align: right; font-weight: 600; font-size: 16px; color: #028858;">${formattedAmount}</td>
            </tr>
          </table>
          <div style="margin-top: 15px; padding-top: 15px; border-top: 1px solid #e5e5e5;">
            <table style="width: 100%; border-collapse: collapse;">
              ${backerNumber ? `
              <tr>
                <td style="padding: 4px 0; color: #666;">Backer Number</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #028858;">#${backerNumber}</td>
              </tr>
              ` : ""}
              ${confirmationNumber ? `
              <tr>
                <td style="padding: 4px 0; color: #666;">Confirmation #</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 500; font-family: monospace; font-size: 12px;">${confirmationNumber}</td>
              </tr>
              ` : ""}
              <tr>
                <td style="padding: 4px 0; color: #666;">Payment Method</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 500;">${paymentMethodLabel}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #666;">Status</td>
                <td style="padding: 4px 0; text-align: right; font-weight: 600; color: #028858;">${chargedImmediately ? "✓ Paid" : "Card Saved"}</td>
              </tr>
            </table>
          </div>
        </div>

        ${shippingHtml}

        ${!chargedImmediately ? `
        <div style="background: #fffbeb; border-radius: 8px; padding: 15px; margin-bottom: 20px; border: 1px solid #fef3c7;">
          <p style="margin: 0; font-size: 14px;"><strong>Note:</strong> Your card will only be charged if the campaign successfully reaches its funding goal. If the campaign doesn't reach its goal, you won't be charged.</p>
        </div>
        ` : ""}

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 15px 0;"><strong>What happens next?</strong></p>
          <p style="margin: 0; color: #666;">You'll receive updates from the creator as the project progresses. ${!hasShipping ? "We'll send you a survey to collect shipping details closer to the estimated delivery date." : "The creator will reach out when it's time to ship your rewards."}</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${projectUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 10px;">
            View Project
          </a>
          <a href="${dashboardUrl}" style="display: inline-block; background: #333; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            My Dashboard
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because you backed a project on ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const subject = `Your pledge for "${projectTitle}" is confirmed!`;
  const result = await sendEmail({
    to: email,
    subject,
    html,
    skipUnsubscribeCheck: true, // Transactional: always send pledge confirmations
  });

  // Return both the result and the email content for logging
  return {
    ...result,
    subject,
    html,
  };
}

/**
 * Send pledge modification email (price change / addon swap)
 */
export async function sendPledgeModificationEmail(
  email: string,
  backerName: string,
  projectTitle: string,
  oldAmount: number,
  newAmount: number,
  amountDifference: number,
  changeType: "upcharge" | "refund" | "no_change",
  newRewardTitle: string | null,
  newAddons: Array<{ title: string; quantity: number; amount: number }>,
  projectUrlPath?: string,
  currency: string = "USD"
) {
  const dashboardUrl = `${APP_URL}/dashboard/backer`;
  const currencySymbol = currency === "USD" ? "$" : currency;

  const changeLabel = changeType === "upcharge"
    ? `An additional charge of <strong>${currencySymbol}${Math.abs(amountDifference).toFixed(2)}</strong> has been applied to your payment method.`
    : changeType === "refund"
    ? `A refund of <strong>${currencySymbol}${Math.abs(amountDifference).toFixed(2)}</strong> has been issued to your original payment method. This typically takes 5-10 business days to appear.`
    : "Your selections have been updated with no price change.";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pledge Updated</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Pledge Updated</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Your pledge for "${projectTitle}" has been modified</p>
        </div>

        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <p style="font-size: 16px;">Hi ${backerName || "Backer"},</p>

          <p>Your pledge selections have been updated successfully.</p>

          <div style="background: #f8f9fa; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #666;">Previous Amount</td>
                <td style="padding: 8px 0; text-align: right; text-decoration: line-through; color: #999;">${currencySymbol}${oldAmount.toFixed(2)}</td>
              </tr>
              <tr style="border-top: 1px solid #e0e0e0;">
                <td style="padding: 8px 0; font-weight: bold;">New Amount</td>
                <td style="padding: 8px 0; text-align: right; font-weight: bold; font-size: 18px; color: #10b981;">${currencySymbol}${newAmount.toFixed(2)}</td>
              </tr>
              ${amountDifference !== 0 ? `
              <tr style="border-top: 1px solid #e0e0e0;">
                <td style="padding: 8px 0; color: ${changeType === "refund" ? "#10b981" : "#f59e0b"};">${changeType === "refund" ? "Refund" : "Additional Charge"}</td>
                <td style="padding: 8px 0; text-align: right; color: ${changeType === "refund" ? "#10b981" : "#f59e0b"}; font-weight: bold;">${changeType === "refund" ? "-" : "+"}${currencySymbol}${Math.abs(amountDifference).toFixed(2)}</td>
              </tr>
              ` : ""}
            </table>
          </div>

          ${newRewardTitle ? `
          <div style="margin: 15px 0;">
            <p style="font-weight: bold; margin-bottom: 5px;">Reward Tier:</p>
            <p style="color: #666; margin: 0;">${newRewardTitle}</p>
          </div>
          ` : ""}

          ${newAddons.length > 0 ? `
          <div style="margin: 15px 0;">
            <p style="font-weight: bold; margin-bottom: 5px;">Add-ons:</p>
            ${newAddons.map(a => `<p style="color: #666; margin: 2px 0;">${a.title} x${a.quantity} — ${currencySymbol}${(a.amount * a.quantity).toFixed(2)}</p>`).join("")}
          </div>
          ` : ""}

          <div style="background: ${changeType === "refund" ? "#ecfdf5" : changeType === "upcharge" ? "#fffbeb" : "#f0fdf4"}; border-left: 4px solid ${changeType === "refund" ? "#10b981" : changeType === "upcharge" ? "#f59e0b" : "#22c55e"}; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px;">${changeLabel}</p>
          </div>

          <div style="text-align: center; margin-top: 25px;">
            <a href="${dashboardUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: bold;">View My Dashboard</a>
          </div>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because you modified your pledge on ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const subject = changeType === "refund"
    ? `Pledge updated — ${currencySymbol}${Math.abs(amountDifference).toFixed(2)} refund for "${projectTitle}"`
    : changeType === "upcharge"
    ? `Pledge updated — ${currencySymbol}${Math.abs(amountDifference).toFixed(2)} additional charge for "${projectTitle}"`
    : `Your pledge for "${projectTitle}" has been updated`;

  const result = await sendEmail({ to: email, subject, html });
  return { ...result, subject, html };
}

/**
 * Send pledge cancellation/refund email
 */
export async function sendPledgeCancellationEmail(
  email: string,
  backerName: string,
  projectTitle: string,
  amount: number,
  wasRefunded: boolean,
  projectUrlPath?: string,
  currency: string = "USD"
) {
  const projectUrl = projectUrlPath ? `${APP_URL}${projectUrlPath}` : `${APP_URL}/discover`;
  const currencySymbol = currency === "USD" ? "$" : currency;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Pledge Cancelled</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
        <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Pledge Cancelled</h1>
          <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">"${projectTitle}"</p>
        </div>

        <div style="background: white; padding: 30px; border-radius: 0 0 12px 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <p style="font-size: 16px;">Hi ${backerName || "Backer"},</p>

          <p>Your pledge of <strong>${currencySymbol}${amount.toFixed(2)}</strong> for "${projectTitle}" has been cancelled.</p>

          ${wasRefunded ? `
          <div style="background: #ecfdf5; border-left: 4px solid #10b981; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
            <p style="margin: 0; font-weight: bold; color: #065f46;">Refund Processed</p>
            <p style="margin: 5px 0 0; font-size: 14px; color: #047857;">A full refund of <strong>${currencySymbol}${amount.toFixed(2)}</strong> has been issued to your original payment method. This typically takes 5-10 business days to appear on your statement.</p>
          </div>
          ` : `
          <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 15px; border-radius: 0 8px 8px 0; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #166534;">No payment was collected for this pledge, so no refund is necessary. Your payment authorization has been released.</p>
          </div>
          `}

          <p style="color: #666; font-size: 14px;">If you cancelled by mistake or change your mind, you can always back this project again while the campaign is still active.</p>

          <div style="text-align: center; margin-top: 25px;">
            <a href="${projectUrl}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-weight: bold;">Discover Projects</a>
          </div>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because your pledge on ${APP_NAME} was cancelled.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const subject = wasRefunded
    ? `Pledge cancelled — ${currencySymbol}${amount.toFixed(2)} refund for "${projectTitle}"`
    : `Your pledge for "${projectTitle}" has been cancelled`;

  const result = await sendEmail({ to: email, subject, html });
  return { ...result, subject, html };
}

/**
 * Send survey completion confirmation email to backer
 */
export async function sendSurveyCompletionEmail(
  email: string,
  backerName: string,
  projectTitle: string,
  rewardTitle: string | null,
  projectSlug: string,
  projectUrlPath?: string,
) {
  const projectUrl = projectUrlPath ? `${APP_URL}${projectUrlPath}` : `${APP_URL}/projects/${projectSlug}`;
  const dashboardUrl = `${APP_URL}/dashboard/backer`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Survey Completed</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #028858 0%, #10b981 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <div style="text-align: center; margin-bottom: 15px;">
            <div style="display: inline-block; background: rgba(255,255,255,0.2); border-radius: 50%; width: 60px; height: 60px; line-height: 60px; font-size: 28px;">
              &#10003;
            </div>
          </div>
          <h2 style="margin-top: 0; color: white; text-align: center;">Survey Completed!</h2>
          <p style="text-align: center; margin-bottom: 0; color: rgba(255,255,255,0.9);">
            Hi ${backerName || "there"}, we've received your survey response for <strong>${projectTitle}</strong>.
          </p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Your Response Has Been Recorded</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; color: #666;">Project</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 500;">${projectTitle}</td>
            </tr>
            ${rewardTitle ? `
            <tr>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; color: #666;">Reward Tier</td>
              <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right; font-weight: 500;">${rewardTitle}</td>
            </tr>
            ` : ""}
            <tr>
              <td style="padding: 8px 0; color: #666;">Status</td>
              <td style="padding: 8px 0; text-align: right; font-weight: 600; color: #028858;">&#10003; Complete</td>
            </tr>
          </table>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p style="margin: 0 0 10px 0;"><strong>What happens next?</strong></p>
          <p style="margin: 0; color: #666;">The creator now has everything they need to prepare your rewards. You'll receive another email when your order ships. If you need to make any changes, reach out to the project creator.</p>
        </div>

        <div style="text-align: center; margin: 20px 0;">
          <a href="${projectUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 10px;">
            View Project
          </a>
          <a href="${dashboardUrl}" style="display: inline-block; background: #333; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
            My Dashboard
          </a>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because you completed a survey on ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const subject = `Survey completed for "${projectTitle}"`;
  const result = await sendEmail({
    to: email,
    subject,
    html,
    skipUnsubscribeCheck: true,
  });

  return { ...result, subject, html };
}

/**
 * Send balance due email to backer when order has been edited and additional payment is needed
 */
export async function sendBalanceDueEmail(
  email: string,
  backerName: string,
  projectTitle: string,
  projectSlug: string,
  balanceDue: number,
  paymentToken: string,
  rewardTitle: string | null,
  addons: Array<{ title: string; quantity: number; amount: number }> = [],
  projectUrlPath?: string,
  currency: string = "USD",
) {
  const paymentUrl = `${APP_URL}/pay/balance/${paymentToken}`;
  const projectUrl = projectUrlPath ? `${APP_URL}${projectUrlPath}` : `${APP_URL}/projects/${projectSlug}`;

  const formatCurrency = (value: number) => new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency,
  }).format(value);

  const formattedBalance = formatCurrency(balanceDue);

  const addonsHtml = addons.length > 0 ? `
    <div style="margin-top: 15px;">
      <p style="margin: 0 0 8px 0; font-weight: 600; font-size: 14px;">Current Order Items:</p>
      <table style="width: 100%; border-collapse: collapse;">
        ${rewardTitle ? `
        <tr>
          <td style="padding: 6px 0; border-bottom: 1px solid #eee; font-size: 14px;">${rewardTitle}</td>
          <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 14px;">Reward</td>
        </tr>
        ` : ""}
        ${addons.map(a => `
        <tr>
          <td style="padding: 6px 0; border-bottom: 1px solid #eee; font-size: 14px;">${a.title} x${a.quantity}</td>
          <td style="padding: 6px 0; border-bottom: 1px solid #eee; text-align: right; font-size: 14px;">${formatCurrency(a.amount * a.quantity)}</td>
        </tr>
        `).join("")}
      </table>
    </div>
  ` : "";

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Balance Due</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); border-radius: 8px; padding: 30px; margin-bottom: 20px; color: white;">
          <div style="text-align: center; margin-bottom: 15px;">
            <div style="display: inline-block; background: rgba(255,255,255,0.2); border-radius: 50%; width: 60px; height: 60px; line-height: 60px; font-size: 28px;">
              &#36;
            </div>
          </div>
          <h2 style="margin-top: 0; color: white; text-align: center;">Balance Due on Your Order</h2>
          <p style="text-align: center; margin-bottom: 0; color: rgba(255,255,255,0.9);">
            Hi ${backerName || "there"}, your order for <strong>${projectTitle}</strong> has been updated and there is an outstanding balance.
          </p>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h3 style="margin-top: 0;">Payment Required</h3>
          <p style="margin: 0 0 10px 0;">
            Your order has been modified and you have an outstanding balance of:
          </p>
          <div style="text-align: center; padding: 15px; background: white; border-radius: 8px; border: 2px solid #0d9488; margin: 15px 0;">
            <p style="font-size: 32px; font-weight: bold; color: #0d9488; margin: 0;">${formattedBalance}</p>
            <p style="font-size: 14px; color: #666; margin: 5px 0 0 0;">Amount Due</p>
          </div>
          ${addonsHtml}
        </div>

        <div style="text-align: center; margin-bottom: 20px;">
          <a href="${paymentUrl}" style="display: inline-block; background: #0d9488; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
            Pay ${formattedBalance} Now
          </a>
          <p style="font-size: 12px; color: #999; margin-top: 10px;">
            This payment link expires in 30 days.
          </p>
        </div>

        <div style="background: #f0f9ff; border-radius: 8px; padding: 15px; margin-bottom: 20px; border-left: 4px solid #0d9488;">
          <p style="margin: 0; font-size: 14px; color: #555;">
            If you have any questions about this charge, please contact the project creator through the
            <a href="${projectUrl}" style="color: #0d9488;">project page</a>.
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px; margin-top: 30px;">
          <p>You received this email because you backed "${projectTitle}" on ${APP_NAME}.</p>
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const subject = `Balance due: ${formattedBalance} for "${projectTitle}"`;
  const result = await sendEmail({ to: email, subject, html, skipUnsubscribeCheck: true });
  return { ...result, subject, html };
}
