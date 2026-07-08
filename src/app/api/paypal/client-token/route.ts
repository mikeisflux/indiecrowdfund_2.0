import { NextResponse } from "next/server";
import { getPayPalConfig, getPayPalAccessToken } from "@/lib/payments/paypal";

export const dynamic = "force-dynamic";

// GET - Generate a client token for PayPal Advanced Card Fields
export async function GET() {
  try {
    const config = await getPayPalConfig();
    const accessToken = await getPayPalAccessToken();

    const res = await fetch(`${config.baseUrl}/v1/identity/generate-token`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "Accept-Language": "en_US",
      },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to generate client token: ${err}`);
    }

    const data = await res.json();
    return NextResponse.json({ clientToken: data.client_token });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate client token" },
      { status: 500 }
    );
  }
}
