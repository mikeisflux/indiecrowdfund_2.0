"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CreditCard,
  Lock,
  Plus,
  Minus,
  CheckCircle,
  Info,
} from "lucide-react";

// Mock data - would be fetched based on project slug and reward ID
const mockProject = {
  id: "1",
  title: "Revolutionary Solar-Powered Backpack",
  slug: "solar-powered-backpack",
  paymentProcessor: "STRIPE" as const,
  hasAdultContent: false,
  creator: {
    name: "Green Tech Labs",
  },
};

const mockRewards = [
  {
    id: "r1",
    title: "Early Bird Special",
    amount: 89,
    shippingCost: 15,
    items: [{ title: "Solar Backpack" }],
  },
  {
    id: "r2",
    title: "Standard Package",
    amount: 129,
    shippingCost: 15,
    items: [{ title: "Solar Backpack" }, { title: "USB-C Cable" }],
  },
  {
    id: "r3",
    title: "Deluxe Bundle",
    amount: 199,
    shippingCost: 0,
    items: [
      { title: "Solar Backpack" },
      { title: "Extra Battery Pack" },
      { title: "Rain Cover" },
      { title: "Cable Set" },
    ],
  },
];

const mockAddons = [
  {
    id: "a1",
    title: "Extra Battery Pack",
    amount: 35,
    shippingCost: 5,
  },
  {
    id: "a2",
    title: "Rain Cover",
    amount: 15,
    shippingCost: 3,
  },
  {
    id: "a3",
    title: "Cable Set",
    amount: 20,
    shippingCost: 2,
  },
];

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
];

export default function PledgePage() {
  const searchParams = useSearchParams();
  const rewardId = searchParams.get("reward");

  const [step, setStep] = useState(1);
  const [selectedReward, setSelectedReward] = useState(rewardId || "");
  const [customAmount, setCustomAmount] = useState<number>(10);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, number>>({});
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

  const project = mockProject;
  const rewards = mockRewards;
  const addons = mockAddons;

  const selectedRewardData =
    selectedReward === "custom"
      ? null
      : rewards.find((r) => r.id === selectedReward);

  // Calculate totals
  const rewardAmount = selectedRewardData?.amount || customAmount || 0;
  const rewardShipping = selectedRewardData?.shippingCost || 0;

  const addonsTotal = Object.entries(selectedAddons).reduce((sum, [id, qty]) => {
    const addon = addons.find((a) => a.id === id);
    return sum + (addon?.amount || 0) * qty;
  }, 0);

  const addonsShipping = Object.entries(selectedAddons).reduce((sum, [id, qty]) => {
    const addon = addons.find((a) => a.id === id);
    return sum + (addon?.shippingCost || 0) * qty;
  }, 0);

  const subtotal = rewardAmount + addonsTotal;
  const totalShipping = rewardShipping + addonsShipping;
  const total = subtotal + totalShipping;

  const handleAddonChange = (addonId: string, delta: number) => {
    setSelectedAddons((prev) => {
      const current = prev[addonId] || 0;
      const newQty = Math.max(0, current + delta);
      if (newQty === 0) {
        const { [addonId]: _, ...rest } = prev;
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
      setStep(4); // Success step
      setIsProcessing(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <Link
            href={`/projects/${project.slug}`}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to project
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Lock className="h-4 w-4 text-green-500" />
            Secure checkout
          </div>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="border-b">
        <div className="container py-4">
          <div className="flex items-center justify-center gap-4">
            {[
              { num: 1, label: "Reward" },
              { num: 2, label: "Shipping" },
              { num: 3, label: "Payment" },
            ].map(({ num, label }) => (
              <div key={num} className="flex items-center gap-2">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                    step >= num
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > num ? <CheckCircle className="h-5 w-5" /> : num}
                </div>
                <span
                  className={`hidden text-sm sm:inline ${
                    step >= num ? "font-medium" : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
                {num < 3 && (
                  <div
                    className={`h-px w-8 ${
                      step > num ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="container py-8">
        {step < 4 ? (
          <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-5">
            {/* Main Content */}
            <div className="lg:col-span-3">
              {step === 1 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">Select your reward</h2>
                    <p className="text-sm text-muted-foreground">
                      Choose a reward tier or make a custom pledge
                    </p>
                  </div>

                  <RadioGroup
                    value={selectedReward}
                    onValueChange={setSelectedReward}
                    className="space-y-4"
                  >
                    {rewards.map((reward) => (
                      <div key={reward.id}>
                        <Label
                          htmlFor={reward.id}
                          className={`flex cursor-pointer rounded-lg border p-4 transition-all ${
                            selectedReward === reward.id
                              ? "border-primary bg-primary/5"
                              : "hover:border-primary/50"
                          }`}
                        >
                          <RadioGroupItem
                            value={reward.id}
                            id={reward.id}
                            className="mt-1"
                          />
                          <div className="ml-4 flex-1">
                            <div className="flex items-start justify-between">
                              <div>
                                <p className="font-medium">{reward.title}</p>
                                <p className="text-sm text-muted-foreground">
                                  {reward.items.map((i) => i.title).join(", ")}
                                </p>
                              </div>
                              <p className="font-semibold">${reward.amount}</p>
                            </div>
                            {reward.shippingCost > 0 && (
                              <p className="mt-1 text-xs text-muted-foreground">
                                + ${reward.shippingCost} shipping
                              </p>
                            )}
                          </div>
                        </Label>
                      </div>
                    ))}

                    {/* Custom Amount */}
                    <div>
                      <Label
                        htmlFor="custom"
                        className={`flex cursor-pointer rounded-lg border p-4 transition-all ${
                          selectedReward === "custom"
                            ? "border-primary bg-primary/5"
                            : "hover:border-primary/50"
                        }`}
                      >
                        <RadioGroupItem
                          value="custom"
                          id="custom"
                          className="mt-1"
                        />
                        <div className="ml-4 flex-1">
                          <p className="font-medium">Pledge without a reward</p>
                          <p className="mb-3 text-sm text-muted-foreground">
                            Support the project with any amount
                          </p>
                          {selectedReward === "custom" && (
                            <div className="flex items-center gap-2">
                              <span>$</span>
                              <Input
                                type="number"
                                min={1}
                                value={customAmount}
                                onChange={(e) =>
                                  setCustomAmount(Number(e.target.value))
                                }
                                className="w-24"
                              />
                            </div>
                          )}
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>

                  {/* Add-ons */}
                  {selectedReward && selectedReward !== "custom" && (
                    <>
                      <Separator />
                      <div>
                        <h3 className="mb-4 font-semibold">Add extras (optional)</h3>
                        <div className="space-y-3">
                          {addons.map((addon) => {
                            const qty = selectedAddons[addon.id] || 0;
                            return (
                              <div
                                key={addon.id}
                                className="flex items-center justify-between rounded-lg border p-4"
                              >
                                <div>
                                  <p className="font-medium">{addon.title}</p>
                                  <p className="text-sm text-muted-foreground">
                                    ${addon.amount}
                                    {addon.shippingCost > 0 &&
                                      ` + $${addon.shippingCost} shipping`}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleAddonChange(addon.id, -1)}
                                    disabled={qty === 0}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  <span className="w-8 text-center">{qty}</span>
                                  <Button
                                    variant="outline"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleAddonChange(addon.id, 1)}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => setStep(2)}
                    disabled={!selectedReward}
                  >
                    Continue to shipping
                  </Button>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">Shipping address</h2>
                    <p className="text-sm text-muted-foreground">
                      Where should we deliver your rewards?
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="country">Country</Label>
                      <Select
                        value={shippingCountry}
                        onValueChange={setShippingCountry}
                      >
                        <SelectTrigger>
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
                        value={shippingAddress.phone}
                        onChange={(e) =>
                          setShippingAddress((p) => ({
                            ...p,
                            phone: e.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      size="lg"
                      onClick={() => setStep(3)}
                      disabled={
                        !shippingAddress.name ||
                        !shippingAddress.address1 ||
                        !shippingAddress.city ||
                        !shippingAddress.zip
                      }
                    >
                      Continue to payment
                    </Button>
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-xl font-semibold">Payment</h2>
                    <p className="text-sm text-muted-foreground">
                      Complete your pledge securely
                    </p>
                  </div>

                  {/* Payment Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <CreditCard className="h-5 w-5" />
                        Payment method
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {project.paymentProcessor === "STRIPE" ? (
                        <div className="rounded-lg border bg-muted/50 p-4">
                          <p className="text-sm text-muted-foreground">
                            You'll be redirected to Stripe to complete your payment
                            securely. We accept all major credit and debit cards.
                          </p>
                        </div>
                      ) : (
                        <div className="rounded-lg border bg-muted/50 p-4">
                          <p className="text-sm text-muted-foreground">
                            You'll be redirected to our secure payment processor to
                            complete your payment.
                          </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Important Info */}
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                    <div className="flex gap-3">
                      <Info className="h-5 w-5 flex-shrink-0 text-amber-600" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-800 dark:text-amber-200">
                          How crowdfunding works
                        </p>
                        <p className="mt-1 text-amber-700 dark:text-amber-300">
                          Your card will be charged immediately. If the project
                          doesn't reach its funding goal, you'll receive a full
                          refund. Estimated delivery dates are not guaranteed.
                        </p>
                      </div>
                    </div>
                  </div>

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
                      and understand that I'm supporting a crowdfunding campaign,
                      not purchasing a finished product.
                    </Label>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      size="lg"
                      onClick={handleSubmitPledge}
                      disabled={!agreedToTerms || isProcessing}
                    >
                      {isProcessing ? (
                        "Processing..."
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          Complete pledge - ${total.toFixed(2)}
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-2">
              <Card className="sticky top-24">
                <CardHeader>
                  <CardTitle className="text-base">Order summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">{project.title}</p>
                    <p className="text-xs text-muted-foreground">
                      by {project.creator.name}
                    </p>
                  </div>

                  <Separator />

                  {selectedRewardData && (
                    <div className="flex justify-between text-sm">
                      <span>{selectedRewardData.title}</span>
                      <span>${selectedRewardData.amount}</span>
                    </div>
                  )}

                  {selectedReward === "custom" && customAmount > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>Custom pledge</span>
                      <span>${customAmount}</span>
                    </div>
                  )}

                  {Object.entries(selectedAddons).map(([id, qty]) => {
                    const addon = addons.find((a) => a.id === id);
                    if (!addon || qty === 0) return null;
                    return (
                      <div key={id} className="flex justify-between text-sm">
                        <span>
                          {addon.title} x{qty}
                        </span>
                        <span>${addon.amount * qty}</span>
                      </div>
                    );
                  })}

                  {totalShipping > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Shipping</span>
                      <span>${totalShipping}</span>
                    </div>
                  )}

                  <Separator />

                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>${total.toFixed(2)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          /* Success State */
          <div className="mx-auto max-w-lg py-12 text-center">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
              <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="mb-2 text-2xl font-bold">Thank you for your pledge!</h2>
            <p className="mb-8 text-muted-foreground">
              Your support means the world to {project.creator.name}. You'll
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
        )}
      </div>
    </div>
  );
}
