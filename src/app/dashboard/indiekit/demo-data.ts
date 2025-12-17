import type {
  Project,
  FulfillmentStats,
  Backer,
  PackageGroup,
  DigitalFile,
  DistributionRule,
  SurveyAddon,
  EmailCampaign,
  WorkflowStep,
} from "./types";
import { WORKFLOW_STEPS } from "./constants";

export interface DemoData {
  projects: Project[];
  selectedProjectId: string;
  stats: FulfillmentStats;
  backers: Backer[];
  packageGroups: PackageGroup[];
  digitalFiles: DigitalFile[];
  distributionRules: DistributionRule[];
  surveyAddons: SurveyAddon[];
  emailCampaigns: EmailCampaign[];
  workflowSteps: WorkflowStep[];
}

export function getDemoData(): DemoData {
  return {
    projects: [
      { id: "1", title: "My Awesome Project", slug: "my-awesome-project", status: "FUNDED" },
    ],
    selectedProjectId: "1",
    stats: {
      totalBackers: 684,
      fulfilledBackers: 669,
      surveysCompleted: 650,
      surveysPending: 34,
      totalRaised: 125000,
      addOnPurchases: 8500,
      digitalDownloads: 595,
      packagesShipped: 420,
      chargeStats: {
        notCharged: 15,
        errored: 12,
        charged: 614,
        paypalCollected: 43,
      },
      preOrderBackers: 43,
      preOrderRevenue: 5720,
      returningBackers: 126,
      newBackers: 558,
    },
    backers: [
      {
        id: "b1",
        name: "John Doe",
        email: "john@example.com",
        pledgeAmount: 150,
        reward: "Early Bird Special",
        rewardAmount: 100,
        status: "shipped",
        chargeStatus: "charged",
        surveyCompleted: true,
        addressComplete: true,
        shippingAddress: { name: "John Doe", line1: "123 Main St", city: "New York", state: "NY", country: "US", postalCode: "10001", phone: "555-1234" },
        balance: { pledgeAmount: 150, pledgeLevelAmount: 100, addonsAmount: 40, shippingAmount: 10, totalCharged: 150, balanceDue: 0 },
        items: [{ name: "Main Product", quantity: 1, sku: "MAIN-001" }, { name: "Add-on A", quantity: 2, sku: "ADDON-A" }],
        addons: [{ id: "a1", name: "Extra Sticker Pack", quantity: 2, amount: 20 }, { id: "a2", name: "Art Print", quantity: 1, amount: 20 }],
        digitalDownloads: [{ name: "Digital Art Book", downloaded: true, distributedAt: "2024-01-16" }],
        activity: [{ date: "2024-01-20", action: "Order shipped", details: "Tracking: 1Z999AA10123456784" }, { date: "2024-01-16", action: "Survey completed" }, { date: "2024-01-10", action: "Pledge received" }],
      },
      {
        id: "b2",
        name: "Jane Smith",
        email: "jane@example.com",
        pledgeAmount: 250,
        reward: "Premium Bundle",
        rewardAmount: 200,
        status: "pushed",
        chargeStatus: "charged",
        surveyCompleted: true,
        addressComplete: true,
        shippingAddress: { name: "Jane Smith", line1: "456 Oak Ave", city: "Los Angeles", state: "CA", country: "US", postalCode: "90001" },
        balance: { pledgeAmount: 250, pledgeLevelAmount: 200, addonsAmount: 35, shippingAmount: 15, totalCharged: 250, balanceDue: 0 },
        items: [{ name: "Main Product", quantity: 1 }, { name: "Premium Add-on", quantity: 1 }],
        addons: [{ id: "a3", name: "Soundtrack Album", quantity: 1, amount: 35 }],
        digitalDownloads: [{ name: "Digital Art Book", downloaded: false }, { name: "Soundtrack", downloaded: false }],
        activity: [{ date: "2024-01-18", action: "Pushed to ShipStation" }, { date: "2024-01-15", action: "Survey completed" }],
      },
      {
        id: "b3",
        name: "Bob Wilson",
        email: "bob@example.com",
        pledgeAmount: 75,
        reward: "Basic Tier",
        rewardAmount: 50,
        status: "not_pushed",
        chargeStatus: "not_charged",
        surveyCompleted: false,
        addressComplete: false,
        balance: { pledgeAmount: 75, pledgeLevelAmount: 50, addonsAmount: 15, shippingAmount: 10, totalCharged: 50, balanceDue: 25 },
        items: [{ name: "Main Product", quantity: 1 }],
        addons: [{ id: "a1", name: "Extra Sticker Pack", quantity: 1, amount: 15 }],
        digitalDownloads: [],
        activity: [{ date: "2024-01-10", action: "Pledge received" }],
      },
      {
        id: "b4",
        name: "Alice Brown",
        email: "alice@example.com",
        pledgeAmount: 500,
        reward: "Collector's Edition",
        rewardAmount: 400,
        status: "push_errored",
        chargeStatus: "errored",
        surveyCompleted: true,
        addressComplete: true,
        shippingAddress: { name: "Alice Brown", line1: "789 Pine Rd", city: "Chicago", state: "IL", country: "US", postalCode: "60601" },
        balance: { pledgeAmount: 500, pledgeLevelAmount: 400, addonsAmount: 75, shippingAmount: 25, totalCharged: 400, balanceDue: 100 },
        items: [{ name: "Collector's Set", quantity: 1 }, { name: "Exclusive Item", quantity: 1 }],
        addons: [{ id: "a4", name: "Signed Art Print", quantity: 1, amount: 75 }],
        digitalDownloads: [{ name: "Digital Art Book", downloaded: true }, { name: "Soundtrack", downloaded: true }],
        activity: [{ date: "2024-01-19", action: "Push failed", details: "Invalid address format" }, { date: "2024-01-17", action: "Card charge failed" }],
      },
    ],
    packageGroups: [
      {
        id: "pg1",
        name: "Package Group #643455",
        type: "domestic",
        itemCount: 2,
        backerCount: 320,
        status: "shipped",
        statusCounts: { notPushed: 0, pushErrored: 0, pushed: 0, shipped: 320 },
        lastSentAt: "2024-01-18",
        items: [
          { name: "Main Product", quantity: 1, weight: { lbs: 1, oz: 8.0 }, customsValid: true, sku: "MAIN-001" },
          { name: "Sticker Pack", quantity: 1, weight: { lbs: 0, oz: 2.0 }, customsValid: true, sku: "STICKER-001" },
        ],
        totalWeight: { lbs: 1, oz: 10.0 },
      },
      {
        id: "pg2",
        name: "Package Group #643475",
        type: "domestic",
        itemCount: 4,
        backerCount: 150,
        status: "processing",
        statusCounts: { notPushed: 10, pushErrored: 5, pushed: 85, shipped: 50 },
        lastSentAt: "2024-01-19",
        items: [
          { name: "Main Product", quantity: 1, weight: { lbs: 1, oz: 8.0 }, customsValid: true },
          { name: "Premium Add-on", quantity: 1, weight: { lbs: 0, oz: 12.0 }, customsValid: true },
          { name: "Art Book", quantity: 1, weight: { lbs: 2, oz: 0.0 }, customsValid: true },
          { name: "Sticker Pack", quantity: 1, weight: { lbs: 0, oz: 2.0 }, customsValid: true },
        ],
        totalWeight: { lbs: 4, oz: 6.0 },
      },
      {
        id: "pg3",
        name: "Package Group #643486",
        type: "international",
        itemCount: 3,
        backerCount: 214,
        status: "pending",
        statusCounts: { notPushed: 200, pushErrored: 12, pushed: 2, shipped: 0 },
        items: [
          { name: "Digital Art Book", quantity: 1, weight: { lbs: 0, oz: 0.0 }, customsValid: false },
          { name: "Justified E-Book", quantity: 1, weight: { lbs: 0, oz: 0.0 }, customsValid: false },
          { name: "Soundtrack Digital", quantity: 1, weight: { lbs: 0, oz: 0.0 }, customsValid: false },
        ],
        totalWeight: { lbs: 0, oz: 0.0 },
      },
    ],
    digitalFiles: [
      { id: "df1", name: "Digital Art Book.pdf", size: "45 MB", type: "PDF", uploadedAt: "2024-01-15", distributedTo: 595, totalEligible: 684 },
      { id: "df2", name: "Soundtrack.zip", size: "120 MB", type: "ZIP", uploadedAt: "2024-01-20", distributedTo: 320, totalEligible: 450 },
    ],
    distributionRules: [
      { id: "dr1", name: "FS Vol 1", condition: "If [Flying Sparks Volume 1 Digital] is in the order", triggerProduct: "Flying Sparks Volume 1 Digital", distributeFile: "Flying Sparks Vol 1.pdf", requiresPayment: false, status: "started", distributedCount: 625, totalEligible: 684, startedAt: "10/13/24" },
      { id: "dr2", name: "FS Vol 2", condition: "If [Flying Sparks Volume 2 Digital] is in the order", triggerProduct: "Flying Sparks Volume 2 Digital", distributeFile: "Flying Sparks Vol 2.pdf", requiresPayment: false, status: "started", distributedCount: 3, totalEligible: 450, startedAt: "09/27/24" },
      { id: "dr3", name: "Soundtrack", condition: "If [Digital Soundtrack] is in the order", triggerProduct: "Digital Soundtrack", distributeFile: "Soundtrack.zip", requiresPayment: true, status: "not_started", distributedCount: 0, totalEligible: 320 },
    ],
    surveyAddons: [
      { id: "sa1", name: "Extra Sticker Pack", description: "Additional set of 10 vinyl stickers", price: 15, available: true, purchasedCount: 234 },
      { id: "sa2", name: "Art Print", description: "12x18 signed art print", price: 25, available: true, quantityLimit: 100, purchasedCount: 87 },
      { id: "sa3", name: "Soundtrack Album", description: "Digital soundtrack download", price: 10, available: true, purchasedCount: 156 },
      { id: "sa4", name: "Signed Art Print", description: "Limited edition signed by creator", price: 75, available: false, quantityLimit: 50, purchasedCount: 50 },
    ],
    emailCampaigns: [
      { id: "ec1", title: "Survey Reminder", status: "sent", sentAt: "2024-01-10", recipients: 684, openRate: 72 },
      { id: "ec2", title: "Shipping Update", status: "scheduled", scheduledFor: "2024-02-01", recipients: 684 },
      { id: "ec3", title: "Thank You Note", status: "draft", recipients: 0 },
    ],
    workflowSteps: [
      { ...WORKFLOW_STEPS[0], status: "completed" },
      { ...WORKFLOW_STEPS[1], status: "completed" },
      { ...WORKFLOW_STEPS[2], status: "completed" },
      { ...WORKFLOW_STEPS[3], status: "completed" },
      { ...WORKFLOW_STEPS[4], status: "in_progress" },
      { ...WORKFLOW_STEPS[5], status: "pending" },
    ],
  };
}
