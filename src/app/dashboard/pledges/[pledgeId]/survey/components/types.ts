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
    addons: { id: string; title: string }[];
  };
  itemQuestions: {
    id: string;
    rewardId: string;
    itemName: string;
    itemDescription?: string;
    imageUrl?: string;
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

export type Step = "intro" | "items" | "questions" | "addons" | "address" | "review" | "payment";

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
