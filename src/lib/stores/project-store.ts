import { create } from "zustand";
import { persist } from "zustand/middleware";
import {
  ProjectBasicsData,
  RewardData,
  RewardItemData,
  ProjectStoryData,
  ProjectPeopleData,
  ProjectPaymentData,
  ProjectPromotionData,
} from "@/types";

interface ProjectBuilderState {
  // Current step (0-5)
  currentStep: number;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Form data
  basics: Partial<ProjectBasicsData>;
  items: RewardItemData[];
  rewards: RewardData[];
  story: Partial<ProjectStoryData>;
  people: Partial<ProjectPeopleData>;
  payment: Partial<ProjectPaymentData>;
  promotion: Partial<ProjectPromotionData>;

  // Update functions
  updateBasics: (data: Partial<ProjectBasicsData>) => void;
  updateStory: (data: Partial<ProjectStoryData>) => void;
  updatePeople: (data: Partial<ProjectPeopleData>) => void;
  updatePayment: (data: Partial<ProjectPaymentData>) => void;
  updatePromotion: (data: Partial<ProjectPromotionData>) => void;

  // Item management
  addItem: (item: RewardItemData) => void;
  updateItem: (id: string, item: RewardItemData) => void;
  removeItem: (id: string) => void;

  // Reward management
  addReward: (reward: RewardData) => void;
  updateReward: (index: number, reward: RewardData) => void;
  removeReward: (index: number) => void;
  copyRewardToAddon: (index: number) => void;

  // Reset
  reset: () => void;

  // Project ID for editing existing projects
  projectId: string | null;
  setProjectId: (id: string | null) => void;
}

const initialState = {
  currentStep: 0,
  basics: {
    durationType: "FIXED_DAYS" as const,
    durationDays: 30,
    goalAmount: 10000,
  },
  items: [] as RewardItemData[],
  rewards: [],
  story: {
    usesAI: false,
    faqs: [],
  },
  people: {
    showNameOnly: false,
    creatorWebsites: [],
    collaborators: [],
  },
  payment: {
    projectType: "INDIVIDUAL" as const,
    paymentProcessor: "STRIPE" as const,
    hasAdultContent: false,
    hasRiskyContent: false,
    allowRetailerPledges: false,
    retailerDiscount: 50,
    retailerMinQuantity: 5,
  },
  promotion: {
    prelaunchActive: false,
    customReferralTags: [],
  },
  projectId: null,
};

export const useProjectStore = create<ProjectBuilderState>()(
  persist(
    (set) => ({
      ...initialState,

      setCurrentStep: (step) => set({ currentStep: step }),
      nextStep: () => set((state) => ({ currentStep: Math.min(state.currentStep + 1, 5) })),
      prevStep: () => set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),

      updateBasics: (data) =>
        set((state) => ({ basics: { ...state.basics, ...data } })),

      updateStory: (data) =>
        set((state) => ({ story: { ...state.story, ...data } })),

      updatePeople: (data) =>
        set((state) => ({ people: { ...state.people, ...data } })),

      updatePayment: (data) =>
        set((state) => ({ payment: { ...state.payment, ...data } })),

      updatePromotion: (data) =>
        set((state) => ({ promotion: { ...state.promotion, ...data } })),

      addItem: (item) =>
        set((state) => ({
          items: [...state.items, { ...item, id: item.id || crypto.randomUUID() }],
        })),

      updateItem: (id, item) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...item, id } : i)),
        })),

      removeItem: (id) =>
        set((state) => ({
          items: state.items.filter((i) => i.id !== id),
          // Also remove from any rewards that include this item
          rewards: state.rewards.map((r) => ({
            ...r,
            items: r.items.filter((i) => i.id !== id),
          })),
        })),

      addReward: (reward) =>
        set((state) => ({ rewards: [...state.rewards, reward] })),

      updateReward: (index, reward) =>
        set((state) => ({
          rewards: state.rewards.map((r, i) => (i === index ? reward : r)),
        })),

      removeReward: (index) =>
        set((state) => ({
          rewards: state.rewards.filter((_, i) => i !== index),
        })),

      copyRewardToAddon: (index) =>
        set((state) => {
          const reward = state.rewards[index];
          if (!reward) return state;

          const addon: RewardData = {
            ...reward,
            id: undefined,
            type: "ADDON",
            title: `${reward.title} (Add-on)`,
          };

          return { rewards: [...state.rewards, addon] };
        }),

      reset: () => set(initialState),

      setProjectId: (id) => set({ projectId: id }),
    }),
    {
      name: "project-builder-storage",
    }
  )
);

// Steps configuration
export const BUILDER_STEPS = [
  { id: "basics", title: "Basics", description: "Project title, category, and funding goal" },
  { id: "rewards", title: "Rewards", description: "Reward tiers and add-ons" },
  { id: "story", title: "Story", description: "Project description and details" },
  { id: "people", title: "People", description: "Creator profile and collaborators" },
  { id: "payment", title: "Payment", description: "Payment processor setup" },
  { id: "promotion", title: "Promotion", description: "Pre-launch page and analytics" },
] as const;
