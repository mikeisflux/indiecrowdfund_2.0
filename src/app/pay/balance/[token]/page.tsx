"use client";

import { apiFetch } from "@/lib/fetch-utils";
import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import { StripePaymentForm } from "@/app/projects/[vanityname]/[slug]/pledge/components/StripePaymentForm";
import { getCSRFHeaders } from "@/lib/csrf";
import {
  DollarSign,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShoppingCart,
  Package,
} from "lucide-react";

interface BalanceDetails {
  pledgeId: string;
  projectTitle: string;
  projectSlug: string;
  backerName: string;
  paymentProcessor: "STRIPE" | "DIVINITYCOIN";
  balanceDue: number;
  reward: { title: string; amount: number } | null;
  addons: Array<{ title: string; quantity: number; amount: number }>;
  shippingAmount: number;
  originalAmount: number;
}

export default function BalancePaymentPage() {
  const params = useParams();
  const token = params?.token as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [details, setDetails] = useState<BalanceDetails | null>(null);
  const [paymentStarted, setPaymentStarted] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null);
  const [dcStripePromise, setDcStripePromise] = useState<Promise<Stripe | null> | null>(null);

  const fetchDetails = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/pay/balance?token=${token}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to load payment details");
        return;
      }
      const data = await res.json();
      setDetails(data);
    } catch {
      setError("Failed to load payment details");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchDetails();
    }
  }, [token, fetchDetails]);

  // Fetch Stripe publishable key
  useEffect(() => {
    if (details?.paymentProcessor === "STRIPE" && !stripePromise) {
      fetch("/api/stripe/config")
        .then(res => res.json())
        .then(data => {
          if (data.publishableKey) {
            setStripePromise(loadStripe(data.publishableKey));
          }
        })
        .catch(() => {
          // Fall back to env var
          const key = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
          if (key) {
            setStripePromise(loadStripe(key));
          }
        });
    }
  }, [details?.paymentProcessor, stripePromise]);

  const handleStartPayment = async () => {
    if (!details) return;
    setPaymentStarted(true);
    setError(null);

    try {
      const res = await apiFetch("/api/pay/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to start payment");
        setPaymentStarted(false);
        return;
      }

      const data = await res.json();
      setClientSecret(data.clientSecret);

      // For DivinityCoin, load the DC Stripe instance using the publishable key from the API
      if (data.paymentProcessor === "DIVINITYCOIN" && data.publishableKey && !dcStripePromise) {
        setDcStripePromise(loadStripe(data.publishableKey));
      }
    } catch {
      setError("Failed to start payment");
      setPaymentStarted(false);
    }
  };

  const handlePaymentSuccess = async () => {
    try {
      // Confirm the balance payment on our backend
      await apiFetch("/api/pay/balance/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ token }),
      });
      setPaymentSuccess(true);
    } catch {
      // Payment went through with Stripe but our confirm failed
      // This is OK - webhook will handle it
      setPaymentSuccess(true);
    }
  };

  const handlePaymentError = (message: string) => {
    setError(message);
    setIsProcessing(false);
  };

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-teal-600 mb-4" />
          <p className="text-muted-foreground">Loading payment details...</p>
        </div>
      </div>
    );
  }

  if (error && !details) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Payment Link Error</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (paymentSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold mb-2">Payment Successful!</h2>
            <p className="text-muted-foreground mb-4">
              Your balance of {formatCurrency(details?.balanceDue || 0)} for <strong>{details?.projectTitle}</strong> has been paid.
            </p>
            <p className="text-sm text-muted-foreground">
              You can close this page. A confirmation will be sent to your email.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!details) return null;

  // Determine which Stripe instance to use based on payment processor
  const activeStripePromise = details.paymentProcessor === "DIVINITYCOIN" ? dcStripePromise : stripePromise;

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold">{details.projectTitle}</h1>
          <p className="text-muted-foreground mt-1">Balance Payment</p>
        </div>

        {/* Order Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShoppingCart className="h-5 w-5 text-teal-600" />
              Order Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Hi {details.backerName}, your order has been updated. Here&apos;s a summary:
            </p>

            <div className="space-y-2 text-sm">
              {details.reward && (
                <div className="flex justify-between items-center py-2 border-b">
                  <div className="flex items-center gap-2">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <span>{details.reward.title}</span>
                  </div>
                  <span>{formatCurrency(details.reward.amount)}</span>
                </div>
              )}

              {details.addons.map((addon, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b">
                  <div>
                    <span>{addon.title}</span>
                    {addon.quantity > 1 && (
                      <Badge variant="secondary" className="ml-2 text-xs">x{addon.quantity}</Badge>
                    )}
                  </div>
                  <span>{formatCurrency(addon.amount * addon.quantity)}</span>
                </div>
              ))}

              {details.shippingAmount > 0 && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span>Shipping</span>
                  <span>{formatCurrency(details.shippingAmount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center py-2 text-muted-foreground">
                <span>Previously Paid</span>
                <span>-{formatCurrency(details.originalAmount)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Balance Due */}
        <Card className="border-teal-300 bg-teal-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-teal-600" />
                <span className="font-medium text-lg">Balance Due</span>
              </div>
              <span className="text-2xl font-bold text-teal-600">
                {formatCurrency(details.balanceDue)}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Payment Section */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        )}

        {!paymentStarted && (
          <Button
            className="w-full bg-teal-600 hover:bg-teal-700 h-12 text-lg"
            onClick={handleStartPayment}
          >
            <DollarSign className="h-5 w-5 mr-2" />
            Pay {formatCurrency(details.balanceDue)}
          </Button>
        )}

        {paymentStarted && clientSecret && activeStripePromise && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Payment Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Elements
                key={clientSecret}
                stripe={activeStripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: "stripe",
                    variables: {
                      colorPrimary: "#0d9488",
                      fontFamily: "system-ui, -apple-system, sans-serif",
                      borderRadius: "8px",
                      spacingUnit: "5px",
                    },
                    rules: {
                      ".Tab": {
                        borderRadius: "8px",
                        boxShadow: "none",
                      },
                      ".Tab--selected": {
                        borderColor: "#0d9488",
                        boxShadow: "0 0 0 1.5px #0d9488",
                      },
                      ".Input": {
                        borderRadius: "8px",
                        boxShadow: "none",
                        padding: "10px 12px",
                      },
                      ".Input:focus": {
                        borderColor: "#0d9488",
                        boxShadow: "0 0 0 1.5px #0d9488",
                      },
                      ".Label": {
                        fontWeight: "500",
                        fontSize: "14px",
                        marginBottom: "6px",
                      },
                    },
                  },
                }}
              >
                <StripePaymentForm
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  isProcessing={isProcessing}
                  setIsProcessing={setIsProcessing}
                  total={details.balanceDue}
                  intentType="payment_intent"
                  buttonLabel={`Pay ${formatCurrency(details.balanceDue)}`}
                  returnUrl={`${window.location.origin}/pay/balance/${token}?success=true`}
                />
              </Elements>
            </CardContent>
          </Card>
        )}

        {paymentStarted && !clientSecret && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-teal-600 mb-4" />
            <p className="text-muted-foreground">Setting up payment...</p>
          </div>
        )}

        {paymentStarted && clientSecret && !activeStripePromise && (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-teal-600 mb-4" />
            <p className="text-muted-foreground">Loading payment form...</p>
          </div>
        )}

        {/* Security Note */}
        <p className="text-center text-xs text-muted-foreground">
          Payments are processed securely. Your payment details are never stored on our servers.
        </p>
      </div>
    </div>
  );
}
