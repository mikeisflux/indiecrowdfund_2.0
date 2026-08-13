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
  reorderItems: (items: RewardItemData[]) => void;

  // Reward management
  addReward: (reward: RewardData) => void;
  updateReward: (index: number, reward: RewardData) => void;
  removeReward: (index: number) => void;
  copyRewardToAddon: (index: number) => void;
  reorderRewards: (rewards: RewardData[]) => void;

  // Reset
  reset: () => void;

  // Project ID for editing existing projects
  projectId: string | null;
  setProjectId: (id: string | null) => void;

  // Project slug for URL generation
  projectSlug: string | null;
  setProjectSlug: (slug: string | null) => void;

  // Project status for live campaigns
  projectStatus: string | null;
  setProjectStatus: (status: string | null) => void;

  // End a reward (for live campaigns with backers)
  endReward: (index: number) => void;
}

// Largest story description we keep in localStorage. Raised from 50 KB, which
// an image-heavy campaign story clears easily. localStorage allows roughly
// 5 MB per origin; 2 MB leaves ample headroom for the rest of the builder
// state persisted alongside it.
const STORY_PERSIST_LIMIT = 2_000_000;

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
    previewImages: [],
  },
  people: {
    showNameOnly: false,
    creatorWebsites: [],
    collaborators: [],
  },
  payment: {
    projectType: "INDIVIDUAL" as const,
    paymentProcessor: "DIVINITYCOIN" as const,
    campaignType: "ALL_OR_NOTHING" as const,
    hasAdultContent: false,
    hasRiskyContent: false,
    promoContentSfw: true,
    allowRetailerPledges: false,
    retailerDiscount: 50,
    retailerMinQuantity: 5,
  },
  promotion: {
    prelaunchActive: false,
    customReferralTags: [],
  },
  projectId: null,
  projectSlug: null,
  projectStatus: null,
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

      reorderItems: (items) => set({ items }),

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

      reorderRewards: (rewards) => set({ rewards }),

      reset: () => set(initialState),

      setProjectId: (id) => set({ projectId: id }),

      setProjectSlug: (slug) => set({ projectSlug: slug }),

      setProjectStatus: (status) => set({ projectStatus: status }),

      endReward: (index) =>
        set((state) => ({
          rewards: state.rewards.map((r, i) =>
            i === index ? { ...r, isEnded: true, endedAt: new Date() } : r
          ),
        })),
    }),
    {
      name: "project-builder-storage",
      // Custom storage that handles quota errors gracefully
      storage: {
        getItem: (name) => {
          try {
            const str = localStorage.getItem(name);
            return str ? JSON.parse(str) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch (e) {
            // Handle quota exceeded error - clear old data and try again
            if (e instanceof Error && e.name === "QuotaExceededError") {
              console.warn("localStorage quota exceeded, clearing project storage");
              try {
                localStorage.removeItem(name);
                localStorage.setItem(name, JSON.stringify(value));
              } catch {
                // If still fails, just continue without persistence
                console.error("Failed to save to localStorage even after clearing");
              }
            }
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {
            // Ignore errors
          }
        },
      },
      // Don't persist large data that can exceed localStorage quota (~5MB limit)
      // Strip base64 images but keep URL-based images and all other data
      partialize: (state) => {
        // Helper to strip base64 images
        const stripBase64 = (url?: string | null) =>
          url?.startsWith('data:') ? undefined : url;

        return {
          currentStep: state.currentStep,
          // For basics, exclude imageUrl if it's a base64 string (very large)
          basics: {
            ...state.basics,
            imageUrl: stripBase64(state.basics.imageUrl),
          },
          // Persist items but strip base64 images
          items: state.items.map(item => ({
            ...item,
            imageUrl: stripBase64(item.imageUrl),
          })),
          // Persist rewards but strip base64 images
          rewards: state.rewards.map(reward => ({
            ...reward,
            imageUrl: stripBase64(reward.imageUrl),
            items: reward.items.map(item => ({
              ...item,
              imageUrl: stripBase64(item.imageUrl),
            })),
          })),
          // Story descriptions are HTML with embedded images and routinely run
          // past the old 50 KB ceiling, which silently dropped them from the
          // persisted state. 2 MB fits comfortably inside the ~5 MB
          // localStorage budget alongside everything else here, so real
          // stories now survive a reload.
          //
          // The description is still omitted above that, because a quota
          // overflow makes the whole persist call throw and costs the entire
          // builder state. Losing it from localStorage is no longer dangerous
          // on its own: the save path omits an absent description from the
          // request rather than posting "" over the stored copy.
          story: {
            ...state.story,
            description:
              state.story.description && state.story.description.length > STORY_PERSIST_LIMIT
                ? undefined
                : state.story.description,
          },
          people: {
            ...state.people,
            // Don't persist creator image if it's base64
            creatorImageUrl: stripBase64(state.people.creatorImageUrl),
          },
          payment: state.payment,
          promotion: state.promotion,
          projectId: state.projectId,
          projectSlug: state.projectSlug,
          projectStatus: state.projectStatus,
        } as ProjectBuilderState;
      },
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
