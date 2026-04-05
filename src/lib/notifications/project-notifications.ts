import { db } from "@/lib/db";
import { isEmailTypeEnabled } from "@/lib/email";
import { createNotification } from "./core";
import {
  sendProjectFundedEmail,
  sendProjectLaunchEmail,
  sendProjectUpdateEmail,
} from "./email-templates";
import type { NotificationType } from "./types";

import { logger } from "@/lib/logger";

const notificationsProjectNotificationsLogger = logger.child({ module: "notifications-project-notifications" });


/**
 * Notify backers when a project is funded
 */
export async function notifyProjectFunded(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      slug: true,
      imageUrl: true,
      creator: {
        select: { vanityUrl: true },
      },
      pledges: {
        select: { userId: true },
        distinct: ["userId"],
      },
    },
  });

  if (!project) return;

  // Build project URL with vanity URL if available
  const projectUrlPath = project.creator?.vanityUrl
    ? `/projects/${project.creator.vanityUrl}/${project.slug}`
    : `/projects/${project.slug}`;

  // Notify all unique backers
  const notifications = project.pledges.map((pledge: { userId: string }) => ({
    userId: pledge.userId,
    type: "PROJECT_FUNDED" as NotificationType,
    title: "Project Funded!",
    message: `"${project.title}" has reached its funding goal!`,
    actionUrl: projectUrlPath,
    projectId,
  }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }

  // Get backer emails and send email notifications
  const backerIds = project.pledges.map((p: { userId: string }) => p.userId);
  if (backerIds.length > 0) {
    const backers = await db.user.findMany({
      where: { id: { in: backerIds } },
      select: { email: true },
    });

    const uniqueEmails = Array.from(new Set(backers.map((b) => b.email)));

    // Send emails in batches
    const batchSize = 10;
    for (let i = 0; i < uniqueEmails.length; i += batchSize) {
      const batch = uniqueEmails.slice(i, i + batchSize);
      await Promise.all(
        batch.map((email) =>
          sendProjectFundedEmail(email, project.title, projectUrlPath, project.imageUrl)
        )
      );
    }

    if (uniqueEmails.length > 0) {
      notificationsProjectNotificationsLogger.info(`Sent project funded emails to ${uniqueEmails.length} backers for project: ${project.title}`);
    }
  }
}

/**
 * Notify followers when a project launches
 */
export async function notifyProjectLaunched(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      slug: true,
      imageUrl: true,
      creatorId: true,
      creator: {
        select: { name: true, vanityUrl: true },
      },
      followers: {
        select: { userId: true, email: true },
      },
    },
  });

  if (!project) return;

  // Build project URL with vanity URL if available
  const projectUrlPath = project.creator?.vanityUrl
    ? `/projects/${project.creator.vanityUrl}/${project.slug}`
    : `/projects/${project.slug}`;

  // Collect emails to send - both from user accounts and direct email followers
  const emailsToSend: string[] = [];

  // Get user emails for logged-in followers
  const userIds = project.followers
    .filter((f: { userId: string | null }) => f.userId && f.userId !== project.creatorId)
    .map((f: { userId: string | null }) => f.userId as string);

  if (userIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: userIds } },
      select: { email: true },
    });
    users.forEach((u) => emailsToSend.push(u.email));
  }

  // Add email-only followers (prelaunch sign-ups without accounts)
  project.followers
    .filter((f: { userId: string | null; email: string | null }) => !f.userId && f.email)
    .forEach((f: { email: string | null }) => {
      if (f.email) emailsToSend.push(f.email);
    });

  // Notify all followers (except the creator) - in-app notifications
  const notifications = project.followers
    .filter((f: { userId: string | null }): f is { userId: string } => f.userId !== null && f.userId !== project.creatorId)
    .map((follower: { userId: string }) => ({
      userId: follower.userId,
      type: "PROJECT_LAUNCHED" as NotificationType,
      title: "Project Launched!",
      message: `"${project.title}" is now live!`,
      actionUrl: projectUrlPath,
      projectId,
    }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }

  // Notify the creator
  await createNotification({
    userId: project.creatorId,
    type: "PROJECT_LAUNCHED",
    title: "Your project is live!",
    message: `"${project.title}" has been launched successfully.`,
    actionUrl: projectUrlPath,
    projectId,
  });

  // Send emails to all followers (deduplicated)
  const uniqueEmails = Array.from(new Set(emailsToSend));
  const creatorName = project.creator?.name || "Creator";

  // Send emails in parallel (but not all at once to avoid rate limits)
  const batchSize = 10;
  for (let i = 0; i < uniqueEmails.length; i += batchSize) {
    const batch = uniqueEmails.slice(i, i + batchSize);
    await Promise.all(
      batch.map((email) =>
        sendProjectLaunchEmail(
          email,
          project.title,
          projectUrlPath,
          creatorName,
          project.imageUrl
        )
      )
    );
  }

  // Log the email sends
  if (uniqueEmails.length > 0) {
    notificationsProjectNotificationsLogger.info(`Sent project launch emails to ${uniqueEmails.length} followers for project: ${project.title}`);
  }
}

/**
 * Notify backers when a project update is posted
 */
export async function notifyProjectUpdate(
  projectId: string,
  updateTitle: string,
  updateContent?: string,
  updateId?: string
) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      slug: true,
      creatorId: true,
      creator: {
        select: { name: true, vanityUrl: true },
      },
      pledges: {
        select: { userId: true },
        distinct: ["userId"],
      },
      followers: {
        select: { userId: true, email: true },
      },
    },
  });

  if (!project) return;

  // Build project URL with vanity URL if available
  const projectUrlPath = project.creator?.vanityUrl
    ? `/projects/${project.creator.vanityUrl}/${project.slug}`
    : `/projects/${project.slug}`;

  // Combine backers and followers (unique users except creator)
  const userIds = new Set<string>();
  project.pledges.forEach((p: { userId: string }) => userIds.add(p.userId));
  project.followers.forEach((f: { userId: string | null }) => {
    if (f.userId) userIds.add(f.userId);
  });
  userIds.delete(project.creatorId);

  const notifications = Array.from(userIds).map((userId) => ({
    userId,
    type: "PROJECT_UPDATE" as NotificationType,
    title: "New Update",
    message: `"${project.title}" posted: ${updateTitle}`,
    actionUrl: projectUrlPath,
    projectId,
    senderId: project.creatorId,
  }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }

  // Check if project update notifications are enabled before sending emails
  const projectUpdateEnabled = await isEmailTypeEnabled("projectUpdate");

  if (!projectUpdateEnabled) {
    notificationsProjectNotificationsLogger.info(`Project update notifications are disabled in settings`);
    return;
  }

  // Send emails to all users (backers + followers with userId) and email-only followers
  const emailsToSend: string[] = [];

  // Get emails for user-based followers and backers
  const allUserIds = Array.from(userIds);
  if (allUserIds.length > 0) {
    const users = await db.user.findMany({
      where: { id: { in: allUserIds } },
      select: { email: true },
    });
    users.forEach((u) => emailsToSend.push(u.email));
  }

  // Add email-only followers
  project.followers
    .filter((f: { userId: string | null; email: string | null }) => !f.userId && f.email)
    .forEach((f: { email: string | null }) => {
      if (f.email) emailsToSend.push(f.email);
    });

  const uniqueEmails = Array.from(new Set(emailsToSend));
  const creatorName = project.creator?.name || "Creator";

  // Send emails in batches
  const batchSize = 10;
  for (let i = 0; i < uniqueEmails.length; i += batchSize) {
    const batch = uniqueEmails.slice(i, i + batchSize);
    await Promise.all(
      batch.map((email) =>
        sendProjectUpdateEmail(
          email,
          project.title,
          projectUrlPath,
          updateTitle,
          creatorName,
          updateContent,
          updateId
        )
      )
    );
  }

  if (uniqueEmails.length > 0) {
    notificationsProjectNotificationsLogger.info(`Sent project update emails to ${uniqueEmails.length} users for project: ${project.title}`);
  }
}

/**
 * Notify backers when their project ends
 */
export async function notifyProjectEnded(projectId: string) {
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      slug: true,
      creatorId: true,
      currentAmount: true,
      goalAmount: true,
      creator: {
        select: { vanityUrl: true },
      },
      pledges: {
        select: { userId: true },
        distinct: ["userId"],
      },
    },
  });

  if (!project) return;

  // Build project URL with vanity URL if available
  const projectUrlPath = project.creator?.vanityUrl
    ? `/projects/${project.creator.vanityUrl}/${project.slug}`
    : `/projects/${project.slug}`;

  const funded = Number(project.currentAmount) >= Number(project.goalAmount);
  const message = funded
    ? `"${project.title}" has successfully ended! Thanks for your support.`
    : `"${project.title}" has ended. Unfortunately, it did not reach its funding goal.`;

  const notifications = project.pledges.map((pledge: { userId: string }) => ({
    userId: pledge.userId,
    type: "PROJECT_ENDED" as NotificationType,
    title: funded ? "Campaign Successful!" : "Campaign Ended",
    message,
    actionUrl: projectUrlPath,
    projectId,
  }));

  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }

  // Notify creator
  await createNotification({
    userId: project.creatorId,
    type: "PROJECT_ENDED",
    title: funded ? "Your Campaign Succeeded!" : "Your Campaign Has Ended",
    message: funded
      ? `"${project.title}" reached its goal!`
      : `"${project.title}" ended without reaching its goal.`,
    actionUrl: projectUrlPath,
    projectId,
  });
}

