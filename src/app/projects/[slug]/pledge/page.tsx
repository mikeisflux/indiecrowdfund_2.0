"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  Lock,
  Plus,
  Minus,
  CheckCircle,
  ChevronRight,
  AlertTriangle,
  Loader2,
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
  creator: { name: string; location: string };
}

interface RewardData {
  id: string;
  title: string;
  amount: number;
  shippingCost: Record<string, number>;
  shippingType: "NO_SHIPPING" | "WORLDWIDE" | "SELECTED_COUNTRIES";
  shippingCountries: string[];
  estimatedDelivery: string;
  items: { title: string; quantity: number }[];
}

interface AddonData {
  id: string;
  title: string;
  description: string;
  amount: number;
  shippingCost: Record<string, number>;
  shippingType: "NO_SHIPPING" | "WORLDWIDE" | "SELECTED_COUNTRIES";
  shippingCountries: string[];
  imageUrl: string | null;
  estimatedDelivery: string;
  limitedQuantity: number | null;
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
    answer: "Your card is only charged when the campaign reaches its funding goal. If you pledge before the goal is met, your payment is held and will only be processed once the campaign successfully funds. If the campaign doesn't reach its goal, you won't be charged at all. If your payment fails when the campaign funds, we'll automatically retry up to 3 times over the following 9 days (once every 3 days).",
  },
  {
    question: "So I'm only charged if funding succeeds?",
    answer: "Exactly! Your payment is held until the campaign reaches its funding goal. If the project doesn't reach its goal by the deadline, your payment method is never charged. This protects you and ensures creators only receive funds when they can deliver on their promises.",
  },
  {
    question: "What if the campaign is already funded?",
    answer: "If you pledge after a campaign has already reached its funding goal, your payment will be processed immediately since the project is guaranteed to move forward.",
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

type Step = "addons" | "shipping" | "payment" | "success";

export default function PledgePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const rewardId = searchParams.get("reward");

  // Data state - loaded from API
  const [project, setProject] = useState<ProjectData | null>(null);
  const [selectedReward, setSelectedReward] = useState<RewardData | null>(null);
  const [addons, setAddons] = useState<AddonData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [step, setStep] = useState<Step>("addons");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [bonusSupport, setBonusSupport] = useState<number>(0);
  const [shippingCountry, setShippingCountry] = useState("US");
  const [shippingAddress, setShippingAddress] = useState({
    name: "",
    address1: "",
    address2: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});

  // Fetch project and reward data from API
  const fetchData = useCallback(async () => {
    if (!slug) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch project by slug
      const projectRes = await fetch(`/api/projects/slug/${slug}`);
      if (!projectRes.ok) {
        throw new Error("Project not found");
      }
      const projectData = await projectRes.json();

      // Format project data
      const formattedProject: ProjectData = {
        id: projectData.id,
        title: projectData.title,
        slug: projectData.slug,
        imageUrl: projectData.imageUrl || "",
        paymentProcessor: projectData.paymentProcessor || "STRIPE",
        hasAdultContent: projectData.hasAdultContent || false,
        estimatedDelivery: projectData.estimatedDelivery || "",
        creator: {
          name: projectData.creator?.name || "Creator",
          location: projectData.location || "",
        },
      };
      setProject(formattedProject);

      // Fetch rewards for this project
      const rewardsRes = await fetch(`/api/projects/${projectData.id}/rewards`);
      if (rewardsRes.ok) {
        const rewardsData = await rewardsRes.json();
        const rewards = rewardsData.rewards || [];

        // Find the selected reward
        if (rewardId) {
          const reward = rewards.find((r: { id: string }) => r.id === rewardId);
          if (reward) {
            const formattedReward: RewardData = {
              id: reward.id,
              title: reward.title,
              amount: reward.amount,
              shippingCost: reward.shippingCost || {},
              shippingType: reward.shippingType || "NO_SHIPPING",
              shippingCountries: reward.shippingCountries || [],
              estimatedDelivery: reward.estimatedDelivery
                ? new Date(reward.estimatedDelivery).toLocaleDateString("en-US", { month: "short", year: "numeric" })
                : "",
              items: (reward.items || []).map((item: { title: string }) => ({
                title: item.title,
                quantity: 1,
              })),
            };
            setSelectedReward(formattedReward);
          }
        }

        // Get addons
        const addonRewards = rewards.filter((r: { type: string }) => r.type === "ADDON");
        const formattedAddons: AddonData[] = addonRewards.map((addon: {
          id: string;
          title: string;
          description?: string;
          amount: number;
          shippingCost?: Record<string, number>;
          shippingType?: string;
          shippingCountries?: string[];
          imageUrl?: string;
          estimatedDelivery?: string;
          quantityAvailable?: number;
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
            ? new Date(addon.estimatedDelivery).toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : "",
          limitedQuantity: addon.quantityAvailable || null,
          includes: (addon.items || []).map((item: { title: string }) => item.title),
        }));
        setAddons(formattedAddons);
      }
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
  const getShippingCostForCountry = (
    shippingCost: Record<string, number>,
    shippingType: string,
    country: string
  ): number => {
    if (shippingType === "NO_SHIPPING") return 0;
    if (shippingType === "WORLDWIDE") {
      return shippingCost["WORLDWIDE"] || 0;
    }
    // For selected countries, look up the specific country rate
    return shippingCost[country] || 0;
  };

  // Calculate totals
  const rewardAmount = selectedReward?.amount || 0;
  const rewardShipping = selectedReward
    ? getShippingCostForCountry(
        selectedReward.shippingCost,
        selectedReward.shippingType,
        shippingCountry
      )
    : 0;

  const addonsTotal = Object.entries(selectedAddons).reduce((sum, [id, qty]) => {
    const addon = addons.find((a) => a.id === id);
    return sum + (addon?.amount || 0) * qty;
  }, 0);

  const addonsShipping = Object.entries(selectedAddons).reduce((sum, [id, qty]) => {
    const addon = addons.find((a) => a.id === id);
    if (!addon) return sum;
    const addonShipping = getShippingCostForCountry(
      addon.shippingCost,
      addon.shippingType,
      shippingCountry
    );
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

  const handleAddonQuantity = (addonId: string, delta: number) => {
    setSelectedAddons((prev) => {
      const current = prev[addonId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [addonId]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [addonId]: newQty };
    });
  };

  const handleSubmitPledge = async () => {
    setIsProcessing(true);
    // Would call API to create pledge and get payment intent
    // Then redirect to Stripe checkout
    setTimeout(() => {
      setStep("success");
      setIsProcessing(false);
    }, 2000);
  };

  const currentCountry = COUNTRIES.find((c) => c.code === shippingCountry);

  // Breadcrumb navigation
  const Breadcrumb = () => (
    <div className="flex items-center gap-2 text-sm">
      <Link
        href={`/projects/${project?.slug || slug}`}
        className="text-muted-foreground hover:text-foreground"
      >
        Rewards
      </Link>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <span className={step === "addons" ? "font-medium" : "text-muted-foreground"}>
        Add-ons
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <span className={step === "shipping" ? "font-medium" : "text-muted-foreground"}>
        Shipping
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
      <span className={step === "payment" ? "font-medium" : "text-muted-foreground"}>
        Payment
      </span>
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

  // No reward selected state
  if (!selectedReward) {
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
            <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
            <h2 className="mb-2 text-2xl font-bold">No reward selected</h2>
            <p className="mb-8 text-muted-foreground">
              Please select a reward tier from the project page to continue with your pledge.
            </p>
            <Link href={`/projects/${project.slug}`}>
              <Button>View Rewards</Button>
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
      <header className="sticky top-0 z-50 border-b bg-white dark:bg-background">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-xl font-bold">
              IndieCrowdfund
            </Link>
            <Breadcrumb />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            Secure checkout
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
          {/* Main Content - 2 columns */}
          <div className="lg:col-span-2 space-y-8">
            {/* Back link */}
            <Link
              href={`/projects/${project.slug}`}
              className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to project
            </Link>

            {step === "addons" && (
              <>
                {/* Add-ons Section */}
                <div>
                  <h1 className="text-2xl font-bold mb-2">Select optional add-ons</h1>
                  <p className="text-muted-foreground mb-6">
                    Here are some items that are available to add to your pledge.
                  </p>

                  <div className="space-y-4">
                    {addons.map((addon) => {
                      const isSelected = selectedAddons[addon.id] > 0;
                      const addonShipping = getShippingCostForCountry(
                        addon.shippingCost,
                        addon.shippingType,
                        shippingCountry
                      );
                      const isExpanded = expandedDescriptions[addon.id] || false;
                      const descriptionLimit = 200;
                      const shouldTruncate = addon.description.length > descriptionLimit;

                      return (
                        <Card
                          key={addon.id}
                          className={`overflow-hidden transition-all border ${
                            isSelected ? "ring-2 ring-green-600 border-green-600" : "border-zinc-200"
                          }`}
                        >
                          <CardContent className="p-0">
                            <div className="flex">
                              {/* Content - Left side */}
                              <div className="flex-1 p-5">
                                {/* Title */}
                                <h3 className="font-semibold text-lg mb-1">{addon.title}</h3>

                                {/* Price with shipping */}
                                <div className="flex items-center gap-1 mb-2">
                                  <span className="font-semibold">${addon.amount}</span>
                                  <span className="text-muted-foreground text-sm">
                                    +${addonShipping} shipping
                                  </span>
                                  <button
                                    className="text-muted-foreground hover:text-foreground"
                                    title="Shipping cost may vary based on location"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <circle cx="12" cy="12" r="10"/>
                                      <path d="M12 16v-4"/>
                                      <path d="M12 8h.01"/>
                                    </svg>
                                  </button>
                                </div>

                                {/* Availability */}
                                {addon.limitedQuantity && (
                                  <p className="text-amber-600 text-sm font-medium mb-3">
                                    {addon.limitedQuantity} available
                                  </p>
                                )}

                                {/* Description with Read more */}
                                <div className="text-sm text-muted-foreground mb-3">
                                  {shouldTruncate && !isExpanded ? (
                                    <>
                                      {addon.description.substring(0, descriptionLimit)}...{" "}
                                      <button
                                        onClick={() => setExpandedDescriptions(prev => ({ ...prev, [addon.id]: true }))}
                                        className="text-foreground underline hover:no-underline"
                                      >
                                        Read more
                                      </button>
                                    </>
                                  ) : (
                                    addon.description
                                  )}
                                </div>

                                {/* Shipping info */}
                                <div className="text-sm text-muted-foreground mb-1">
                                  Ships to {addon.shippingType === "WORLDWIDE" ? "Anywhere in the world" : currentCountry?.name || "your location"}
                                </div>

                                {/* Estimated delivery */}
                                <div className="text-sm text-muted-foreground mb-4">
                                  Estimated delivery {addon.estimatedDelivery}
                                </div>

                                {/* Includes section */}
                                {addon.includes.length > 0 && (
                                  <div className="border-t pt-3">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                      Includes
                                    </p>
                                    <ul className="text-sm space-y-1">
                                      {addon.includes.map((item, idx) => (
                                        <li key={idx} className="flex items-center gap-2">
                                          <span className="w-5 h-5 rounded border border-zinc-300 flex items-center justify-center text-xs text-muted-foreground">
                                            1
                                          </span>
                                          {item}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>

                              {/* Image and Add button - Right side */}
                              <div className="w-36 flex-shrink-0 flex flex-col">
                                {/* Image with price badge */}
                                <div className="relative bg-zinc-800 aspect-square">
                                  {addon.imageUrl ? (
                                    <Image
                                      src={addon.imageUrl}
                                      alt={addon.title}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center">
                                      <span className="text-zinc-500 text-sm uppercase tracking-wider font-medium text-center px-2">
                                        {addon.title.split(" ").slice(0, 2).join(" ")}
                                      </span>
                                    </div>
                                  )}
                                  {/* Price badge */}
                                  <div className="absolute bottom-2 left-2 bg-green-600 text-white text-sm font-semibold px-2 py-1 rounded">
                                    ${addon.amount}
                                  </div>
                                </div>

                                {/* Add button */}
                                <Button
                                  onClick={() => handleAddonToggle(addon.id)}
                                  className={`rounded-none h-12 ${
                                    isSelected
                                      ? "bg-green-600 hover:bg-green-700 text-white"
                                      : "bg-zinc-900 hover:bg-zinc-800 text-white"
                                  }`}
                                >
                                  {isSelected ? (
                                    <>
                                      <CheckCircle className="h-4 w-4 mr-1" />
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
                </div>

              </>
            )}

            {step === "shipping" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold mb-2">Shipping address</h1>
                  <p className="text-muted-foreground">
                    Where should we deliver your rewards?
                  </p>
                </div>

                <Card>
                  <CardContent className="p-6 space-y-4">
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Select
                        value={shippingCountry}
                        onValueChange={setShippingCountry}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Select country" />
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

                    <div>
                      <Label htmlFor="name">Full name</Label>
                      <Input
                        id="name"
                        className="mt-1"
                        value={shippingAddress.name}
                        onChange={(e) =>
                          setShippingAddress((p) => ({ ...p, name: e.target.value }))
                        }
                        placeholder="John Doe"
                      />
                    </div>

                    <div>
                      <Label htmlFor="address1">Address line 1</Label>
                      <Input
                        id="address1"
                        className="mt-1"
                        value={shippingAddress.address1}
                        onChange={(e) =>
                          setShippingAddress((p) => ({
                            ...p,
                            address1: e.target.value,
                          }))
                        }
                        placeholder="123 Main St"
                      />
                    </div>

                    <div>
                      <Label htmlFor="address2">
                        Address line 2{" "}
                        <span className="text-muted-foreground">(optional)</span>
                      </Label>
                      <Input
                        id="address2"
                        className="mt-1"
                        value={shippingAddress.address2}
                        onChange={(e) =>
                          setShippingAddress((p) => ({
                            ...p,
                            address2: e.target.value,
                          }))
                        }
                        placeholder="Apt, suite, etc."
                      />
                    </div>

                    <div className="grid gap-4 sm:grid-cols-3">
                      <div>
                        <Label htmlFor="city">City</Label>
                        <Input
                          id="city"
                          className="mt-1"
                          value={shippingAddress.city}
                          onChange={(e) =>
                            setShippingAddress((p) => ({
                              ...p,
                              city: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="state">State/Province</Label>
                        <Input
                          id="state"
                          className="mt-1"
                          value={shippingAddress.state}
                          onChange={(e) =>
                            setShippingAddress((p) => ({
                              ...p,
                              state: e.target.value,
                            }))
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="zip">ZIP/Postal code</Label>
                        <Input
                          id="zip"
                          className="mt-1"
                          value={shippingAddress.zip}
                          onChange={(e) =>
                            setShippingAddress((p) => ({
                              ...p,
                              zip: e.target.value,
                            }))
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="phone">
                        Phone number{" "}
                        <span className="text-muted-foreground">(for delivery)</span>
                      </Label>
                      <Input
                        id="phone"
                        type="tel"
                        className="mt-1"
                        value={shippingAddress.phone}
                        onChange={(e) =>
                          setShippingAddress((p) => ({
                            ...p,
                            phone: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {step === "payment" && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl font-bold mb-2">Payment</h1>
                  <p className="text-muted-foreground">
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

                {/* Terms */}
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="terms"
                    checked={agreedToTerms}
                    onCheckedChange={(checked) =>
                      setAgreedToTerms(checked === true)
                    }
                  />
                  <Label htmlFor="terms" className="text-sm leading-relaxed">
                    I agree to the{" "}
                    <Link href="/terms" className="underline hover:text-primary">
                      Terms of Service
                    </Link>{" "}
                    and understand that my card will only be charged if this campaign reaches its funding goal. I&apos;m supporting a crowdfunding campaign, not purchasing a finished product. Rewards are not guaranteed.
                  </Label>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Order Summary */}
          <div className="lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              {/* Order Summary Card */}
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  {/* Project header */}
                  <div className="p-4 border-b bg-muted/30">
                    <div className="flex gap-3">
                      <div className="w-16 h-16 bg-muted rounded overflow-hidden flex-shrink-0">
                        {project.imageUrl ? (
                          <Image
                            src={project.imageUrl}
                            alt={project.title}
                            width={64}
                            height={64}
                            className="object-cover w-full h-full"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-medium text-sm line-clamp-2">{project.title}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          by {project.creator.name}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Selected reward */}
                  <div className="p-4 border-b">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Reward
                    </p>
                    <div className="flex justify-between items-start">
                      <span className="font-medium">{selectedReward.title}</span>
                      <span className="font-semibold">${selectedReward.amount}</span>
                    </div>
                  </div>

                  {/* Bonus support */}
                  <div className="p-4 border-b">
                    <div className="flex items-center gap-1 mb-3">
                      <p className="text-sm font-medium">
                        Bonus support
                      </p>
                      <button
                        className="text-muted-foreground hover:text-foreground"
                        title="Add an extra amount to show your support for this creator"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <path d="M12 16v-4"/>
                          <path d="M12 8h.01"/>
                        </svg>
                      </button>
                    </div>
                    <div className="flex items-center border rounded-md">
                      <span className="px-3 text-muted-foreground">$</span>
                      <Input
                        type="number"
                        min={0}
                        value={bonusSupport || ""}
                        onChange={(e) => setBonusSupport(Number(e.target.value) || 0)}
                        className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Shipping */}
                  <div className="p-4 border-b">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Shipping
                    </p>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">{currentCountry?.name || "United States"}</span>
                      <span className="font-semibold">${totalShipping.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-semibold">Total amount</span>
                      <span className="text-xl font-bold">${total.toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Continue button */}
                  <div className="p-4 pt-0">
                    {step === "addons" && (
                      <Button
                        className="w-full bg-[#028858] hover:bg-[#026d47] text-white font-medium"
                        size="lg"
                        onClick={() => setStep("shipping")}
                      >
                        Continue
                      </Button>
                    )}
                    {step === "shipping" && (
                      <div className="space-y-2">
                        <Button
                          className="w-full bg-[#028858] hover:bg-[#026d47] text-white font-medium"
                          size="lg"
                          onClick={() => setStep("payment")}
                          disabled={
                            !shippingAddress.name ||
                            !shippingAddress.address1 ||
                            !shippingAddress.city ||
                            !shippingAddress.zip
                          }
                        >
                          Continue to payment
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full"
                          onClick={() => setStep("addons")}
                        >
                          Back
                        </Button>
                      </div>
                    )}
                    {step === "payment" && (
                      <div className="space-y-2">
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
                              Pledge ${total.toFixed(0)}
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          className="w-full"
                          onClick={() => setStep("shipping")}
                        >
                          Back
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Rewards Warning in sidebar */}
              <div className="flex gap-3 text-sm">
                <AlertTriangle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                <div>
                  <p className="font-medium mb-1">Rewards aren&apos;t guaranteed.</p>
                  <p className="text-muted-foreground text-xs">
                    You&apos;re supporting an ambitious creative project that has yet to be developed. It&apos;s important to consider that, despite a creator&apos;s efforts, there&apos;s a risk that your reward may not be fulfilled. We urge you to consider this risk prior to pledging. IndieCrowdfund is not responsible for reward fulfillment or refunds.
                  </p>
                  <Link href="/trust-safety" className="text-xs underline hover:no-underline mt-1 inline-block">
                    Learn more about accountability
                  </Link>
                </div>
              </div>

              {/* Sidebar FAQ */}
              <div>
                <h3 className="font-medium mb-3">Frequently Asked Questions</h3>
                <Accordion type="single" collapsible className="space-y-0">
                  {FAQ_ITEMS.slice(0, 6).map((item, idx) => (
                    <AccordionItem key={idx} value={`sidebar-faq-${idx}`} className="border-b py-0">
                      <AccordionTrigger className="py-3 text-sm hover:no-underline">
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
