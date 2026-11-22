export interface AvailableAddon {
  id: string;
  title: string;
  description?: string;
  price: number;
  imageUrl?: string;
  quantityAvailable: number | null;
  alreadyPurchased: boolean;
}

export interface SavedAddress {
  id: string;
  label: string;
  isDefault: boolean;
  fullName: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone?: string | null;
}

export interface SurveyData {
  /** Backer may still edit the shipping address on a submitted survey. */
  allowAddressChanges?: boolean;
  /**
   * The creator has locked orders/addresses but this backer hasn't
   * submitted yet. The form stays open; the submission locks itself.
   */
  lateSubmission?: boolean;
  survey: {
    id: string;
    introTitle?: string;
    introMessage?: string;
    collectAddresses: boolean;
    status: string;
    addressesLocked: boolean;
    requiresShipping: boolean;
  };
  pledge: {
    id: string;
    projectId: string;
    projectTitle: string;
    projectImage?: string;
    projectSlug?: string;
    paymentProcessor: string;
    rewardTitle: string;
    addons: { id: string; title: string; quantity?: number }[];
  };
  itemQuestions: {
    id: string;
    rewardId: string;
    itemName: string;
    itemDescription?: string;
    imageUrl?: string | null;
    /** How many of this item the backer holds; questions are asked once per unit. */
    quantity?: number;
    variants: {
      id: string;
      variantType: string;
      options: string[];
    }[];
    customQuestions: {
      id: string;
      question: string;
      description?: string;
      questionType: string;
      options: string[];
      isRequired: boolean;
    }[];
  }[];
  backerQuestions: {
    id: string;
    question: string;
    description?: string;
    questionType: string;
    displayType?: string | null;
    options: string[];
    isRequired: boolean;
  }[];
  /**
   * Upgrade add-ons in this pledge ("Upgrade to foil" x2): one pick per
   * copy, from the backer's own items. `auto` = only one way to apply it,
   * shown as a confirmation. See @/lib/fulfillment/modifiers.
   */
  modifierQuestions?: ModifierQuestionView[];
  availableAddons?: AvailableAddon[];
  response: {
    itemResponses?: Record<string, { variants?: Record<string, string>; customAnswers?: Record<string, string | string[]> }>;
    backerResponses?: Record<string, string | string[]>;
    shippingAddress?: {
      name?: string;
      line1?: string;
      line2?: string;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      phone?: string;
    };
    isComplete: boolean;
    addressLocked: boolean;
    selectedAddons?: Record<string, number>;
  };
}

export interface ModifierQuestionView {
  modifierAddonId: string;
  title: string;
  imageUrl: string | null;
  quantity: number;
  targets: { key: string; rewardId: string; projectItemId: string | null; title: string; imageUrl: string | null; quantity: number; kind: "tier" | "addon" }[];
  selections: (string | null)[];
  auto: boolean;
}

/** modifierAddonId -> target key per copy (index = unit). */
export type ModifierSelections = Record<string, (string | null)[]>;

export type Step = "intro" | "items" | "upgrades" | "questions" | "addons" | "address" | "review" | "payment";

export type ShippingAddressForm = {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
};
