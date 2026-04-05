export type CampaignType = {
  id: string;
  name: string;
  status: string;
  sentAt: Date | null;
  scheduledFor: Date | null;
  recipientCount: number;
  sentCount: number;
  openCount: number;
  clickCount: number;
};

export function formatEmailCampaigns(emailCampaignsData: CampaignType[]) {
  return emailCampaignsData.map((campaign) => ({
    id: campaign.id,
    title: campaign.name,
    status: campaign.status.toLowerCase(),
    sentAt: campaign.sentAt?.toLocaleDateString(),
    scheduledFor: campaign.scheduledFor?.toLocaleDateString(),
    recipients: campaign.recipientCount,
    sentCount: campaign.sentCount,
    openCount: campaign.openCount,
    clickCount: campaign.clickCount,
    openRate: campaign.sentCount > 0 ? Math.round((campaign.openCount / campaign.sentCount) * 100) : undefined,
    clickRate: campaign.sentCount > 0 ? Math.round((campaign.clickCount / campaign.sentCount) * 100) : undefined,
  }));
}
