"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * This page handles Shopify app access from within the Shopify admin iframe.
 *
 * When Shopify loads the app, this page will:
 * 1. If shop parameter exists - redirect to install flow (breaking out of iframe)
 * 2. If no shop parameter - redirect user out of iframe to IndieKit dashboard
 *
 * The App URL in Shopify Partners should be set to:
 * https://yourdomain.com/dashboard/indiekit/shopify/app
 */
function ShopifyAppContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Loading IndieKit...");

  useEffect(() => {
    const shop = searchParams.get("shop");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;

    // Helper function to redirect, breaking out of iframe if needed
    const redirectTo = (url: string) => {
      try {
        // Check if we're in an iframe
        if (window.top !== window.self) {
          // Try to break out of iframe
          window.top!.location.href = url;
        } else {
          window.location.href = url;
        }
      } catch {
        // Cross-origin iframe - use window.open as fallback
        window.open(url, "_top");
      }
    };

    if (shop) {
      // Installation request - redirect to install flow
      setMessage("Starting Shopify installation...");
      const installUrl = `${appUrl}/dashboard/indiekit/shopify/install?shop=${encodeURIComponent(shop)}`;

      // Small delay to show the message
      setTimeout(() => {
        redirectTo(installUrl);
      }, 500);
    } else {
      // App already installed or accessed directly - redirect to IndieKit dashboard
      setMessage("Opening IndieKit fulfillment dashboard...");
      const dashboardUrl = `${appUrl}/dashboard/indiekit`;

      // Small delay to show the message
      setTimeout(() => {
        redirectTo(dashboardUrl);
      }, 500);
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-50 to-white">
      <div className="text-center p-8">
        <div className="mb-6">
          <div className="w-16 h-16 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-2xl font-bold">IK</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">IndieKit</h1>
          <p className="text-sm text-gray-500">Fulfillment Dashboard</p>
        </div>
        <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}

export default function ShopifyAppPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-purple-50 to-white">
          <div className="text-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <ShopifyAppContent />
    </Suspense>
  );
}
