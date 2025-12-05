import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { completeCreatorOnboarding } from "@/lib/payments/wise";

// Force dynamic rendering for OAuth callback
export const dynamic = "force-dynamic";

// Handle OAuth callback from Wise
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state"); // userId
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment?error=${error}`
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment?error=missing_params`
      );
    }

    // Exchange code for access token
    const tokenResponse = await fetch(
      `${process.env.WISE_ENVIRONMENT === "production"
        ? "https://api.wise.com"
        : "https://api.sandbox.transferwise.tech"}/oauth/token`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: process.env.WISE_CLIENT_ID || "",
          client_secret: process.env.WISE_CLIENT_SECRET || "",
          code,
          redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/wise/callback`,
        }),
      }
    );

    if (!tokenResponse.ok) {
      console.error("Token exchange failed:", await tokenResponse.text());
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment?error=token_exchange_failed`
      );
    }

    const tokenData = await tokenResponse.json();

    // Get user's Wise profile using their access token
    const profilesResponse = await fetch(
      `${process.env.WISE_ENVIRONMENT === "production"
        ? "https://api.wise.com"
        : "https://api.sandbox.transferwise.tech"}/v1/profiles`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    if (!profilesResponse.ok) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment?error=profile_fetch_failed`
      );
    }

    const profiles = await profilesResponse.json();
    const profile = profiles[0]; // Get first profile

    if (!profile) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment?error=no_profile`
      );
    }

    // Get or create recipient account for payouts
    const recipientsResponse = await fetch(
      `${process.env.WISE_ENVIRONMENT === "production"
        ? "https://api.wise.com"
        : "https://api.sandbox.transferwise.tech"}/v1/accounts?profile=${profile.id}`,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      }
    );

    const recipients = await recipientsResponse.json();
    const recipient = recipients[0]; // Use first recipient if exists

    // Complete onboarding
    await completeCreatorOnboarding(
      state, // userId
      profile.id.toString(),
      recipient?.id?.toString() || ""
    );

    // Store additional details
    await db.wiseConfig.update({
      where: { userId: state },
      data: {
        profileType: profile.type,
        bankAccountLast4: recipient?.details?.accountNumber?.slice(-4),
        bankCurrency: recipient?.currency || "USD",
      },
    });

    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment?success=true`
    );
  } catch (error) {
    console.error("Wise callback error:", error);
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment?error=callback_failed`
    );
  }
}
