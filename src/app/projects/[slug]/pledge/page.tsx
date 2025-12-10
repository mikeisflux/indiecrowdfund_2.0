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
  paymentProcessor: "STRIPE" | "CCBILL";
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
    question: "When will I be charged?",
    answer: "Your payment method will be charged immediately when you complete your pledge. If the project doesn't reach its funding goal, you'll receive a full refund.",
  },
  {
    question: "Can I change or cancel my pledge?",
    answer: "You can modify or cancel your pledge at any time before the campaign ends. After the campaign successfully funds, changes may be limited based on the creator's policy.",
  },
  {
    question: "When will I get my reward?",
    answer: "Estimated delivery dates are shown for each reward. These are estimates provided by the creator and actual delivery may vary. You'll receive updates from the creator throughout the fulfillment process.",
  },
  {
    question: "What if the project doesn't reach its goal?",
    answer: "This is an all-or-nothing campaign. If the project doesn't reach its funding goal by the deadline, all pledges will be refunded in full.",
  },
  {
    question: "Is my payment secure?",
    answer: "Yes, all payments are processed through secure, encrypted connections. We use industry-standard security measures to protect your payment information.",
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
    // Then redirect to Stripe checkout or CCBill
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
                  <h1 className="text-2xl font-bold mb-2">Add-ons</h1>
                  <p className="text-muted-foreground mb-6">
                    Enhance your pledge with these optional add-ons. You can skip this step if you don&apos;t want any extras.
                  </p>

                  <div className="space-y-4">
                    {addons.map((addon) => {
                      const isSelected = selectedAddons[addon.id] > 0;
                      const qty = selectedAddons[addon.id] || 0;

                      return (
                        <Card
                          key={addon.id}
                          className={`overflow-hidden transition-all ${
                            isSelected ? "ring-2 ring-primary" : ""
                          }`}
                        >
                          <CardContent className="p-0">
                            <div className="flex">
                              {/* Image */}
                              <div className="w-48 h-48 bg-muted flex-shrink-0 relative">
                                {addon.imageUrl ? (
                                  <Image
                                    src={addon.imageUrl}
                                    alt={addon.title}
                                    fill
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full bg-gradient-to-br from-muted to-muted-foreground/20 flex items-center justify-center">
                                    <span className="text-4xl text-muted-foreground/50">+</span>
                                  </div>
                                )}
                              </div>

                              {/* Content */}
                              <div className="flex-1 p-5">
                                <div className="flex items-start justify-between mb-3">
                                  <div>
                                    <div className="flex items-center gap-2 mb-1">
                                      <h3 className="font-semibold text-lg">{addon.title}</h3>
                                      {addon.limitedQuantity && (
                                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded font-medium">
                                          Limited ({addon.limitedQuantity} left)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                      <span className="font-semibold text-foreground text-base">
                                        ${addon.amount}
                                      </span>
                                      <span>
                                        Estimated Shipping: ${getShippingCostForCountry(
                                          addon.shippingCost,
                                          addon.shippingType,
                                          shippingCountry
                                        )}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Add/Quantity buttons */}
                                  {!isSelected ? (
                                    <Button
                                      variant="outline"
                                      onClick={() => handleAddonToggle(addon.id)}
                                      className="border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add
                                    </Button>
                                  ) : (
                                    <div className="flex items-center gap-2 bg-muted rounded-md p-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleAddonQuantity(addon.id, -1)}
                                      >
                                        <Minus className="h-4 w-4" />
                                      </Button>
                                      <span className="w-8 text-center font-medium">{qty}</span>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        onClick={() => handleAddonQuantity(addon.id, 1)}
                                      >
                                        <Plus className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  )}
                                </div>

                                <p className="text-sm text-muted-foreground mb-3">
                                  {addon.description}
                                </p>

                                <div className="text-sm text-muted-foreground mb-2">
                                  Estimated delivery: <span className="text-foreground">{addon.estimatedDelivery}</span>
                                </div>

                                {/* Includes section */}
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                                    Includes:
                                  </p>
                                  <ul className="text-sm space-y-0.5">
                                    {addon.includes.map((item, idx) => (
                                      <li key={idx} className="flex items-center gap-2">
                                        <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                                        {item}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Rewards Warning */}
                <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4">
                  <div className="flex gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-200 mb-1">
                        Rewards aren&apos;t guaranteed.
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-300">
                        Your pledge supports the creation of this project. Rewards are offered as a thank you,
                        but delivery dates and specifications may change. Crowdfunding is not shopping.
                      </p>
                    </div>
                  </div>
                </div>

                {/* FAQ Accordion */}
                <div>
                  <h2 className="text-xl font-semibold mb-4">Frequently asked questions</h2>
                  <Accordion type="single" collapsible className="border rounded-lg">
                    {FAQ_ITEMS.map((item, idx) => (
                      <AccordionItem key={idx} value={`item-${idx}`} className="border-b last:border-b-0">
                        <AccordionTrigger className="px-4 hover:no-underline hover:bg-muted/50">
                          {item.question}
                        </AccordionTrigger>
                        <AccordionContent className="px-4 pb-4 text-muted-foreground">
                          {item.answer}
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
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
                    and understand that I&apos;m supporting a crowdfunding campaign,
                    not purchasing a finished product. Rewards are not guaranteed.
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
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Your Reward
                    </p>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{selectedReward.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Est. delivery: {selectedReward.estimatedDelivery}
                        </p>
                      </div>
                      <span className="font-semibold">${selectedReward.amount}</span>
                    </div>
                    <ul className="mt-2 space-y-0.5">
                      {selectedReward.items.map((item, idx) => (
                        <li key={idx} className="text-xs text-muted-foreground flex items-center gap-1">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          {item.quantity}x {item.title}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Selected add-ons */}
                  {Object.keys(selectedAddons).length > 0 && (
                    <div className="p-4 border-b">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                        Add-ons
                      </p>
                      <div className="space-y-2">
                        {Object.entries(selectedAddons).map(([id, qty]) => {
                          const addon = addons.find((a) => a.id === id);
                          if (!addon) return null;
                          return (
                            <div key={id} className="flex justify-between text-sm">
                              <span>{addon.title} x{qty}</span>
                              <span>${addon.amount * qty}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Bonus support */}
                  <div className="p-4 border-b">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                      Bonus Support
                    </p>
                    <p className="text-xs text-muted-foreground mb-2">
                      Show extra love for this project
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">$</span>
                      <Input
                        type="number"
                        min={0}
                        value={bonusSupport || ""}
                        onChange={(e) => setBonusSupport(Number(e.target.value) || 0)}
                        className="w-24 h-9"
                        placeholder="0"
                      />
                    </div>
                  </div>

                  {/* Totals */}
                  <div className="p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Shipping</span>
                      <span>${totalShipping.toFixed(2)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between font-semibold">
                      <span>Total</span>
                      <span className="text-lg">${total.toFixed(2)} {currentCountry?.currency}</span>
                    </div>
                    {currentCountry?.currency !== "USD" && (
                      <p className="text-xs text-muted-foreground">
                        Approximately ${total.toFixed(2)} USD. Currency conversion fees may apply.
                      </p>
                    )}
                  </div>

                  {/* Continue button */}
                  <div className="p-4 pt-0">
                    {step === "addons" && (
                      <Button
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        size="lg"
                        onClick={() => setStep("shipping")}
                      >
                        Continue
                      </Button>
                    )}
                    {step === "shipping" && (
                      <div className="space-y-2">
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
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
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                          size="lg"
                          onClick={handleSubmitPledge}
                          disabled={!agreedToTerms || isProcessing}
                        >
                          {isProcessing ? (
                            "Processing..."
                          ) : (
                            <>
                              <Lock className="mr-2 h-4 w-4" />
                              Pledge ${total.toFixed(2)}
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

              {/* Estimated shipping info */}
              <Card>
                <CardContent className="p-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                    Estimated Shipping
                  </p>
                  <p className="text-sm">
                    Ships to {currentCountry?.name || "your location"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Delivery estimate: {project.estimatedDelivery}
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
