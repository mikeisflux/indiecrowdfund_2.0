"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useParams } from "next/navigation";
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
  Lock,
  CheckCircle,
  ChevronRight,
  AlertTriangle,
  Loader2,
  Info,
} from "lucide-react";

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

export default function PledgePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const rewardId = searchParams.get("reward");
  const amountParam = searchParams.get("amount");

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
    setStep("addons");
  };

  const handleSubmitPledge = async () => {
    setIsProcessing(true);
    setTimeout(() => {
      setStep("success");
      setIsProcessing(false);
    }, 2000);
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
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <button
        onClick={() => (selectedReward || pledgeWithoutReward) && setStep("addons")}
        className={step === "addons" ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground disabled:cursor-not-allowed"}
        disabled={!selectedReward && !pledgeWithoutReward}
      >
        Add-ons
      </button>
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
            <Link href="/" className="text-xl font-bold">
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
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
          <div className="container flex h-14 items-center">
            <Link href="/" className="text-xl font-bold">
              IndieCrowdfund
            </Link>
          </div>
        </header>
        <div className="container py-16">
          <div className="mx-auto max-w-lg text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Thank you for your pledge!</h2>
            <p className="mb-8 text-muted-foreground">
              Your support means the world to {project.creator.name}. You&apos;ll
              receive an email confirmation shortly.
            </p>
            <div className="space-y-3">
              <Link href={`/projects/${project.slug}`}>
                <Button className="w-full">Back to project</Button>
              </Link>
              <Link href="/discover">
                <Button variant="outline" className="w-full">
                  Discover more projects
                </Button>
              </Link>
            </div>
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
                    <div className="flex items-center justify-between">
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
                          className="bg-[#028858] hover:bg-[#026d47] text-white"
                        >
                          Pledge ${customPledgeAmount}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Available rewards header */}
                <div className="flex items-center justify-between">
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
                            <div className="flex">
                              {/* Left side - Content */}
                              <div className="flex-1 p-5">
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
                              <div className="w-44 flex-shrink-0 flex flex-col border-l">
                                {/* Image */}
                                <div className="relative aspect-square bg-zinc-100">
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
                            <div className="flex">
                              {/* Left side - Content */}
                              <div className="flex-1 p-5">
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
                              <div className="w-44 flex-shrink-0 flex flex-col border-l">
                                <div className="relative aspect-square bg-zinc-100">
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
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold mb-1">Payment</h2>
                  <p className="text-muted-foreground text-sm">
                    Complete your pledge securely
                  </p>
                </div>

                <Card>
                  <CardContent className="p-6">
                    <div className="rounded-lg border bg-muted/50 p-4">
                      <p className="text-sm text-muted-foreground">
                        You&apos;ll be redirected to Stripe to complete your payment
                        securely. We accept all major credit and debit cards.
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="underline hover:text-primary">
                      Terms of Service
                    </Link>{" "}
                    and understand that my card will only be charged if this campaign reaches its funding goal.
                  </Label>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* Order Summary - only show after reward selection */}
              {(selectedReward || pledgeWithoutReward) && (
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
                      {step === "addons" && (
                        <Button
                          className="w-full bg-[#028858] hover:bg-[#026d47] text-white font-medium"
                          size="lg"
                          onClick={() => setStep("payment")}
                        >
                          Continue
                        </Button>
                      )}
                      {step === "payment" && (
                        <Button
                          className="w-full bg-[#028858] hover:bg-[#026d47] text-white font-medium"
                          size="lg"
                          onClick={handleSubmitPledge}
                          disabled={!agreedToTerms || isProcessing}
                        >
                          {isProcessing ? (
                            "Processing..."
                          ) : (
                            <>
                              <Lock className="mr-2 h-4 w-4" />
                              Pledge ${total}
                            </>
                          )}
                        </Button>
                      )}
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
