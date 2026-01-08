"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

/**
 * This page handles Shopify app access from within the Shopify admin iframe.
 * It displays a simple message and redirects users to the IndieKit dashboard.
 *
 * The App URL in Shopify Partners should be set to:
 * https://indiecrowdfund.com/dashboard/indiekit/shopify/app
 *
 * IMPORTANT: If you don't want this embedded, uncheck "Embed app in Shopify admin"
 * in Shopify Partners dashboard.
 */
function ShopifyAppContent() {
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Loading IndieKit...");
  const [showManualLink, setShowManualLink] = useState(false);

  useEffect(() => {
    const shop = searchParams?.get("shop");
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com";

    // Show manual link after a delay in case redirect doesn't work
    const linkTimer = setTimeout(() => {
      setShowManualLink(true);
    }, 2000);

    // Helper function to redirect
    const redirectTo = (url: string) => {
      try {
        // Try to redirect the top window (break out of iframe)
        if (window.top && window.top !== window.self) {
          window.top.location.href = url;
        } else {
          window.location.href = url;
        }
      } catch {
        // Cross-origin iframe - can't access top, show manual link
        setShowManualLink(true);
      }
    };

    if (shop) {
      // Installation request - redirect to install flow
      setMessage("Starting Shopify installation...");
      const installUrl = `${appUrl}/dashboard/indiekit/shopify/install?shop=${encodeURIComponent(shop)}`;
      setTimeout(() => redirectTo(installUrl), 500);
    } else {
      // App accessed - redirect to IndieKit dashboard
      setMessage("Opening IndieKit fulfillment dashboard...");
      const dashboardUrl = `${appUrl}/dashboard/indiekit`;
      setTimeout(() => redirectTo(dashboardUrl), 500);
    }

    return () => clearTimeout(linkTimer);
  }, [searchParams]);

  const dashboardUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://indiecrowdfund.com") + "/dashboard/indiekit";

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "#faf5ff",
      fontFamily: "system-ui, -apple-system, sans-serif"
    }}>
      <div style={{ textAlign: "center", padding: "32px" }}>
        <div style={{
          width: "64px",
          height: "64px",
          backgroundColor: "#9333ea",
          borderRadius: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px"
        }}>
          <span style={{ color: "white", fontSize: "24px", fontWeight: "bold" }}>IK</span>
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: "bold", color: "#111827", marginBottom: "8px" }}>
          IndieKit
        </h1>
        <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "24px" }}>
          Fulfillment Dashboard
        </p>

        {/* Simple CSS spinner */}
        <div style={{
          width: "32px",
          height: "32px",
          border: "3px solid #e9d5ff",
          borderTopColor: "#9333ea",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
          margin: "0 auto 16px"
        }} />

        <p style={{ color: "#4b5563" }}>{message}</p>

        {showManualLink && (
          <div style={{ marginTop: "24px" }}>
            <p style={{ fontSize: "14px", color: "#6b7280", marginBottom: "12px" }}>
              If you&apos;re not redirected automatically:
            </p>
            <a
              href={dashboardUrl}
              target="_top"
              style={{
                display: "inline-block",
                padding: "12px 24px",
                backgroundColor: "#9333ea",
                color: "white",
                borderRadius: "8px",
                textDecoration: "none",
                fontWeight: "500"
              }}
            >
              Open IndieKit Dashboard
            </a>
          </div>
        )}

        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  );
}

export default function ShopifyAppPage() {
  return (
    <Suspense
      fallback={
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#faf5ff"
        }}>
          <p style={{ color: "#4b5563" }}>Loading...</p>
        </div>
      }
    >
      <ShopifyAppContent />
    </Suspense>
  );
}
