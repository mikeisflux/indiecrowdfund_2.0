/**
 * Shufti Pro ID Verification Integration
 * Documentation: https://api.shuftipro.com/
 */

import { db } from "@/lib/db";

export interface ShuftiConfig {
  clientId: string;
  secretKey: string;
  callbackUrl?: string;
  redirectUrl?: string;
  mode: "sandbox" | "production";
}

export interface ShuftiVerificationRequest {
  reference: string;
  callback_url?: string;
  redirect_url?: string;
  country?: string;
  language?: string;
  email?: string;
  verification_mode: "any" | "image_only" | "video_only";
  document?: {
    supported_types: string[];
    name?: {
      first_name?: string;
      last_name?: string;
    };
    dob?: string;
    age?: {
      min?: number;
      max?: number;
    };
  };
  face?: {
    proof?: string;
    allow_offline?: boolean;
    allow_online?: boolean;
  };
  address?: {
    supported_types: string[];
    name?: {
      first_name?: string;
      last_name?: string;
    };
  };
}

export interface ShuftiResponse {
  reference: string;
  event: string;
  error?: {
    service: string;
    key: string;
    message: string;
  };
  verification_url?: string;
  verification_result?: {
    document?: {
      name?: {
        first_name?: number;
        last_name?: number;
      };
      dob?: number;
      document_number?: number;
      expiry_date?: number;
      issue_date?: number;
      selected_type?: string[];
      supported_types?: string[];
    };
    face?: number;
    address?: {
      name?: number;
      full_address?: number;
    };
  };
  verification_data?: {
    document?: {
      name?: {
        first_name?: string;
        last_name?: string;
      };
      dob?: string;
      document_number?: string;
      expiry_date?: string;
      issue_date?: string;
      country?: string;
      selected_type?: string;
    };
    face?: {
      proof?: string;
    };
  };
  declined_reason?: string;
  decline_codes?: string[];
}

const SHUFTI_API_URL = "https://api.shuftipro.com";
const SHUFTI_SANDBOX_URL = "https://api.shuftipro.com";

export class ShuftiService {
  private config: ShuftiConfig;
  private baseUrl: string;

  constructor(config: ShuftiConfig) {
    this.config = config;
    this.baseUrl = config.mode === "sandbox" ? SHUFTI_SANDBOX_URL : SHUFTI_API_URL;
  }

  private getAuthHeader(): string {
    const credentials = Buffer.from(`${this.config.clientId}:${this.config.secretKey}`).toString("base64");
    return `Basic ${credentials}`;
  }

  /**
   * Create a new verification request
   */
  async createVerification(
    userId: string,
    userEmail: string,
    userName?: string,
    returnUrl?: string
  ): Promise<{ success: boolean; verificationUrl?: string; reference?: string; error?: string }> {
    const reference = `VERIFY_${userId}_${Date.now()}`;

    // Build redirect URL with returnUrl parameter if provided
    let redirectUrl = this.config.redirectUrl;
    if (redirectUrl && returnUrl) {
      const url = new URL(redirectUrl);
      // URLSearchParams.set() automatically encodes the value
      url.searchParams.set("returnUrl", returnUrl);
      redirectUrl = url.toString();
    }

    const requestBody: ShuftiVerificationRequest = {
      reference,
      callback_url: this.config.callbackUrl,
      redirect_url: redirectUrl,
      email: userEmail,
      verification_mode: "any",
      document: {
        supported_types: [
          "id_card",
          "passport",
          "driving_license",
        ],
        name: userName ? {
          first_name: userName.split(" ")[0],
          last_name: userName.split(" ").slice(1).join(" ") || "",
        } : undefined,
        age: {
          min: 18,
        },
      },
      face: {
        allow_offline: true,
        allow_online: true,
      },
    };

    try {
      const response = await fetch(`${this.baseUrl}/`, {
        method: "POST",
        headers: {
          "Authorization": this.getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data: ShuftiResponse = await response.json();

      if (data.error) {
        return {
          success: false,
          error: data.error.message || "Verification request failed",
        };
      }

      // Store verification record in database
      await db.iDVerification.create({
        data: {
          userId,
          shuftiReference: reference,
          verificationUrl: data.verification_url,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        },
      });

      return {
        success: true,
        verificationUrl: data.verification_url,
        reference,
      };
    } catch (error) {
      console.error("Shufti verification error:", error);
      return {
        success: false,
        error: "Failed to create verification request",
      };
    }
  }

  /**
   * Get verification status
   */
  async getStatus(reference: string): Promise<{ success: boolean; status?: string; data?: ShuftiResponse; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/status`, {
        method: "POST",
        headers: {
          "Authorization": this.getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reference }),
      });

      const data: ShuftiResponse = await response.json();

      return {
        success: true,
        status: data.event,
        data,
      };
    } catch (error) {
      console.error("Shufti status check error:", error);
      return {
        success: false,
        error: "Failed to check verification status",
      };
    }
  }

  /**
   * Process webhook callback from Shufti
   */
  async processCallback(data: ShuftiResponse): Promise<{ success: boolean; userId?: string; verified?: boolean }> {
    const { reference, event } = data;

    if (!reference) {
      return { success: false };
    }

    // Find the verification record
    const verification = await db.iDVerification.findUnique({
      where: { shuftiReference: reference },
      include: { user: true },
    });

    if (!verification) {
      console.error("Verification record not found for reference:", reference);
      return { success: false };
    }

    // Parse the event to determine verification status
    let status: "VERIFIED" | "DECLINED" | "PENDING" | "PROCESSING" | "CANCELLED" = "PENDING";
    let isVerified = false;

    switch (event) {
      case "verification.accepted":
        status = "VERIFIED";
        isVerified = true;
        break;
      case "verification.declined":
        status = "DECLINED";
        break;
      case "verification.status.changed":
      case "request.pending":
        status = "PROCESSING";
        break;
      case "request.timeout":
      case "verification.cancelled":
        status = "CANCELLED";
        break;
      default:
        status = "PENDING";
    }

    // Extract age from verification data if available
    let detectedAge: number | undefined;
    if (data.verification_data?.document?.dob) {
      const dob = new Date(data.verification_data.document.dob);
      const today = new Date();
      detectedAge = Math.floor((today.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    }

    // Update verification record
    await db.iDVerification.update({
      where: { id: verification.id },
      data: {
        status,
        isDocumentValid: data.verification_result?.document?.document_number === 1,
        isFaceMatch: data.verification_result?.face === 1,
        isAgeVerified: detectedAge ? detectedAge >= 18 : undefined,
        detectedAge,
        documentType: data.verification_data?.document?.selected_type,
        documentCountry: data.verification_data?.document?.country,
        declineReason: data.declined_reason,
        declineCodes: data.decline_codes || [],
        rawResponse: data as object,
        completedAt: isVerified || status === "DECLINED" ? new Date() : undefined,
      },
    });

    // If verified, update user record
    if (isVerified) {
      await db.user.update({
        where: { id: verification.userId },
        data: {
          idVerified: true,
          idVerifiedAt: new Date(),
          idVerificationId: reference,
          dateOfBirth: data.verification_data?.document?.dob
            ? new Date(data.verification_data.document.dob)
            : undefined,
        },
      });
    }

    return {
      success: true,
      userId: verification.userId,
      verified: isVerified,
    };
  }

  /**
   * Delete/cancel a verification request
   */
  async deleteVerification(reference: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/delete`, {
        method: "POST",
        headers: {
          "Authorization": this.getAuthHeader(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reference }),
      });

      const data = await response.json();

      if (data.error) {
        return { success: false, error: data.error.message };
      }

      // Update database record
      await db.iDVerification.updateMany({
        where: { shuftiReference: reference },
        data: { status: "CANCELLED" },
      });

      return { success: true };
    } catch (error) {
      console.error("Shufti delete error:", error);
      return { success: false, error: "Failed to delete verification" };
    }
  }
}

/**
 * Get Shufti service instance with settings from database
 */
export async function getShuftiService(): Promise<ShuftiService | null> {
  const settings = await db.platformSettings.findUnique({
    where: { id: "default" },
    select: {
      idVerificationEnabled: true,
      shuftiClientId: true,
      shuftiSecretKey: true,
      shuftiCallbackUrl: true,
      shuftiRedirectUrl: true,
      idVerificationMode: true,
    },
  });

  if (!settings?.idVerificationEnabled || !settings.shuftiClientId || !settings.shuftiSecretKey) {
    return null;
  }

  return new ShuftiService({
    clientId: settings.shuftiClientId,
    secretKey: settings.shuftiSecretKey,
    callbackUrl: settings.shuftiCallbackUrl || undefined,
    redirectUrl: settings.shuftiRedirectUrl || undefined,
    mode: (settings.idVerificationMode as "sandbox" | "production") || "production",
  });
}

/**
 * Check if a user needs ID verification to view a project
 */
export async function requiresIdVerification(
  projectId: string,
  userId?: string
): Promise<{ required: boolean; verified: boolean; reason?: string }> {
  // Get project content flags
  const project = await db.project.findUnique({
    where: { id: projectId },
    select: {
      hasAdultContent: true,
      hasRiskyContent: true,
    },
  });

  if (!project) {
    return { required: false, verified: false };
  }

  // Check if project requires verification
  if (!project.hasAdultContent && !project.hasRiskyContent) {
    return { required: false, verified: false };
  }

  const reason = project.hasAdultContent
    ? "This project contains adult content"
    : "This project contains age-restricted content";

  // If no user, verification is required
  if (!userId) {
    return { required: true, verified: false, reason };
  }

  // Check if user is verified
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { idVerified: true },
  });

  return {
    required: true,
    verified: user?.idVerified || false,
    reason,
  };
}
