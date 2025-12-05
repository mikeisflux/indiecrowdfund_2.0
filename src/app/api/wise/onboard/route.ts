import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { initiateCreatorOnboarding } from "@/lib/payments/wise";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session?.userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { profileType = "personal" } = body;

    const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/payment/wise/callback`;

    const result = await initiateCreatorOnboarding({
      userId: session.userId,
      email: session.email || "",
      profileType,
      returnUrl,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Wise onboarding error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Onboarding failed" },
      { status: 500 }
    );
  }
}
