"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { useSession } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  CheckCircle,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Info,
} from "lucide-react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Types for project and reward data
interface ProjectData {
  id: string;
  title: string;
  slug: string;
  imageUrl: string;
  paymentProcessor: "STRIPE";
  hasAdultContent: boolean;
  estimatedDelivery: string;
  creator: { id: string; name: string; location: string; image: string };
}

interface RewardData {
  id: string;
  title: string;
  description: string;
  amount: number;
  shippingCost: Record<string, number> | number;
  shippingType: "NO_SHIPPING" | "WORLDWIDE" | "SELECTED_COUNTRIES";
  shippingCountries: string[];
  estimatedDelivery: string;
  quantityClaimed: number;
  imageUrl: string;
  items: { title: string; quantity: number }[];
}

interface AddonData {
  id: string;
  title: string;
  description: string;
  amount: number;
  shippingCost: Record<string, number> | number;
  shippingType: "NO_SHIPPING" | "WORLDWIDE" | "SELECTED_COUNTRIES";
  shippingCountries: string[];
  imageUrl: string | null;
  estimatedDelivery: string;
  limitedQuantity: number | null;
  quantityClaimed: number;
  includes: string[];
}

const COUNTRIES = [
  { code: "US", name: "United States", currency: "USD" },
  { code: "CA", name: "Canada", currency: "CAD" },
  { code: "GB", name: "United Kingdom", currency: "GBP" },
  { code: "AU", name: "Australia", currency: "AUD" },
  { code: "DE", name: "Germany", currency: "EUR" },
  { code: "FR", name: "France", currency: "EUR" },
  { code: "JP", name: "Japan", currency: "JPY" },
];

const FAQ_ITEMS = [
  {
    question: "How do I pledge?",
    answer: "Select your reward tier, add any optional add-ons, enter your shipping information, and complete your payment. You'll receive a confirmation email once your pledge is processed.",
  },
  {
    question: "When is my card charged?",
    answer: "Your card is only charged when the campaign reaches its funding goal. If you pledge before the goal is met, your payment is held and will only be processed once the campaign successfully funds. If the campaign doesn't reach its goal, you won't be charged at all.",
  },
  {
    question: "So I'm only charged if funding succeeds?",
    answer: "Exactly! Your payment is held until the campaign reaches its funding goal. If the project doesn't reach its goal by the deadline, your payment method is never charged.",
  },
  {
    question: "What can others see about my pledge?",
    answer: "Creators can see your name, email, and pledge amount. Other backers can only see your public profile name. Your payment details are never shared with creators.",
  },
  {
    question: "What if I want to change my pledge?",
    answer: "You can modify or cancel your pledge at any time before the campaign ends. After the campaign successfully funds, you may be able to update your reward selection or shipping address through the pledge manager.",
  },
  {
    question: "If this project is funded, how do I get my reward?",
    answer: "After successful funding, the creator will begin production. Estimated delivery dates are shown for each reward. You'll receive updates from the creator and they'll reach out when it's time to confirm your shipping details.",
  },
  {
    question: "Will I be charged more later?",
    answer: "You may be charged shipping costs later if they weren't included in your pledge amount. The creator will notify you of any additional charges through the pledge manager before shipping.",
  },
];

type Step = "rewards" | "addons" | "payment" | "success";

// Stripe Payment Form Component
function StripePaymentForm({
  onSuccess,
  onError,
  agreedToTerms,
  isProcessing,
  setIsProcessing,
  total,
  intentType,
}: {
  onSuccess: () => void;
  onError: (message: string) => void;
  agreedToTerms: boolean;
  isProcessing: boolean;
  setIsProcessing: (val: boolean) => void;
  total: number;
  intentType: "payment_intent" | "setup_intent";
}) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async () => {
    if (!stripe || !elements || !agreedToTerms) return;

    setIsProcessing(true);

    try {
      const return_url = `${window.location.origin}/projects/${window.location.pathname.split("/")[2]}/pledge?success=true`;

      // Use the correct confirmation method based on intent type
      // SetupIntent is used for campaigns that haven't reached their goal yet (card is saved but not charged)
      // PaymentIntent is used when the campaign is already funded (card is charged immediately)
      let error;

      if (intentType === "setup_intent") {
        const result = await stripe.confirmSetup({
          elements,
          confirmParams: {
            return_url,
          },
          redirect: "if_required",
        });
        error = result.error;
      } else {
        const result = await stripe.confirmPayment({
          elements,
          confirmParams: {
            return_url,
          },
          redirect: "if_required",
        });
        error = result.error;
      }

      if (error) {
        onError(error.message || "Payment failed");
        setIsProcessing(false);
      } else {
        onSuccess();
      }
    } catch {
      onError("An unexpected error occurred");
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      <PaymentElement />
      <Button
        className="w-full bg-zinc-300 hover:bg-[#028858] text-zinc-600 hover:text-white font-medium disabled:bg-zinc-300 disabled:text-zinc-500"
        size="lg"
        onClick={handleSubmit}
        disabled={!stripe || !elements || !agreedToTerms || isProcessing}
      >
        {isProcessing ? "Processing..." : `Pledge $${total}`}
      </Button>
    </div>
  );
}

export default function PledgePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status: authStatus } = useSession();
  const slug = params.slug as string;
  const rewardId = searchParams.get("reward");
  const amountParam = searchParams.get("amount");
  const successParam = searchParams.get("success");

  // Redirect to login if not authenticated
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      // Store the intended destination
      const returnUrl = encodeURIComponent(`/projects/${slug}/pledge${rewardId ? `?reward=${rewardId}` : ""}`);
      router.push(`/login?redirect=${returnUrl}`);
    }
  }, [authStatus, router, slug, rewardId]);

  // Data state - loaded from API
  const [project, setProject] = useState<ProjectData | null>(null);
  const [allRewards, setAllRewards] = useState<RewardData[]>([]);
  const [selectedReward, setSelectedReward] = useState<RewardData | null>(null);
  const [addons, setAddons] = useState<AddonData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pledgeWithoutReward, setPledgeWithoutReward] = useState(false);
  const [customPledgeAmount, setCustomPledgeAmount] = useState(amountParam ? parseInt(amountParam) : 10);

  // UI state
  const [step, setStep] = useState<Step>(rewardId ? "addons" : "rewards");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [bonusSupport, setBonusSupport] = useState<number>(0);
  const [shippingCountry, setShippingCountry] = useState("US");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Stripe state
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<"payment_intent" | "setup_intent">("setup_intent");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [currentPledgeId, setCurrentPledgeId] = useState<string | null>(null);

  // Handle success redirect
  useEffect(() => {
    if (successParam === "true") {
      setStep("success");
    }
  }, [successParam]);

  // Initialize Stripe
  useEffect(() => {
    async function initStripe() {
      try {
        const res = await fetch("/api/stripe/config");
        const data = await res.json();
        if (data.publishableKey) {
          setStripePromise(loadStripe(data.publishableKey));
        }
      } catch (err) {
        console.error("Failed to load Stripe config:", err);
      }
    }
    initStripe();
  }, []);

  // Auto-create pledge when entering payment step to load Stripe form
  useEffect(() => {
    if (step === "payment" && !clientSecret && !isProcessing && !paymentError && project && (selectedReward || pledgeWithoutReward)) {
      createPledgeForPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, project, selectedReward, pledgeWithoutReward, clientSecret, isProcessing, paymentError]);

  // Create pledge and get Stripe client secret (called automatically when entering payment step)
  const createPledgeForPayment = async () => {
    if (!project || (!selectedReward && !pledgeWithoutReward)) return;
    if (clientSecret) return; // Already have a client secret

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const addonIds = Object.keys(selectedAddons);

      const response = await fetch("/api/pledges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          rewardId: selectedReward?.id || null,
          addonIds,
          amount: total,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create pledge");
      }

      // Validate response has required fields
      if (!data.clientSecret) {
        throw new Error("Invalid payment response - missing client secret");
      }

      // Set the client secret and intent type to show Stripe Elements
      setClientSecret(data.clientSecret);
      setIntentType(data.type || "setup_intent");
      setCurrentPledgeId(data.pledgeId); // Store pledgeId for confirmation email
      setIsProcessing(false);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to create pledge");
      setIsProcessing(false);
    }
  };

  // Fetch project and reward data from API
  const fetchData = useCallback(async () => {
    if (!slug) return;

    setIsLoading(true);
    setError(null);

    try {
      const projectRes = await fetch(`/api/projects/slug/${slug}`);
      if (!projectRes.ok) {
        throw new Error("Project not found");
      }
      const responseData = await projectRes.json();
      const projectData = responseData.project;

      const formattedProject: ProjectData = {
        id: projectData.id,
        title: projectData.title,
        slug: projectData.slug,
        imageUrl: projectData.imageUrl || "",
        paymentProcessor: projectData.paymentProcessor || "STRIPE",
        hasAdultContent: projectData.hasAdultContent || false,
        estimatedDelivery: projectData.estimatedDelivery || "",
        creator: {
          id: projectData.creator?.id || "",
          name: projectData.creator?.name || "Creator",
          location: projectData.location || "",
          image: projectData.creator?.image || "",
        },
      };
      setProject(formattedProject);

      const rewards = responseData.rewards || [];
      const addonsFromApi = responseData.addons || [];

      // Get tier rewards
      const tierRewards = rewards.filter((r: { type?: string }) => r.type === "TIER" || !r.type);
      const formattedTiers: RewardData[] = tierRewards.map((reward: {
        id: string;
        title: string;
        description?: string;
        amount: number;
        shippingCost?: Record<string, number> | number;
        shippingType?: string;
        shippingCountries?: string[];
        imageUrl?: string;
        estimatedDelivery?: string;
        quantityClaimed?: number;
        items?: { title: string }[];
      }) => ({
        id: reward.id,
        title: reward.title,
        description: reward.description || "",
        amount: reward.amount,
        shippingCost: reward.shippingCost || {},
        shippingType: reward.shippingType || "NO_SHIPPING",
        shippingCountries: reward.shippingCountries || [],
        imageUrl: reward.imageUrl || "",
        estimatedDelivery: reward.estimatedDelivery
          ? new Date(reward.estimatedDelivery).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          : "",
        quantityClaimed: reward.quantityClaimed || 0,
        items: (reward.items || []).map((item: { title: string }) => ({
          title: item.title,
          quantity: 1,
        })),
      }));
      setAllRewards(formattedTiers);

      // Find the selected reward if rewardId is provided
      if (rewardId) {
        const reward = rewards.find((r: { id: string }) => r.id === rewardId);
        if (reward) {
          const formattedReward: RewardData = {
            id: reward.id,
            title: reward.title,
            description: reward.description || "",
            amount: reward.amount,
            shippingCost: reward.shippingCost || {},
            shippingType: reward.shippingType || "NO_SHIPPING",
            shippingCountries: reward.shippingCountries || [],
            imageUrl: reward.imageUrl || "",
            estimatedDelivery: reward.estimatedDelivery
              ? new Date(reward.estimatedDelivery).toLocaleDateString("en-US", { month: "long", year: "numeric" })
              : "",
            quantityClaimed: reward.quantityClaimed || 0,
            items: (reward.items || []).map((item: { title: string }) => ({
              title: item.title,
              quantity: 1,
            })),
          };
          setSelectedReward(formattedReward);
        }
      }

      // Get addons
      const formattedAddons: AddonData[] = addonsFromApi.map((addon: {
        id: string;
        title: string;
        description?: string;
        amount: number;
        shippingCost?: Record<string, number> | number;
        shippingType?: string;
        shippingCountries?: string[];
        imageUrl?: string;
        estimatedDelivery?: string;
        quantityAvailable?: number;
        quantityClaimed?: number;
        items?: { title: string }[];
      }) => ({
        id: addon.id,
        title: addon.title,
        description: addon.description || "",
        amount: addon.amount,
        shippingCost: addon.shippingCost || {},
        shippingType: (addon.shippingType as AddonData["shippingType"]) || "NO_SHIPPING",
        shippingCountries: addon.shippingCountries || [],
        imageUrl: addon.imageUrl || null,
        estimatedDelivery: addon.estimatedDelivery
          ? new Date(addon.estimatedDelivery).toLocaleDateString("en-US", { month: "long", year: "numeric" })
          : "",
        limitedQuantity: addon.quantityAvailable || null,
        quantityClaimed: addon.quantityClaimed || 0,
        includes: (addon.items || []).map((item: { title: string }) => item.title),
      }));
      setAddons(formattedAddons);
    } catch (err) {
      console.error("Failed to fetch pledge data:", err);
      setError(err instanceof Error ? err.message : "Failed to load project data");
    } finally {
      setIsLoading(false);
    }
  }, [slug, rewardId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper function to get shipping cost for a country
  const getShippingCost = (
    shippingCost: Record<string, number> | number,
    shippingType: string,
    country: string
  ): number => {
    if (shippingType === "NO_SHIPPING") return 0;
    if (typeof shippingCost === "number") return shippingCost;
    if (shippingType === "WORLDWIDE") {
      return shippingCost["WORLDWIDE"] || 0;
    }
    return shippingCost[country] || 0;
  };

  // Calculate totals
  const rewardAmount = pledgeWithoutReward ? customPledgeAmount : (selectedReward?.amount || 0);
  const rewardShipping = selectedReward
    ? getShippingCost(selectedReward.shippingCost, selectedReward.shippingType, shippingCountry)
    : 0;

  const addonsTotal = Object.entries(selectedAddons).reduce((sum, [id, qty]) => {
    const addon = addons.find((a) => a.id === id);
    return sum + (addon?.amount || 0) * qty;
  }, 0);

  const addonsShipping = Object.entries(selectedAddons).reduce((sum, [id, qty]) => {
    const addon = addons.find((a) => a.id === id);
    if (!addon) return sum;
    const addonShipping = getShippingCost(addon.shippingCost, addon.shippingType, shippingCountry);
    return sum + addonShipping * qty;
  }, 0);

  const subtotal = rewardAmount + addonsTotal + bonusSupport;
  const totalShipping = rewardShipping + addonsShipping;
  const total = subtotal + totalShipping;

  const handleAddonToggle = (addonId: string) => {
    setSelectedAddons((prev) => {
      if (prev[addonId]) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [addonId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [addonId]: 1 };
    });
  };

  const handleSelectReward = (reward: RewardData) => {
    setSelectedReward(reward);
    setPledgeWithoutReward(false);
    setStep("addons");
  };

  const handlePledgeWithoutReward = () => {
    setPledgeWithoutReward(true);
    setSelectedReward(null);
    setSelectedAddons({}); // Clear any previously selected addons
    setStep("payment"); // Skip addons step - go directly to payment
  };

  // Called when payment is successful
  const handlePaymentSuccess = async () => {
    // Send confirmation email directly (don't rely on webhooks)
    if (currentPledgeId) {
      try {
        await fetch(`/api/pledges/${currentPledgeId}/confirm`, {
          method: "POST",
        });
      } catch (err) {
        console.error("Failed to send confirmation email:", err);
        // Don't block success page - email can be retried later
      }
    }
    setStep("success");
    setIsProcessing(false);
  };

  // Called when payment fails
  const handlePaymentError = (message: string) => {
    setPaymentError(message);
  };

  const currentCountry = COUNTRIES.find((c) => c.code === shippingCountry);

  // Breadcrumb navigation
  const Breadcrumb = () => (
    <div className="flex items-center gap-2 text-sm">
      <button
        onClick={() => setStep("rewards")}
        className={step === "rewards" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}
      >
        Rewards
      </button>
      {/* Only show Add-ons step when there's a selected reward (not for pledge without reward) */}
      {selectedReward && (
        <>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <button
            onClick={() => setStep("addons")}
            className={step === "addons" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}
          >
            Add-ons
          </button>
        </>
      )}
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <button
        onClick={() => (selectedReward || pledgeWithoutReward) && setStep("payment")}
        className={step === "payment" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"}
        disabled={!selectedReward && !pledgeWithoutReward}
      >
        Payment
      </button>
    </div>
  );

  // Auth loading state - wait for auth check before showing content
  if (authStatus === "loading" || authStatus === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">
            {authStatus === "unauthenticated" ? "Redirecting to login..." : "Checking authentication..."}
          </p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading pledge details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container flex h-14 items-center">
            <Link href="/" className="text-xl font-bold text-primary">
              IndieCrowdfund
            </Link>
          </div>
        </header>
        <div className="container py-16">
          <div className="mx-auto max-w-lg text-center">
            <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="mb-2 text-2xl font-bold">Unable to load project</h2>
            <p className="mb-8 text-muted-foreground">
              {error || "The project you're looking for could not be found."}
            </p>
            <Link href="/discover">
              <Button>Discover Projects</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-background dark:from-green-950/20 dark:to-background overflow-hidden relative">
        {/* Confetti Animation */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          {[...Array(50)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${3 + Math.random() * 2}s`,
              }}
            >
              <div
                className="w-3 h-3 rotate-45"
                style={{
                  backgroundColor: ['#05ce78', '#ffc439', '#e85b46', '#1da1f2', '#9333ea', '#f97316'][Math.floor(Math.random() * 6)],
                  transform: `rotate(${Math.random() * 360}deg)`,
                }}
              />
            </div>
          ))}
        </div>

        {/* Firework bursts */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-20 left-1/4 animate-ping">
            <div className="w-4 h-4 rounded-full bg-yellow-400 opacity-75" />
          </div>
          <div className="absolute top-32 right-1/4 animate-ping" style={{ animationDelay: '0.5s' }}>
            <div className="w-3 h-3 rounded-full bg-green-400 opacity-75" />
          </div>
          <div className="absolute top-16 right-1/3 animate-ping" style={{ animationDelay: '1s' }}>
            <div className="w-5 h-5 rounded-full bg-purple-400 opacity-75" />
          </div>
        </div>

        <style jsx>{`
          @keyframes confetti {
            0% {
              transform: translateY(-100vh) rotate(0deg);
              opacity: 1;
            }
            100% {
              transform: translateY(100vh) rotate(720deg);
              opacity: 0;
            }
          }
          .animate-confetti {
            animation: confetti 5s linear infinite;
          }
        `}</style>

        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container flex h-14 items-center">
            <Link href="/" className="text-xl font-bold text-primary">
              IndieCrowdfund
            </Link>
          </div>
        </header>

        <div className="container py-16 relative z-10">
          <div className="mx-auto max-w-lg text-center">
            {/* Animated checkmark with glow */}
            <div className="mx-auto mb-8 flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br from-green-400 to-green-600 shadow-lg shadow-green-500/30 animate-bounce">
              <CheckCircle className="h-14 w-14 text-white" />
            </div>

            {/* Main message */}
            <h1 className="mb-3 text-4xl font-bold bg-gradient-to-r from-green-600 to-emerald-500 bg-clip-text text-transparent">
              Thank you for making this project come to life!
            </h1>

            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-green-100 dark:bg-green-900/50 px-4 py-2 text-green-700 dark:text-green-300">
              <CheckCircle className="h-5 w-5" />
              <span className="font-medium">Your payment has been accepted!</span>
            </div>

            <p className="mb-10 text-lg text-muted-foreground">
              Your support means the world to <span className="font-semibold text-foreground">{project?.creator?.name || 'the creator'}</span>.
              You&apos;ll receive a confirmation email shortly with all the details.
            </p>

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard/backer">
                <Button size="lg" className="w-full sm:w-auto bg-[#05ce78] hover:bg-[#04b56a] text-white font-semibold px-8">
                  Backer Dashboard
                </Button>
              </Link>
              <Link href="/discover">
                <Button size="lg" variant="outline" className="w-full sm:w-auto px-8">
                  Keep Exploring
                </Button>
              </Link>
            </div>

            {/* Project card */}
            {project && (
              <div className="mt-12 p-6 bg-white dark:bg-zinc-900 rounded-xl shadow-lg border">
                <p className="text-sm text-muted-foreground mb-3">You backed</p>
                <div className="flex items-center gap-4">
                  {project.imageUrl && (
                    <Image
                      src={project.imageUrl}
                      alt={project.title}
                      width={80}
                      height={60}
                      className="rounded-lg object-cover"
                    />
                  )}
                  <div className="text-left">
                    <h3 className="font-semibold">{project.title}</h3>
                    <p className="text-sm text-muted-foreground">by {project.creator?.name}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-background">
      {/* Header */}
      <header className="border-b bg-white dark:bg-background">
        <div className="container py-6">
          {/* Project title and creator - centered */}
          <div className="text-center mb-4">
            <h1 className="text-2xl font-bold mb-2">{project.title}</h1>
            <div className="flex items-center justify-center gap-2">
              {project.creator.image && (
                <Image
                  src={project.creator.image}
                  alt={project.creator.name}
                  width={24}
                  height={24}
                  className="rounded-full"
                />
              )}
              <span className="text-sm text-muted-foreground">{project.creator.name}</span>
            </div>
          </div>
          {/* Breadcrumb - centered */}
          <div className="flex justify-center">
            <Breadcrumb />
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {step === "rewards" && (
              <>
                {/* Page heading */}
                <div>
                  <h2 className="text-xl font-semibold mb-1">Select your reward</h2>
                  <p className="text-muted-foreground text-sm">
                    Pick which reward you&apos;d like to pledge for
                  </p>
                </div>

                {/* Pledge without reward */}
                <Card className="border-zinc-200">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <h3 className="font-semibold mb-1">Pledge without a reward</h3>
                        <p className="text-sm text-muted-foreground">
                          Support the project for no reward, just because it speaks to you.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center border rounded-md">
                          <span className="px-3 text-muted-foreground">$</span>
                          <Input
                            type="number"
                            min={1}
                            value={customPledgeAmount}
                            onChange={(e) => setCustomPledgeAmount(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-20 border-0 focus-visible:ring-0"
                          />
                        </div>
                        <Button
                          onClick={handlePledgeWithoutReward}
                          className="bg-[#028858] hover:bg-[#026d47] text-white whitespace-nowrap"
                        >
                          Pledge ${customPledgeAmount}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Available rewards header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h3 className="font-semibold">Available rewards</h3>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Ships to</span>
                    <Select value={shippingCountry} onValueChange={setShippingCountry}>
                      <SelectTrigger className="w-40 h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {COUNTRIES.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Reward cards */}
                {allRewards.length > 0 ? (
                  <div className="space-y-4">
                    {allRewards.map((reward) => {
                      const shipping = getShippingCost(reward.shippingCost, reward.shippingType, shippingCountry);

                      return (
                        <Card key={reward.id} className="border-zinc-200 overflow-hidden">
                          <CardContent className="p-0">
                            <div className="flex flex-col md:flex-row">
                              {/* Left side - Content */}
                              <div className="flex-1 p-5 order-2 md:order-1">
                                {/* Title */}
                                <h4 className="font-semibold text-lg uppercase tracking-wide mb-1">
                                  {reward.title}
                                </h4>

                                {/* Price and shipping */}
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-semibold">${reward.amount}</span>
                                  {shipping > 0 && (
                                    <>
                                      <span className="text-muted-foreground text-sm">+${shipping} shipping</span>
                                      <button className="text-muted-foreground hover:text-foreground">
                                        <Info className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                </div>

                                {/* Backer count */}
                                <p className="text-sm text-muted-foreground mb-3">
                                  {reward.quantityClaimed} backer{reward.quantityClaimed !== 1 ? "s" : ""}
                                </p>

                                {/* Description */}
                                {reward.description && (
                                  <p className="text-sm mb-4">{reward.description}</p>
                                )}

                                {/* Shipping info */}
                                {reward.shippingType !== "NO_SHIPPING" && (
                                  <p className="text-sm text-muted-foreground mb-1">
                                    Ships to {reward.shippingType === "WORLDWIDE" ? "Anywhere in the world" : currentCountry?.name}
                                  </p>
                                )}

                                {/* Estimated delivery */}
                                {reward.estimatedDelivery && (
                                  <p className="text-sm text-muted-foreground mb-4">
                                    Estimated delivery {reward.estimatedDelivery}
                                  </p>
                                )}

                                {/* Includes */}
                                {reward.items.length > 0 && (
                                  <div className="border-t pt-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                      Includes
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                      {reward.items.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                          <span className="w-5 h-5 rounded border border-zinc-300 flex items-center justify-center text-xs text-muted-foreground">
                                            {item.quantity}
                                          </span>
                                          {item.title}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right side - Image and button */}
                              <div className="w-full md:w-44 flex-shrink-0 flex flex-col border-t md:border-t-0 md:border-l order-1 md:order-2">
                                {/* Image */}
                                <div className="relative aspect-video md:aspect-square bg-zinc-100">
                                  {reward.imageUrl ? (
                                    <Image
                                      src={reward.imageUrl}
                                      alt={reward.title}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-zinc-400 text-xs uppercase tracking-wider text-center px-2">
                                        {reward.title.split(" ").slice(0, 2).join(" ")}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                {/* Pledge button */}
                                <Button
                                  onClick={() => handleSelectReward(reward)}
                                  className="rounded-none h-12 bg-[#028858] hover:bg-[#026d47] text-white font-medium"
                                >
                                  Pledge ${reward.amount}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground">No reward tiers available for this project.</p>
                      <p className="text-sm text-muted-foreground mt-2">
                        You can still support by pledging without a reward.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {step === "addons" && (
              <>
                <div>
                  <h2 className="text-xl font-semibold mb-1">Add-ons</h2>
                  <p className="text-muted-foreground text-sm">
                    Extras available to add to your pledge
                  </p>
                </div>

                {addons.length > 0 ? (
                  <div className="space-y-4">
                    {addons.map((addon) => {
                      const isSelected = selectedAddons[addon.id] > 0;
                      const shipping = getShippingCost(addon.shippingCost, addon.shippingType, shippingCountry);

                      return (
                        <Card
                          key={addon.id}
                          className={`overflow-hidden transition-all ${
                            isSelected ? "ring-2 ring-[#028858] border-[#028858]" : "border-zinc-200"
                          }`}
                        >
                          <CardContent className="p-0">
                            <div className="flex flex-col md:flex-row">
                              {/* Left side - Content */}
                              <div className="flex-1 p-5 order-2 md:order-1">
                                <h4 className="font-semibold text-lg uppercase tracking-wide mb-1">
                                  {addon.title}
                                </h4>

                                <div className="flex items-center gap-2 mb-2">
                                  <span className="font-semibold">${addon.amount}</span>
                                  {shipping > 0 && (
                                    <span className="text-muted-foreground text-sm">+${shipping} shipping</span>
                                  )}
                                </div>

                                <p className="text-sm text-muted-foreground mb-3">
                                  {addon.quantityClaimed} backer{addon.quantityClaimed !== 1 ? "s" : ""}
                                </p>

                                {addon.description && (
                                  <p className="text-sm mb-4">{addon.description}</p>
                                )}

                                {addon.shippingType !== "NO_SHIPPING" && (
                                  <p className="text-sm text-muted-foreground mb-1">
                                    Ships to {addon.shippingType === "WORLDWIDE" ? "Anywhere in the world" : currentCountry?.name}
                                  </p>
                                )}

                                {addon.estimatedDelivery && (
                                  <p className="text-sm text-muted-foreground mb-4">
                                    Estimated delivery {addon.estimatedDelivery}
                                  </p>
                                )}

                                {addon.includes.length > 0 && (
                                  <div className="border-t pt-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">Includes</p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                                      {addon.includes.map((item, idx) => (
                                        <div key={idx} className="flex items-center gap-2 text-sm">
                                          <span className="w-5 h-5 rounded border border-zinc-300 flex items-center justify-center text-xs text-muted-foreground">
                                            1
                                          </span>
                                          {item}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Right side - Image and button */}
                              <div className="w-full md:w-44 flex-shrink-0 flex flex-col border-t md:border-t-0 md:border-l order-1 md:order-2">
                                <div className="relative aspect-video md:aspect-square bg-zinc-100">
                                  {addon.imageUrl ? (
                                    <Image
                                      src={addon.imageUrl}
                                      alt={addon.title}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-zinc-400 text-xs uppercase tracking-wider text-center px-2">
                                        {addon.title.split(" ").slice(0, 2).join(" ")}
                                      </span>
                                    </div>
                                  )}
                                </div>

                                <Button
                                  onClick={() => handleAddonToggle(addon.id)}
                                  className={`rounded-none h-12 font-medium ${
                                    isSelected
                                      ? "bg-[#028858] hover:bg-[#026d47] text-white"
                                      : "bg-zinc-900 hover:bg-zinc-800 text-white"
                                  }`}
                                >
                                  {isSelected ? (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-2" />
                                      Added
                                    </>
                                  ) : (
                                    "Add"
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-6 text-center">
                      <p className="text-muted-foreground">No add-ons available for this project.</p>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {step === "payment" && (
              <div className="space-y-8">
                {/* Confirm payment method heading */}
                <div>
                  <h2 className="text-xl font-semibold mb-3">Confirm your payment method</h2>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We won&apos;t charge you at this time. If the project reaches its funding goal, your payment method will
                    be charged when the campaign ends. You&apos;ll receive a confirmation email when your pledge is successfully processed.
                  </p>
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    Any shipping costs and applicable taxes will be charged separately, when the creator is ready to
                    begin fulfillment.
                  </p>
                </div>

                {/* Collection plan */}
                <Card>
                  <CardContent className="p-0">
                    <h3 className="font-medium px-5 pt-5 pb-3">Collection plan</h3>

                    {/* Pledge in full option */}
                    <div className="border-t px-5 py-4">
                      <label className="flex items-start gap-3 cursor-pointer">
                        <div className="mt-0.5">
                          <div className="w-5 h-5 rounded-full border-2 border-foreground flex items-center justify-center">
                            <div className="w-2.5 h-2.5 rounded-full bg-foreground" />
                          </div>
                        </div>
                        <span className="font-medium">Pledge in full</span>
                      </label>
                    </div>
                  </CardContent>
                </Card>

                {/* Payment method */}
                <Card>
                  <CardContent className="p-5">
                    <h3 className="font-medium mb-4">Payment</h3>

                    {/* Show error if any */}
                    {paymentError && (
                      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <p className="text-sm text-red-600 dark:text-red-400 mb-2">{paymentError}</p>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setPaymentError(null);
                            setClientSecret(null);
                            setIsProcessing(false);
                            // This will trigger the useEffect to create a new pledge
                          }}
                        >
                          Try Again
                        </Button>
                      </div>
                    )}

                    {/* Stripe Elements - show after creating pledge */}
                    {clientSecret && stripePromise ? (
                      <Elements
                        stripe={stripePromise}
                        options={{
                          clientSecret,
                          appearance: {
                            theme: "stripe",
                            variables: {
                              colorPrimary: "#028858",
                            },
                          },
                        }}
                      >
                        <StripePaymentForm
                          onSuccess={handlePaymentSuccess}
                          onError={handlePaymentError}
                          agreedToTerms={agreedToTerms}
                          isProcessing={isProcessing}
                          setIsProcessing={setIsProcessing}
                          total={total}
                          intentType={intentType}
                        />
                      </Elements>
                    ) : (
                      /* Loading state while creating pledge and loading Stripe */
                      <div className="space-y-4">
                        <div className="flex flex-col items-center justify-center py-8">
                          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
                          <p className="text-sm text-muted-foreground">Loading payment form...</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* Order Summary for Add-ons step */}
              {step === "addons" && (selectedReward || pledgeWithoutReward) && (
                <Card>
                  <CardContent className="p-5">
                    {/* Selected reward */}
                    <div className="pb-4 border-b">
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Your pledge</p>
                      {pledgeWithoutReward ? (
                        <div className="flex justify-between">
                          <span className="font-medium">No reward</span>
                          <span className="font-semibold">${customPledgeAmount}</span>
                        </div>
                      ) : selectedReward && (
                        <div className="flex justify-between">
                          <span className="font-medium">{selectedReward.title}</span>
                          <span className="font-semibold">${selectedReward.amount}</span>
                        </div>
                      )}
                    </div>

                    {/* Add-ons */}
                    {Object.keys(selectedAddons).length > 0 && (
                      <div className="py-4 border-b">
                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Add-ons</p>
                        {Object.entries(selectedAddons).map(([id, qty]) => {
                          const addon = addons.find(a => a.id === id);
                          if (!addon) return null;
                          return (
                            <div key={id} className="flex justify-between text-sm">
                              <span>{addon.title} x{qty}</span>
                              <span>${addon.amount * qty}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Bonus support */}
                    <div className="py-4 border-b">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-medium">Bonus support</p>
                        <button className="text-muted-foreground hover:text-foreground">
                          <Info className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex items-center border rounded-md">
                        <span className="px-3 text-muted-foreground">$</span>
                        <Input
                          type="number"
                          min={0}
                          value={bonusSupport || ""}
                          onChange={(e) => setBonusSupport(Number(e.target.value) || 0)}
                          className="border-0 focus-visible:ring-0"
                          placeholder="0"
                        />
                      </div>
                    </div>

                    {/* Shipping */}
                    {totalShipping > 0 && (
                      <div className="py-4 border-b">
                        <div className="flex justify-between text-sm">
                          <span>Shipping to {currentCountry?.name}</span>
                          <span>${totalShipping}</span>
                        </div>
                      </div>
                    )}

                    {/* Total */}
                    <div className="pt-4">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total</span>
                        <span className="text-xl font-bold">${total}</span>
                      </div>
                    </div>

                    {/* Continue button */}
                    <div className="mt-4">
                      <Button
                        className="w-full bg-[#028858] hover:bg-[#026d47] text-white font-medium"
                        size="lg"
                        onClick={() => setStep("payment")}
                      >
                        Continue
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Payment step sidebar - simpler layout */}
              {step === "payment" && (selectedReward || pledgeWithoutReward) && (
                <Card>
                  <CardContent className="p-5">
                    {/* Reward */}
                    <div className="pb-4 border-b">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Reward</p>
                      <div className="flex justify-between">
                        <span className="font-medium uppercase text-sm">
                          {pledgeWithoutReward ? "No reward" : selectedReward?.title}
                        </span>
                        <span className="font-semibold">${pledgeWithoutReward ? customPledgeAmount : selectedReward?.amount}.00</span>
                      </div>
                    </div>

                    {/* Add-ons on payment page */}
                    {Object.keys(selectedAddons).length > 0 && (
                      <div className="py-4 border-b">
                        {Object.entries(selectedAddons).map(([id, qty]) => {
                          const addon = addons.find(a => a.id === id);
                          if (!addon) return null;
                          return (
                            <div key={id} className="flex justify-between text-sm">
                              <span>{addon.title} x{qty}</span>
                              <span>${addon.amount * qty}.00</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Shipping */}
                    <div className="py-4 border-b">
                      <p className="text-xs font-medium text-muted-foreground mb-1">Shipping</p>
                      <div className="flex justify-between text-sm">
                        <span>{currentCountry?.name}</span>
                        <span>${totalShipping}.00</span>
                      </div>
                    </div>

                    {/* Total amount */}
                    <div className="py-4 border-b">
                      <div className="flex justify-between items-center">
                        <span className="font-semibold">Total amount</span>
                        <span className="text-xl font-bold">${total}.00</span>
                      </div>
                    </div>

                    {/* Disclaimer */}
                    <div className="py-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        Backing means supporting a creative project, regardless of the outcome.
                      </p>

                      <div className="flex items-start gap-3 mb-4">
                        <Checkbox
                          id="terms"
                          checked={agreedToTerms}
                          onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                        />
                        <Label htmlFor="terms" className="text-xs leading-relaxed text-muted-foreground">
                          I understand that rewards or reimbursements aren&apos;t guaranteed by either IndieCrowdfund or the creator.
                        </Label>
                      </div>

                      {/* Status message */}
                      {!clientSecret ? (
                        <div className="flex items-center justify-center gap-2 py-2">
                          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Setting up payment...</span>
                        </div>
                      ) : (
                        <p className="text-xs text-center text-muted-foreground">
                          Enter your card details above to complete your pledge.
                        </p>
                      )}

                      <p className="text-xs text-muted-foreground mt-4 leading-relaxed">
                        By submitting your pledge, you agree to IndieCrowdfund&apos;s{" "}
                        <Link href="/terms" className="underline">Terms of Use</Link>
                        , and{" "}
                        <Link href="/privacy" className="underline">Privacy Policy</Link>
                        , and for our payment processor, Stripe, to charge your payment method.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Rewards Warning */}
              <div className="flex gap-3 text-sm">
                <AlertTriangle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Rewards aren&apos;t guaranteed.</p>
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    You&apos;re supporting an ambitious creative project that has yet to be developed.
                    It&apos;s important to consider that, despite a creator&apos;s efforts, there&apos;s a risk
                    that your reward may not be fulfilled. IndieCrowdfund is not responsible for
                    reward fulfillment or refunds.
                  </p>
                  <Link href="/trust-safety" className="text-xs underline hover:no-underline mt-2 inline-block">
                    Learn more about accountability
                  </Link>
                </div>
              </div>

              {/* FAQ */}
              <div>
                <h3 className="font-medium mb-3">Frequently Asked Questions</h3>
                <Accordion type="single" collapsible>
                  {FAQ_ITEMS.map((item, idx) => (
                    <AccordionItem key={idx} value={`faq-${idx}`} className="border-b">
                      <AccordionTrigger className="py-3 text-sm hover:no-underline text-left">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-sm text-muted-foreground pb-3">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
