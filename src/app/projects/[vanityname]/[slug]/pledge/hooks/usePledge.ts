"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { useSession } from "@/components/providers/auth-provider";
import { loadStripe } from "@stripe/stripe-js/pure";
import type { Stripe } from "@stripe/stripe-js";
import { ProjectData, RewardData, AddonData, Step } from "../types";
import { detectUserCountry } from "../constants";
import {
  getShippingCost,
  createAdditionalItemsPurchase as createAdditionalItemsAPI,
  createPledgeForPayment as createPledgeAPI,
  confirmPayment,
  modifyPledge as modifyPledgeAPI,
} from "../utils";

export function usePledge() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { status: authStatus } = useSession();

  const vanityname = (params?.vanityname as string) || "";
  const slug = (params?.slug as string) || "";
  const projectPath = `/projects/${vanityname}/${slug}`;

  const rewardId = searchParams?.get("reward") ?? null;
  const amountParam = searchParams?.get("amount") ?? null;
  const successParam = searchParams?.get("success") ?? null;
  const addItemsParam = searchParams?.get("addItems") ?? null;
  const modifyParam = searchParams?.get("modify") ?? null;
  const pledgeIdParam = searchParams?.get("pledgeId") ?? null;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (authStatus === "unauthenticated") {
      const returnUrl = encodeURIComponent(`${projectPath}/pledge${rewardId ? `?reward=${rewardId}` : ""}`);
      router.push(`/login?callbackUrl=${returnUrl}`);
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
  const [customPledgeAmount, setCustomPledgeAmount] = useState(amountParam ? Math.max(1, parseFloat(amountParam) || 1) : 10);

  // UI state
  const [step, setStep] = useState<Step>(rewardId || addItemsParam || modifyParam ? "addons" : "rewards");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
  const [bonusSupport, setBonusSupport] = useState<number>(0);
  const [shippingCountry, setShippingCountry] = useState(() => {
    if (typeof window !== "undefined") return detectUserCountry();
    return "US";
  });
  const [hasSavedAddress, setHasSavedAddress] = useState<boolean | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddItemsMode] = useState(!!addItemsParam);
  const [isModifyMode] = useState(!!modifyParam);
  const [modifyPledgeId] = useState<string | null>(modifyParam);
  const [existingPledgeId] = useState<string | null>(addItemsParam);
  const [originalPledgeAmount, setOriginalPledgeAmount] = useState<number>(0);
  const [modifyChargeAmount, setModifyChargeAmount] = useState<number | null>(null);

  // Stripe state (stripePromise removed - platform Stripe disabled, replaced by PayPal)
  const [dcStripePromise, setDcStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [intentType, setIntentType] = useState<"payment_intent" | "setup_intent">("setup_intent");
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [currentPledgeId, setCurrentPledgeId] = useState<string | null>(null);
  // PayPal state
  const [paypalOrderId, setPaypalOrderId] = useState<string | null>(null);
  const [paypalClientId, setPaypalClientId] = useState<string | null>(null);
  const [paypalMode, setPaypalMode] = useState<string>("live");
  // Whop state
  const [whopSessionId, setWhopSessionId] = useState<string | null>(null);
  const [whopPlanId, setWhopPlanId] = useState<string | null>(null);
  const [whopEnvironment, setWhopEnvironment] = useState<"production" | "sandbox">("production");

  const creatingPaymentRef = useRef(false);

  // Fetch saved address
  useEffect(() => {
    if (authStatus !== "authenticated") return;
    async function fetchSavedAddress() {
      try {
        const res = await fetch("/api/backer/addresses");
        if (!res.ok) return;
        const data = await res.json();
        const addresses = data.addresses || [];
        if (addresses.length > 0) {
          setHasSavedAddress(true);
          const defaultAddr = addresses.find((a: { isDefault: boolean }) => a.isDefault) || addresses[0];
          if (defaultAddr?.country) setShippingCountry(defaultAddr.country);
        } else {
          setHasSavedAddress(false);
        }
      } catch {
        setHasSavedAddress(false);
      }
    }
    fetchSavedAddress();
  }, [authStatus]);

  // Load existing pledge in modify mode
  useEffect(() => {
    async function loadExistingPledge() {
      if (!modifyPledgeId) return;
      try {
        const res = await fetch(`/api/pledges/${modifyPledgeId}`);
        if (!res.ok) return;
        const data = await res.json();
        const existingPledge = data.pledge;
        setOriginalPledgeAmount(existingPledge.amount);
        // NOTE: reward is restored by fetchData via getExistingPledgeRewardId — do NOT clear it here
        if (!existingPledge.reward) {
          // Pledge had no reward tier (custom amount pledge)
          setPledgeWithoutReward(true);
          setCustomPledgeAmount(existingPledge.amount);
        }
        if (existingPledge.addons?.length > 0) {
          const addonMap: Record<string, number> = {};
          for (const addon of existingPledge.addons) addonMap[addon.id] = addon.quantity;
          setSelectedAddons(addonMap);
        }
      } catch (err) {
        console.error("Failed to load existing pledge:", err);
      }
    }
    loadExistingPledge();
  }, [modifyPledgeId]);

  // Handle success redirect
  useEffect(() => {
    async function handleSuccessRedirect() {
      if (successParam === "true") {
        if (pledgeIdParam) {
          try {
            const res = await apiFetch(`/api/pledges/${pledgeIdParam}/confirm`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
            });
            if (!res.ok) console.error("Failed to confirm pledge after redirect");
          } catch (error) {
            console.error("Error confirming pledge after redirect:", error);
          }
        }
        setStep("success");
      }
    }
    handleSuccessRedirect();
  }, [successParam, pledgeIdParam]);

  // Initialize Stripe - DISABLED: Replaced by PayPal
  // useEffect(() => {
  //   async function initStripe() {
  //     try {
  //       const res = await fetch("/api/stripe/config");
  //       const data = await res.json();
  //       if (data.publishableKey) setStripePromise(loadStripe(data.publishableKey));
  //     } catch (err) {
  //       console.error("Failed to load Stripe config:", err);
  //     }
  //   }
  //   initStripe();
  // }, []);

  // Load PayPal client ID and client token when project uses PayPal
  useEffect(() => {
    if (!project || project.paymentProcessor !== "PAYPAL") return;
    async function initPayPal() {
      try {
        const configRes = await fetch("/api/paypal/config");
        const configData = await configRes.json();
        if (configData.clientId) setPaypalClientId(configData.clientId);
        if (configData.mode) setPaypalMode(configData.mode);
      } catch (err) {
        console.error("Failed to load PayPal config:", err);
      }
    }
    initPayPal();
  }, [project]);

  // Load Whop plan ID and environment when project uses Whop
  useEffect(() => {
    if (!project || project.paymentProcessor !== "WHOP") return;
    async function initWhop() {
      try {
        const res = await fetch("/api/whop/config");
        if (!res.ok) return;
        const data = await res.json();
        if (data.planId) setWhopPlanId(data.planId);
        if (data.environment) setWhopEnvironment(data.environment as "production" | "sandbox");
      } catch (err) {
        console.error("Failed to load Whop config:", err);
      }
    }
    initWhop();
  }, [project]);

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
    return sum + getShippingCost(addon.shippingCost, addon.shippingType, shippingCountry) * qty;
  }, 0);

  const subtotal = rewardAmount + addonsTotal + bonusSupport;
  const totalShipping = rewardShipping + addonsShipping;
  const total = subtotal + totalShipping;
  const addItemsTotal = addonsTotal + addonsShipping;

  // Reset guard on state clear
  useEffect(() => {
    if (!clientSecret && !paypalOrderId && !whopSessionId && !paymentError && !isProcessing) creatingPaymentRef.current = false;
  }, [clientSecret, paypalOrderId, whopSessionId, paymentError, isProcessing]);

  const createAdditionalItemsPurchase = async () => {
    if (!project || !existingPledgeId || Object.keys(selectedAddons).length === 0) return;
    if (clientSecret || currentPledgeId) return;
    if (creatingPaymentRef.current) return;
    creatingPaymentRef.current = true;
    setIsProcessing(true);
    setPaymentError(null);
    try {
      const result = await createAdditionalItemsAPI(existingPledgeId, selectedAddons, addItemsTotal);
      setCurrentPledgeId(result.pledgeId);
      if (result.publishableKey && !dcStripePromise) setDcStripePromise(loadStripe(result.publishableKey));
      if (!result.clientSecret) throw new Error("Invalid payment response - missing client secret");
      setClientSecret(result.clientSecret);
      setIntentType((result.type || "payment_intent") as "payment_intent" | "setup_intent");
      setIsProcessing(false);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to create additional items purchase");
      setIsProcessing(false);
      creatingPaymentRef.current = false;
    }
  };

  const submitModifyPledge = async () => {
    if (!project || !modifyPledgeId) return;
    if (currentPledgeId) return;
    if (creatingPaymentRef.current) return;
    creatingPaymentRef.current = true;
    setIsProcessing(true);
    setPaymentError(null);
    try {
      const addonsWithQuantity = Object.entries(selectedAddons).map(([id, quantity]) => ({ id, quantity }));
      const result = await modifyPledgeAPI(modifyPledgeId, selectedReward?.id || "no-reward", addonsWithQuantity, total, totalShipping, shippingCountry);
      if (result.requiresPayment && result.clientSecret) {
        const chargeAmount = total - originalPledgeAmount;
        setModifyChargeAmount(chargeAmount > 0 ? chargeAmount : null);
        setClientSecret(result.clientSecret);
        setIntentType("payment_intent");
        setCurrentPledgeId(modifyPledgeId);
        if (result.publishableKey && !dcStripePromise) setDcStripePromise(loadStripe(result.publishableKey));
        setIsProcessing(false);
      } else {
        setCurrentPledgeId(modifyPledgeId);
        setStep("success");
        setIsProcessing(false);
      }
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to modify pledge");
      setIsProcessing(false);
      creatingPaymentRef.current = false;
    }
  };

  const createPledgeForPayment = async () => {
    if (!project || (!selectedReward && !pledgeWithoutReward)) return;
    if (clientSecret || paypalOrderId || whopSessionId) return;
    if (currentPledgeId) return;
    if (creatingPaymentRef.current) return;
    creatingPaymentRef.current = true;
    setIsProcessing(true);
    setPaymentError(null);
    try {
      const result = await createPledgeAPI(project.id, selectedReward?.id || null, selectedAddons, total, totalShipping, shippingCountry);
      setCurrentPledgeId(result.pledgeId);
      if (result.paypalOrderId) {
        // PayPal flow: no clientSecret, use paypalOrderId directly
        setPaypalOrderId(result.paypalOrderId);
      } else if (result.whopSessionId) {
        // Whop flow: use sessionId for embedded checkout
        setWhopSessionId(result.whopSessionId);
      } else {
        if (!result.clientSecret) throw new Error("Invalid payment response - missing client secret");
        if (result.publishableKey && !dcStripePromise) setDcStripePromise(loadStripe(result.publishableKey));
        setClientSecret(result.clientSecret);
        setIntentType((result.type || "setup_intent") as "payment_intent" | "setup_intent");
      }
      setIsProcessing(false);
    } catch (err) {
      setPaymentError(err instanceof Error ? err.message : "Failed to create pledge");
      setIsProcessing(false);
      creatingPaymentRef.current = false;
    }
  };

  // Auto-create pledge on payment step
  useEffect(() => {
    if (isModifyMode) {
      if (step === "payment" && !clientSecret && !currentPledgeId && !isProcessing && !paymentError && project && modifyPledgeId) submitModifyPledge();
    } else if (isAddItemsMode) {
      if (step === "payment" && !clientSecret && !currentPledgeId && !isProcessing && !paymentError && project && Object.keys(selectedAddons).length > 0) createAdditionalItemsPurchase();
    } else {
      if (step === "payment" && !clientSecret && !paypalOrderId && !whopSessionId && !currentPledgeId && !isProcessing && !paymentError && project && (selectedReward || pledgeWithoutReward)) createPledgeForPayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, project, selectedReward, pledgeWithoutReward, clientSecret, currentPledgeId, isProcessing, paymentError, isAddItemsMode, isModifyMode, selectedAddons]);

  const getExistingPledgeRewardId = async (pledgeId: string): Promise<string | null> => {
    try {
      const res = await fetch(`/api/pledges/${pledgeId}`);
      if (!res.ok) return null;
      const data = await res.json();
      return data.pledge?.reward?.id || null;
    } catch {
      return null;
    }
  };

  // Fetch project and reward data
  const fetchData = useCallback(async () => {
    if (!slug || !vanityname) return;
    setIsLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/projects/vanity/${vanityname}/${slug}`;
      const projectRes = await fetch(apiUrl);
      if (!projectRes.ok) throw new Error("Project not found");
      const responseData = await projectRes.json();
      const projectData = responseData.project;

      const formattedProject: ProjectData = {
        id: projectData.id, title: projectData.title, slug: projectData.slug,
        imageUrl: projectData.imageUrl || "", paymentProcessor: projectData.paymentProcessor || "STRIPE",
        campaignType: projectData.campaignType || "ALL_OR_NOTHING",
        hasAdultContent: projectData.hasAdultContent || false, estimatedDelivery: projectData.estimatedDelivery || "",
        currentAmount: projectData.currentAmount || 0, goalAmount: projectData.goalAmount || 0,
        endDate: projectData.endDate || null,
        creator: { id: projectData.creator?.id || "", name: projectData.creator?.name || "Creator", location: projectData.location || "", image: projectData.creator?.image || "" },
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
        id: string; title: string; description?: string; amount: number;
        shippingCost?: Record<string, number> | number; shippingType?: string;
        shippingCountries?: string[]; imageUrl?: string; estimatedDelivery?: string;
        quantityClaimed?: number; items?: { title: string }[];
      }) => ({
        id: reward.id, title: reward.title, description: reward.description || "",
        amount: reward.amount, shippingCost: reward.shippingCost || {},
        shippingType: reward.shippingType || "NO_SHIPPING", shippingCountries: reward.shippingCountries || [],
        imageUrl: reward.imageUrl || "",
        estimatedDelivery: reward.estimatedDelivery
          ? new Date(reward.estimatedDelivery).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "",
        quantityClaimed: reward.quantityClaimed || 0,
        items: (reward.items || []).map((item: { title: string }) => ({ title: item.title, quantity: 1 })),
      }));
      setAllRewards(formattedTiers);

      const effectiveRewardId = rewardId || (modifyPledgeId ? await getExistingPledgeRewardId(modifyPledgeId) : null);
      if (effectiveRewardId) {
        const reward = rewards.find((r: { id: string }) => r.id === effectiveRewardId);
        if (reward) {
          setSelectedReward({
            id: reward.id, title: reward.title, description: reward.description || "",
            amount: reward.amount, shippingCost: reward.shippingCost || {},
            shippingType: reward.shippingType || "NO_SHIPPING", shippingCountries: reward.shippingCountries || [],
            imageUrl: reward.imageUrl || "",
            estimatedDelivery: reward.estimatedDelivery
              ? new Date(reward.estimatedDelivery).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "",
            quantityClaimed: reward.quantityClaimed || 0,
            items: (reward.items || []).map((item: { title: string }) => ({ title: item.title, quantity: 1 })),
          });
        }
      }

      const formattedAddons: AddonData[] = addonsFromApi.map((addon: {
        id: string; title: string; description?: string; amount: number;
        shippingCost?: Record<string, number> | number; shippingType?: string;
        shippingCountries?: string[]; imageUrl?: string; estimatedDelivery?: string;
        quantityAvailable?: number; quantityClaimed?: number; items?: { title: string }[];
      }) => ({
        id: addon.id, title: addon.title, description: addon.description || "",
        amount: addon.amount, shippingCost: addon.shippingCost || {},
        shippingType: (addon.shippingType as AddonData["shippingType"]) || "NO_SHIPPING",
        shippingCountries: addon.shippingCountries || [], imageUrl: addon.imageUrl || null,
        estimatedDelivery: addon.estimatedDelivery
          ? new Date(addon.estimatedDelivery).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "",
        limitedQuantity: addon.quantityAvailable || null, quantityClaimed: addon.quantityClaimed || 0,
        includes: (addon.items || []).map((item: { title: string }) => item.title),
      }));
      setAddons(formattedAddons);
    } catch (err) {
      console.error("Failed to fetch pledge data:", err);
      setError(err instanceof Error ? err.message : "Failed to load project data");
    } finally {
      setIsLoading(false);
    }
  }, [slug, vanityname, rewardId, modifyPledgeId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Handlers
  const handleAddonToggle = (addonId: string) => {
    setSelectedAddons((prev) => {
      if (prev[addonId]) {
        const { [addonId]: _removed, ...rest } = prev;
        void _removed;
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
        const { [addonId]: _removed, ...rest } = prev;
        void _removed;
        return rest;
      }
      const addon = addons.find(a => a.id === addonId);
      if (addon?.limitedQuantity !== null && addon?.limitedQuantity !== undefined) {
        const availableQty = addon.limitedQuantity - addon.quantityClaimed;
        if (newQty > availableQty) return prev;
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
        if (isModifyMode) {
          await confirmPayment(currentPledgeId, false, true);
        } else {
          await confirmPayment(currentPledgeId, isAddItemsMode);
        }
        setStep("success");
      } catch (err) {
        console.error("Failed to confirm payment:", err);
        setPaymentError("Payment received but confirmation failed. Please refresh the page or contact support if the issue persists.");
      }
    } else {
      setStep("success");
    }
    setIsProcessing(false);
  };

  const handlePaymentError = (message: string) => {
    setPaymentError(message);
  };

  return {
    // Auth
    authStatus,
    // Navigation
    projectPath,
    // Data
    project, allRewards, selectedReward, addons, isLoading, error,
    pledgeWithoutReward, customPledgeAmount, setCustomPledgeAmount,
    // UI
    step, setStep, selectedAddons, bonusSupport, setBonusSupport,
    shippingCountry, setShippingCountry, hasSavedAddress,
    agreedToTerms, setAgreedToTerms, isProcessing, setIsProcessing,
    isAddItemsMode, isModifyMode, originalPledgeAmount, modifyChargeAmount,
    // Stripe (dcStripePromise is used by DivinityCoin processor)
    dcStripePromise, clientSecret, setClientSecret,
    intentType, paymentError, setPaymentError, currentPledgeId,
    // PayPal
    paypalOrderId, paypalClientId, paypalMode,
    // Whop
    whopSessionId, whopPlanId, whopEnvironment,
    // Totals
    totalShipping, addonsShipping, total, addItemsTotal,
    // Handlers
    handleAddonToggle, handleAddonQuantityChange, handleSelectReward,
    handlePledgeWithoutReward, handlePaymentSuccess, handlePaymentError,
    // Re-exported utils
    getShippingCost,
  };
}
