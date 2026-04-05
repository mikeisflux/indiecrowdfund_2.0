type TimelineEntry = {
  id: string;
  type: string;
  time: string;
  title: string;
  detail: string;
  date: string;
  sortDate: Date;
};

const activityTypeMap: Record<string, string> = {
  SURVEY_SENT: "survey_reminder", SURVEY_REMINDER: "survey_reminder", SURVEY_COMPLETED: "survey_completed",
  ORDERS_LOCKED: "orders_pushed", ADDRESSES_LOCKED: "address_updated", CARDS_CHARGED: "cards_charged",
  CHARGE_FAILED: "charge_failed", ORDERS_PUSHED: "orders_pushed", PUSH_FAILED: "charge_failed",
  ORDER_SHIPPED: "order_shipped", ORDER_DELIVERED: "order_shipped", DIGITAL_DISTRIBUTED: "digital_download",
  ADDRESS_UPDATED: "address_updated", REFUND_ISSUED: "refund", NOTE_ADDED: "comment", BALANCE_ADJUSTED: "cards_charged",
};

function formatDateLabel(date: Date, today: Date, yesterday: Date) {
  const dateOnly = new Date(date);
  dateOnly.setHours(0, 0, 0, 0);
  if (dateOnly.getTime() === today.getTime()) return "TODAY";
  if (dateOnly.getTime() === yesterday.getTime()) return "YESTERDAY";
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }).toUpperCase();
}

function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

type ActivityType = { id: string; type: string; createdAt: Date; title: string; description: string | null };

interface TimelineInput {
  recentActivity: ActivityType[];
  pledges: {
    id: string;
    status: string;
    amount: unknown;
    createdAt: Date;
    user: { name: string | null };
    reward: { title: string } | null;
  }[];
  surveyResponses: {
    id: string;
    pledgeId: string;
    isComplete: boolean;
    completedAt: Date | null;
  }[];
  emailCampaignsData: {
    id: string;
    name: string;
    sentAt: Date | null;
    recipientCount: number;
  }[];
}

export function formatTimeline({ recentActivity, pledges, surveyResponses, emailCampaignsData }: TimelineInput) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);

  const timelineEntries: TimelineEntry[] = [];

  // Add FulfillmentActivity records if any exist
  recentActivity.forEach((activity) => {
    timelineEntries.push({
      id: activity.id,
      type: activityTypeMap[activity.type] || "comment",
      time: formatTime(activity.createdAt),
      title: activity.title,
      detail: activity.description || "",
      date: formatDateLabel(activity.createdAt, today, yesterday),
      sortDate: activity.createdAt,
    });
  });

  // Add recent pledge activity (new backers)
  const recentPledges = pledges
    .filter(p => p.status === "COMPLETED")
    .slice(0, 30); // Last 30 pledges

  recentPledges.forEach(pledge => {
    const pledgeAmount = Number(pledge.amount);
    timelineEntries.push({
      id: `pledge-${pledge.id}`,
      type: "cards_charged",
      time: formatTime(pledge.createdAt),
      title: "New Backer",
      detail: `${pledge.user.name || "Anonymous"} backed ${pledge.reward?.title || "the project"} for $${pledgeAmount.toFixed(2)}`,
      date: formatDateLabel(pledge.createdAt, today, yesterday),
      sortDate: pledge.createdAt,
    });
  });

  // Add survey completion activity
  surveyResponses
    .filter(sr => sr.isComplete && sr.completedAt)
    .slice(0, 20)
    .forEach(sr => {
      const pledge = pledges.find(p => p.id === sr.pledgeId);
      const completedAt = sr.completedAt as Date;
      timelineEntries.push({
        id: `survey-${sr.id}`,
        type: "survey_completed",
        time: formatTime(completedAt),
        title: "Survey Completed",
        detail: `${pledge?.user?.name || "A backer"} completed their survey`,
        date: formatDateLabel(completedAt, today, yesterday),
        sortDate: completedAt,
      });
    });

  // Add email campaign activity
  emailCampaignsData
    .filter((c) => c.sentAt)
    .slice(0, 10)
    .forEach((campaign) => {
      timelineEntries.push({
        id: `email-${campaign.id}`,
        type: "survey_reminder",
        time: formatTime(campaign.sentAt!),
        title: "Email Campaign Sent",
        detail: `"${campaign.name}" sent to ${campaign.recipientCount} backers`,
        date: formatDateLabel(campaign.sentAt!, today, yesterday),
        sortDate: campaign.sentAt!,
      });
    });

  // Sort all timeline entries by date (newest first) and deduplicate
  const sortedTimeline = timelineEntries
    .sort((a, b) => b.sortDate.getTime() - a.sortDate.getTime())
    .slice(0, 50); // Limit to 50 entries

  // Remove sortDate from output (it was only used for sorting)
  return sortedTimeline.map((item) => ({
    id: item.id,
    type: item.type,
    time: item.time,
    title: item.title,
    detail: item.detail,
    date: item.date,
  }));
}
