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

// Project Review Email Functions
export async function sendProjectSubmittedEmail(
  email: string,
  creatorName: string,
  projectTitle: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Submitted for Review</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f0f9ff; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #bae6fd;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #0ea5e9; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              UNDER REVIEW
            </div>
          </div>

          <h2 style="margin-top: 0; color: #0369a1; text-align: center;">Project Submitted!</h2>
          <p>Hi ${escapeHtml(creatorName || "Creator")},</p>
          <p>Your project <strong>&ldquo;${escapeHtml(projectTitle)}&rdquo;</strong> has been submitted for review.</p>

          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>What happens next?</strong></p>
            <p style="margin: 10px 0 0 0;">Our team will review your project within 1-2 business days. We'll notify you by email once the review is complete.</p>
          </div>

          <p>In the meantime, you can continue to make edits to your project. Any changes will be included in the review.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #0ea5e9; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              View Your Projects
            </a>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Thank you for using ${APP_NAME}!
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
    subject: `Your project "${projectTitle.replace(/[\r\n]/g, " ")}" is under review`,
    html,
  });
}

export async function sendProjectApprovedEmail(
  email: string,
  creatorName: string,
  projectTitle: string,
  projectSlug: string,
  notes?: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Your Project Has Been Approved!</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f0fdf4; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #bbf7d0;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #22c55e; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              ✓ APPROVED
            </div>
          </div>

          <h2 style="margin-top: 0; color: #15803d; text-align: center;">Congratulations, ${escapeHtml(creatorName || "Creator")}!</h2>
          <p style="text-align: center;">Your project <strong>&ldquo;${escapeHtml(projectTitle)}&rdquo;</strong> has been approved and is ready to launch!</p>

          ${notes ? `
          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #22c55e;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Notes from reviewer:</strong></p>
            <p style="margin: 10px 0 0 0;">${escapeHtml(notes)}</p>
          </div>
          ` : ""}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #22c55e; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Launch Your Project
            </a>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Head to your dashboard to set your launch date and go live!
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
    subject: `🎉 Your project "${projectTitle.replace(/[\r\n]/g, " ")}" has been approved!`,
    html,
  });
}

export async function sendProjectRejectedEmail(
  email: string,
  creatorName: string,
  projectTitle: string,
  rejectionReason: string,
  notes?: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const reasonLabels: Record<string, string> = {
    INCOMPLETE_INFORMATION: "Incomplete Information",
    POLICY_VIOLATION: "Policy Violation",
    PROHIBITED_CONTENT: "Prohibited Content",
    INTELLECTUAL_PROPERTY: "Intellectual Property Issues",
    FRAUD_SUSPECTED: "Suspected Fraud",
    UNREALISTIC_GOALS: "Unrealistic Goals",
    MISSING_REWARDS: "Missing or Inadequate Rewards",
    IDENTITY_VERIFICATION: "Identity Verification Required",
    OTHER: "Other",
  };

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Review Update</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #fef2f2; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #fecaca;">
          <h2 style="margin-top: 0; color: #dc2626;">Project Not Approved</h2>
          <p>Hi ${escapeHtml(creatorName || "Creator")},</p>
          <p>Unfortunately, your project <strong>&ldquo;${escapeHtml(projectTitle)}&rdquo;</strong> was not approved at this time.</p>

          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Reason:</strong></p>
            <p style="margin: 10px 0 0 0; font-weight: 500;">${escapeHtml(reasonLabels[rejectionReason] || rejectionReason)}</p>
          </div>

          ${notes ? `
          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Reviewer feedback:</strong></p>
            <p style="margin: 10px 0 0 0;">${escapeHtml(notes)}</p>
          </div>
          ` : ""}

          <p>You may edit your project and resubmit it for review. Please address the issues mentioned above before resubmitting.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #333; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500;">
              Edit Project
            </a>
          </div>

          <p style="color: #666; font-size: 14px;">
            If you have questions about this decision, please contact our support team.
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
    subject: `Update on your project "${projectTitle.replace(/[\r\n]/g, " ")}"`,
    html,
  });
}

export async function sendProjectChangesRequestedEmail(
  email: string,
  creatorName: string,
  projectTitle: string,
  notes: string
) {
  const dashboardUrl = `${APP_URL}/dashboard/projects`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Changes Requested for Your Project</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #fffbeb; border-radius: 8px; padding: 30px; margin-bottom: 20px; border: 1px solid #fef3c7;">
          <div style="text-align: center; margin-bottom: 20px;">
            <div style="display: inline-block; background: #f59e0b; color: white; padding: 10px 20px; border-radius: 50px; font-size: 14px; font-weight: 600;">
              CHANGES REQUESTED
            </div>
          </div>

          <h2 style="margin-top: 0; color: #d97706; text-align: center;">Almost There!</h2>
          <p>Hi ${escapeHtml(creatorName || "Creator")},</p>
          <p>Your project <strong>&ldquo;${escapeHtml(projectTitle)}&rdquo;</strong> is close to being approved, but we need a few changes first.</p>

          <div style="background: white; border-radius: 6px; padding: 15px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <p style="margin: 0; color: #666; font-size: 14px;"><strong>Requested changes:</strong></p>
            <p style="margin: 10px 0 0 0;">${escapeHtml(notes)}</p>
          </div>

          <p>Please make these changes and resubmit your project for review.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${dashboardUrl}" style="display: inline-block; background: #f59e0b; color: #fff; padding: 14px 35px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
              Edit Your Project
            </a>
          </div>

          <p style="color: #666; font-size: 14px; text-align: center;">
            Once you've made the requested changes, click "Submit for Review" again.
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
    subject: `Changes requested for "${projectTitle.replace(/[\r\n]/g, " ")}"`,
    html,
  });
}

export async function sendCollaboratorInviteEmail(
  email: string,
  inviterName: string,
  projectTitle: string,
  collaboratorId: string,
  options?: { fromEmail?: string; fromName?: string; replyTo?: string }
) {
  const respondUrl = `${APP_URL}/collaborate/${collaboratorId}`;

  const plainTextContent = `You've Been Invited to Collaborate!\n\n${inviterName} has invited you to collaborate on the project "${projectTitle}".\n\nAs a collaborator, you'll be able to help manage this project based on the permissions granted to you.\n\nAccept or view the invitation: ${respondUrl}\n\nYou'll need to log in to your ${APP_NAME} account to accept or decline this invitation.`;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You've Been Invited to Collaborate</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h1 style="color: #333; margin: 0;">${APP_NAME}</h1>
        </div>

        <div style="background: #f9f9f9; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
          <h2 style="margin-top: 0; color: #333;">You've Been Invited to Collaborate!</h2>
          <p><strong>${escapeHtml(inviterName || "")}</strong> has invited you to collaborate on the project:</p>

          <div style="background: #fff; border: 1px solid #e5e5e5; border-radius: 6px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: #333;">${escapeHtml(projectTitle || "")}</h3>
          </div>

          <p>As a collaborator, you'll be able to help manage this project based on the permissions granted to you.</p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${respondUrl}" style="display: inline-block; background: #028858; color: #fff; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; margin-right: 10px;">
              Accept Invitation
            </a>
            <a href="${respondUrl}" style="display: inline-block; background: #fff; color: #666; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 500; border: 1px solid #ddd;">
              View Details
            </a>
          </div>

          <p style="color: #666; font-size: 14px; margin-bottom: 0;">
            You'll need to log in to your ${APP_NAME} account to accept or decline this invitation.
          </p>
        </div>

        <div style="text-align: center; color: #999; font-size: 12px;">
          <p>&copy; ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.</p>
        </div>
      </body>
    </html>
  `;

  const subject = `${inviterName.replace(/[\r\n]/g, " ")} invited you to collaborate on "${projectTitle.replace(/[\r\n]/g, " ")}"`;

  const result = await sendEmail({
    to: email,
    subject,
    html,
    text: plainTextContent,
    skipUnsubscribeCheck: true, // Collaborator invites are transactional
    // Use platform default FROM (same as admin compose) for reliable delivery,
    // but set reply-to to creator's email so replies go to them
    ...(options?.replyTo && {
      replyTo: options.replyTo,
    }),
  });

  return { ...result, subject, plainTextContent };
}
