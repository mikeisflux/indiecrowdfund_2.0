import { sendEmail } from "./email-config";

const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "IndieCrowdfund";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

export interface PayoutDetailsIncompleteEmailInput {
  email: string;
  creatorName: string | null;
  accounts: { label: string; exists: boolean; missing: string[]; projects: { title: string }[] }[];
}

/**
 * "We can't pay you until you finish your payout details." Transactional:
 * it concerns money owed to the recipient, so it bypasses marketing
 * unsubscribes. The dashboard link lands on the blocking fix-it screen.
 */
export async function sendPayoutDetailsIncompleteEmail({ email, creatorName, accounts }: PayoutDetailsIncompleteEmailInput) {
  const dashboardUrl = `${APP_URL}/dashboard`;
  const items = accounts
    .map((a) => {
      const projects = a.projects.length
        ? `<p style="margin: 6px 0 0 0; color: #666; font-size: 13px;">Campaigns: ${a.projects.map((p) => escapeHtml(p.title)).join(", ")}</p>`
        : "";
      const what = a.exists
        ? `Missing: <strong>${a.missing.map(escapeHtml).join(", ")}</strong>`
        : `No bank account on file`;
      return `
        <div style="background: white; border-radius: 6px; padding: 14px 16px; margin: 12px 0; border-left: 4px solid #d97706;">
          <p style="margin: 0; font-weight: 600;">${escapeHtml(a.label)} payout account</p>
          <p style="margin: 6px 0 0 0;">${what}</p>
          ${projects}
        </div>`;
    })
    .join("");

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Action required: finish your payout details</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #fffbeb; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #fde68a;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #d97706; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              ACTION REQUIRED
            </div>
          </div>

          <h2 style="margin-top: 0; color: #92400e; text-align: center;">We can't send your payout yet</h2>
          <p>Hi ${escapeHtml(creatorName || "there")},</p>
          <p>Your payout account on ${APP_NAME} is missing information we need before we can transfer funds to you. Banks require a full billing address on the payee record, and we can't complete a settlement without it.</p>

          ${items}

          <p>It takes about a minute. Sign in and your dashboard will take you straight to the form; you'll need your bank details handy.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #d97706; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Finish payout details
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            Until this is done your dashboard stays locked to this one step, and any settlement owed to you is held. Your information is encrypted and used only to process payouts.
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: email,
    subject: `Action required: finish your ${APP_NAME} payout details`,
    html,
    skipUnsubscribeCheck: true,
  });
}
