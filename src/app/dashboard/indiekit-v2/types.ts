// Re-export all types from v1 - no need to duplicate
export type {
  Project,
  CountBreakdown,
  FulfillmentStats,
  WorkflowStep,
  Backer,
  SurveyAddon,
  DistributionRule,
  PackageGroup,
  ShippingService,
  DigitalFile,
  EmailCampaign,
} from "../indiekit/types";

export { STATUS_COLORS, STATUS_LABELS } from "../indiekit/types";

// Additional types for v2
export type FulfillmentPhase = "pre-fulfillment" | "fulfillment" | "post-fulfillment";

export type AlwaysAvailableTab =
  | "dashboard"
  | "backers"
  | "support"
  | "email-marketing"
  | "updates"
  | "settings"
  | "account"
  | "projects";

export type PreFulfillmentTab = "setup" | "surveys" | "finalize" | "teaser-pages";
export type FulfillmentTab = "payments" | "digital-delivery" | "physical-delivery";
export type PostFulfillmentTab = "reports" | "late-backers";

export type PhaseTab = PreFulfillmentTab | FulfillmentTab | PostFulfillmentTab;

export interface PhaseInfo {
  id: FulfillmentPhase;
  label: string;
  description: string;
  tabs: { id: PhaseTab; label: string; icon: string }[];
}
