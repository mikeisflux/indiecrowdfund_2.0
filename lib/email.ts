import { Resend } from "resend"
import WelcomeEmail from "@/emails/welcome"
import PledgeConfirmationEmail from "@/emails/pledge-confirmation"
import ProjectLaunchedEmail from "@/emails/project-launched"

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendWelcomeEmail(to: string, name: string) {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@indiecrowdfund.com",
      to,
      subject: "Welcome to Indiecrowdfund!",
      react: WelcomeEmail({
        name,
        loginUrl: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
      }),
    })
  } catch (error) {
    console.error("Failed to send welcome email:", error)
  }
}

export async function sendPledgeConfirmation({
  to,
  backerName,
  projectTitle,
  amount,
  rewardTitle,
  projectSlug,
}: {
  to: string
  backerName: string
  projectTitle: string
  amount: string
  rewardTitle?: string
  projectSlug: string
}) {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@indiecrowdfund.com",
      to,
      subject: `Your pledge to ${projectTitle} is confirmed!`,
      react: PledgeConfirmationEmail({
        backerName,
        projectTitle,
        amount,
        rewardTitle,
        projectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/project/${projectSlug}`,
      }),
    })
  } catch (error) {
    console.error("Failed to send pledge confirmation:", error)
  }
}

export async function sendProjectLaunchedEmail({
  to,
  creatorName,
  projectTitle,
  projectSlug,
  projectId,
}: {
  to: string
  creatorName: string
  projectTitle: string
  projectSlug: string
  projectId: string
}) {
  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM || "noreply@indiecrowdfund.com",
      to,
      subject: `Your project ${projectTitle} is now live!`,
      react: ProjectLaunchedEmail({
        creatorName,
        projectTitle,
        projectUrl: `${process.env.NEXT_PUBLIC_APP_URL}/project/${projectSlug}`,
        dashboardUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/project/${projectId}`,
      }),
    })
  } catch (error) {
    console.error("Failed to send project launched email:", error)
  }
}
