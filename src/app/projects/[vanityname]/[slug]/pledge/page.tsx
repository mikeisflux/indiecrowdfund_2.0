"use client";

/**
 * Pledge page for both vanity URLs (/projects/[vanityname]/[slug]/pledge)
 * and legacy URLs (/projects/[slug]/pledge via middleware rewrite to /projects/_/[slug]/pledge)
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { useSession } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Loader2 } from "lucide-react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { ProjectData, RewardData, AddonData, Step } from "./types";
import { detectUserCountry } from "./constants";
import { getShippingCost, createAdditionalItemsPurchase as createAdditionalItemsAPI, createPledgeForPayment as createPledgeAPI, confirmPayment } from "./utils";
import { Breadcrumb } from "./components/Breadcrumb";
import { RewardSelector } from "./components/RewardSelector";
import { AddonSelector } from "./components/AddonSelector";
import { PaymentStep } from "./components/PaymentStep";
import { OrderSummary } from "./components/OrderSummary";
import { FAQSection } from "./components/FAQSection";
import { SuccessPage } from "./components/SuccessPage";
import { DivinityCoinWallet } from "./components/DivinityCoinWallet";

export default function PledgePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status: authStatus } = useSession();

  // Get vanityname and slug from URL params
  const vanityname = (params?.vanityname as string) || "";
  const slug = (params?.slug as string) || "";

  // Check if this is a legacy URL (vanityname = "_" from middleware rewrite)
  const isLegacyUrl = vanityname === "_";

  // Build the project URL path for navigation
  const projectPath = isLegacyUrl ? `/projects/${slug}` : `/projects/${vanityname}/${slug}`;

  const rewardId = searchParams?.get("reward") ?? null;
  const amountParam = searchParams?.get("amount") ?? null;
  const successParam = searchParams?.get("success") ?? null;
  const addItemsParam = searchParams?.get("addItems") ?? null;
  const pledgeIdParam = searchParams?.get("pledgeId") ?? null;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      const returnUrl = encodeURIComponent(`${projectPath}/pledge${rewardId ? `?reward=${rewardId}` : ""}`);
      router.push(`/login?redirect=${returnUrl}`);
    }
  }, [authStatus, router, projectPath, rewardId]);

  // Data state
  const [project, setProject] = useState<ProjectData | null>(null);
  const [allRewards, setAllRewards] = useState<RewardData[]>([]);
  const [selectedReward, setSelectedReward] = useState<RewardData | null>(null);
  const [addons, setAddons] = useState<AddonData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pledgeWithoutReward, setPledgeWithoutReward] = useState(false);
  const [customPledgeAmount, setCustomPledgeAmount] = useState(amountParam ? parseInt(amountParam) : 10);

  // UI state
  const [step, setStep] = useState<Step>(rewardId || addItemsParam ? "addons" : "rewards");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [bonusSupport, setBonusSupport] = useState<number>(0);
  const [shippingCountry, setShippingCountry] = useState(() => {
    if (typeof window !== "undefined") {
      return detectUserCountry();
    }
    return "US";
  });
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddItemsMode] = useState(!!addItemsParam);
  const [existingPledgeId] = useState<string | null>(addItemsParam);

  // Stripe state
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<"payment_intent" | "setup_intent">("setup_intent");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [currentPledgeId, setCurrentPledgeId] = useState<string | null>(null);

  // DivinityCoin payment state
  const [divinityCoinBalance, setDivinityCoinBalance] = useState<number>(0);
  const [divinityCoinReady, setDivinityCoinReady] = useState(false);

  // Handle success redirect (including after 3D Secure authentication)
  useEffect(() => {
    async function handleSuccessRedirect() {
      if (successParam === "true") {
        if (pledgeIdParam) {
          try {
            const res = await fetch(`/api/pledges/${pledgeIdParam}/confirm`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) {
              console.error("Failed to confirm pledge after redirect");
            }
          } catch (error) {
            console.error("Error confirming pledge after redirect:", error);
          }
        }
        setStep("success");
      }
    }
    handleSuccessRedirect();
  }, [successParam, pledgeIdParam]);

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
  const addItemsTotal = addonsTotal + addonsShipping;

  // Auto-create pledge when entering payment step
  useEffect(() => {
    if (isAddItemsMode) {
      if (step === "payment" && !clientSecret && !isProcessing && !paymentError && project && Object.keys(selectedAddons).length > 0) {
        createAdditionalItemsPurchase();
      }
    } else {
      if (step === "payment" && !clientSecret && !currentPledgeId && !isProcessing && !paymentError && project && (selectedReward || pledgeWithoutReward)) {
        createPledgeForPayment();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, project, selectedReward, pledgeWithoutReward, clientSecret, currentPledgeId, isProcessing, paymentError, isAddItemsMode, selectedAddons]);

  const createAdditionalItemsPurchase = async () => {
    if (!project || !existingPledgeId || Object.keys(selectedAddons).length === 0) return;
    if (clientSecret) return;

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const result = await createAdditionalItemsAPI(existingPledgeId, selectedAddons, addItemsTotal);
      setClientSecret(result.clientSecret);
      setIntentType(result.type as "payment_intent" | "setup_intent");
      setCurrentPledgeId(result.pledgeId);
      setIsProcessing(false);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to create additional items purchase");
      setIsProcessing(false);
    }
  };

  const createPledgeForPayment = async () => {
    if (!project || (!selectedReward && !pledgeWithoutReward)) return;
    if (clientSecret) return;
    if (currentPledgeId) return;

    setIsProcessing(true);
    setPaymentError(null);

    try {
      const result = await createPledgeAPI(
        project.id,
        selectedReward?.id || null,
        selectedAddons,
        total,
        totalShipping,
        shippingCountry
      );

      setCurrentPledgeId(result.pledgeId);

      if (result.paymentMethod === "DIVINITYCOIN") {
        setIsProcessing(false);
        return;
      }

      if (!result.clientSecret) {
        throw new Error("Invalid payment response - missing client secret");
      }

      setClientSecret(result.clientSecret);
      setIntentType((result.type || "setup_intent") as "payment_intent" | "setup_intent");
      setIsProcessing(false);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to create pledge");
      setIsProcessing(false);
    }
  };

  // Fetch project and reward data from API
  const fetchData = useCallback(async () => {
    if (!slug || !vanityname) return;

    setIsLoading(true);
    setError(null);

    try {
      const apiUrl = isLegacyUrl
        ? `/api/projects/slug/${slug}`
        : `/api/projects/vanity/${vanityname}/${slug}`;

      const projectRes = await fetch(apiUrl);
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
        currentAmount: projectData.currentAmount || 0,
        goalAmount: projectData.goalAmount || 0,
        endDate: projectData.endDate || null,
        creator: {
          id: projectData.creator?.id || "",
          name: projectData.creator?.name || "Creator",
          location: projectData.location || "",
          image: projectData.creator?.image || "",
        },
      };

      if (formattedProject.endDate && new Date(formattedProject.endDate) < new Date()) {
        setError("This campaign has ended and is no longer accepting pledges.");
        setIsLoading(false);
        return;
      }

      setProject(formattedProject);

      const rewards = responseData.rewards || [];
      const addonsFromApi = responseData.addons || [];

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
  }, [slug, vanityname, isLegacyUrl, rewardId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    const fetchDivinityCoinBalance = async () => {
      if (project?.paymentProcessor === "DIVINITYCOIN") {
        try {
          const response = await fetch("/api/divinitycoin/redeem");
          if (response.ok) {
            const data = await response.json();
            setDivinityCoinBalance(data.balance || 0);
          }
          setDivinityCoinReady(true);
        } catch (err) {
          console.error("Failed to fetch DivinityCoin balance:", err);
          setDivinityCoinReady(true);
        }
      }
    };
    fetchDivinityCoinBalance();
  }, [project?.paymentProcessor]);

  const handleAddonToggle = (addonId: string) => {
    setSelectedAddons((prev) => {
      if (prev[addonId]) {
        const { [addonId]: _, ...rest } = prev;
        void _; // Indicate intentionally unused
        return rest;
      }
      return { ...prev, [addonId]: 1 };
    });
  };

  const handleAddonQuantityChange = (addonId: string, delta: number) => {
    setSelectedAddons((prev) => {
      const currentQty = prev[addonId] || 0;
      const newQty = Math.max(0, currentQty + delta);

      if (newQty === 0) {
        const { [addonId]: _, ...rest } = prev;
        void _; // Indicate intentionally unused
        return rest;
      }

      const addon = addons.find(a => a.id === addonId);
      if (addon?.limitedQuantity !== null && addon?.limitedQuantity !== undefined) {
        const availableQty = addon.limitedQuantity - addon.quantityClaimed;
        if (newQty > availableQty) {
          return prev;
        }
      }

      return { ...prev, [addonId]: newQty };
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
    setSelectedAddons({});
    setStep("payment");
  };

  const handlePaymentSuccess = async () => {
    if (currentPledgeId) {
      try {
        await confirmPayment(currentPledgeId, isAddItemsMode);
      } catch (err) {
        console.error("Failed to confirm payment:", err);
      }
    }
    setStep("success");
    setIsProcessing(false);
  };

  const handlePaymentError = (message: string) => {
    setPaymentError(message);
  };

  // Auth loading state
  if (authStatus === "loading" || authStatus === "unauthenticated") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
          <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-purple-500/10" style={{ animationDelay: '-5s' }} />
        </div>
        <div className="text-center relative">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass-card mb-6 relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" />
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
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
      <div className="min-h-screen bg-background flex items-center justify-center relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/10" />
          <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-cyan-500/10" style={{ animationDelay: '-5s' }} />
        </div>
        <div className="text-center relative">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl glass-card mb-6 relative">
            <div className="absolute inset-0 rounded-2xl bg-primary/20 animate-ping" />
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
          <p className="text-muted-foreground">Loading pledge details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !project) {
    return (
      <div className="min-h-screen bg-background relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-red-500/10" />
          <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-orange-500/10" style={{ animationDelay: '-5s' }} />
        </div>
        <header className="sticky top-0 z-50 border-b border-border/50 glass-card">
          <div className="container flex h-14 items-center">
            <Link href="/" className="text-xl font-bold bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
              IndieCrowdfund
            </Link>
          </div>
        </header>
        <div className="container py-16 relative">
          <div className="mx-auto max-w-lg text-center glass-card rounded-2xl p-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-100 dark:bg-red-900/30 mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Unable to load project</h2>
            <p className="mb-8 text-muted-foreground">
              {error || "The project you're looking for could not be found."}
            </p>
            <Link href="/discover">
              <Button className="bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90 shadow-lg shadow-primary/20">
                Discover Projects
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (step === "success") {
    return (
      <SuccessPage
        project={project}
        isAddItemsMode={isAddItemsMode}
        pledgeWithoutReward={pledgeWithoutReward}
        selectedReward={selectedReward}
        customPledgeAmount={customPledgeAmount}
        selectedAddons={selectedAddons}
        addons={addons}
        bonusSupport={bonusSupport}
        shippingCountry={shippingCountry}
        totalShipping={totalShipping}
        addonsShipping={addonsShipping}
        total={total}
        addItemsTotal={addItemsTotal}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 dark:from-background dark:to-background relative">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb absolute -top-40 -right-40 w-[500px] h-[500px] bg-primary/5" />
        <div className="floating-orb absolute top-1/3 -left-40 w-[400px] h-[400px] bg-cyan-500/5" style={{ animationDelay: '-5s' }} />
        <div className="floating-orb absolute bottom-20 right-1/4 w-[300px] h-[300px] bg-purple-500/5" style={{ animationDelay: '-10s' }} />
      </div>

      {/* Header */}
      <header className="border-b border-border/50 glass-card relative z-10">
        <div className="container py-6">
          <div className="text-center mb-4">
            <h1 className="text-2xl md:text-3xl font-bold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/80">{project.title}</h1>
            <div className="flex items-center justify-center gap-2">
              {project.creator.image ? (
                <Image
                  src={project.creator.image}
                  alt={project.creator.name}
                  width={28}
                  height={28}
                  className="rounded-full ring-2 ring-border/50"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-emerald-600 flex items-center justify-center text-white text-xs font-medium">
                  {project.creator.name.charAt(0)}
                </div>
              )}
              <span className="text-sm text-muted-foreground">by <span className="font-medium text-foreground/80">{project.creator.name}</span></span>
            </div>
          </div>
          <div className="flex justify-center">
            <Breadcrumb
              step={step}
              setStep={setStep}
              selectedReward={selectedReward}
              pledgeWithoutReward={pledgeWithoutReward}
              isAddItemsMode={isAddItemsMode}
              selectedAddons={selectedAddons}
            />
          </div>
        </div>
      </header>

      <div className="container py-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {step === "rewards" && (
              <RewardSelector
                allRewards={allRewards}
                customPledgeAmount={customPledgeAmount}
                setCustomPledgeAmount={setCustomPledgeAmount}
                handlePledgeWithoutReward={handlePledgeWithoutReward}
                shippingCountry={shippingCountry}
                setShippingCountry={setShippingCountry}
                handleSelectReward={handleSelectReward}
                getShippingCost={getShippingCost}
              />
            )}

            {step === "addons" && (
              <AddonSelector
                addons={addons}
                selectedAddons={selectedAddons}
                isAddItemsMode={isAddItemsMode}
                shippingCountry={shippingCountry}
                handleAddonToggle={handleAddonToggle}
                handleAddonQuantityChange={handleAddonQuantityChange}
                getShippingCost={getShippingCost}
              />
            )}

            {step === "payment" && (
              <PaymentStep
                project={project}
                isAddItemsMode={isAddItemsMode}
                paymentError={paymentError}
                setPaymentError={setPaymentError}
                setClientSecret={setClientSecret}
                setIsProcessing={setIsProcessing}
                divinityCoinReady={divinityCoinReady}
                divinityCoinBalance={divinityCoinBalance}
                total={total}
                agreedToTerms={agreedToTerms}
                currentPledgeId={currentPledgeId}
                handlePaymentSuccess={handlePaymentSuccess}
                handlePaymentError={handlePaymentError}
                isProcessing={isProcessing}
                setDivinityCoinBalance={setDivinityCoinBalance}
                clientSecret={clientSecret}
                stripePromise={stripePromise}
                intentType={intentType}
                projectPath={projectPath}
              />
            )}
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-6 space-y-6">
              {/* DivinityCoin Wallet - only shown for DivinityCoin projects */}
              {project.paymentProcessor === "DIVINITYCOIN" && (
                <DivinityCoinWallet
                  balance={divinityCoinBalance}
                  total={isAddItemsMode ? addItemsTotal : total}
                  onBalanceUpdate={setDivinityCoinBalance}
                  isLoading={!divinityCoinReady}
                />
              )}

              <OrderSummary
                step={step}
                isAddItemsMode={isAddItemsMode}
                selectedReward={selectedReward}
                pledgeWithoutReward={pledgeWithoutReward}
                customPledgeAmount={customPledgeAmount}
                selectedAddons={selectedAddons}
                addons={addons}
                bonusSupport={bonusSupport}
                setBonusSupport={setBonusSupport}
                shippingCountry={shippingCountry}
                totalShipping={totalShipping}
                addonsShipping={addonsShipping}
                total={total}
                addItemsTotal={addItemsTotal}
                setStep={setStep}
                agreedToTerms={agreedToTerms}
                setAgreedToTerms={setAgreedToTerms}
                clientSecret={clientSecret}
                project={project}
              />

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

              <FAQSection project={project} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
