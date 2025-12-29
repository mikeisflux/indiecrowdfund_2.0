import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

// POST: Test R2 connection with provided credentials
export async function POST(request: NextRequest) {
  // Declare outside try block so they're accessible in catch for debugging
  let accountId: string | undefined;
  let accessKeyId: string | undefined;
  let secretAccessKey: string | undefined;
  let bucketName: string | undefined;

  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check if user is admin
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (!user || !["ADMIN", "SUPER_ADMIN"].includes(user.role)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    ({ accountId, accessKeyId, secretAccessKey, bucketName } = body);

    // If masked values are passed, fetch actual values from database
    const isMasked = (val: string | undefined) => val === "••••••••";
    const isEmpty = (val: string | null | undefined) => !val || val === "";

    // Always fetch stored settings if any credential is masked or missing
    if (isMasked(accessKeyId) || isMasked(secretAccessKey) || isEmpty(accessKeyId) || isEmpty(secretAccessKey)) {
      const settings = await db.platformSettings.findUnique({
        where: { id: "default" },
        select: {
          r2AccountId: true,
          r2AccessKeyId: true,
          r2SecretAccessKey: true,
          r2BucketName: true,
        },
      });

      if (!settings?.r2AccessKeyId || !settings?.r2SecretAccessKey) {
        return NextResponse.json(
          { error: "No R2 credentials configured. Please save credentials first." },
          { status: 400 }
        );
      }

      // Use stored values for masked/missing fields, but prefer frontend values if provided
      if (isEmpty(accountId) || isMasked(accountId)) {
        accountId = settings.r2AccountId;
      }
      accessKeyId = settings.r2AccessKeyId;
      secretAccessKey = settings.r2SecretAccessKey;
      if (isEmpty(bucketName)) {
        bucketName = settings.r2BucketName;
      }
    }

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      const missing = [];
      if (!accountId) missing.push("Account ID");
      if (!accessKeyId) missing.push("Access Key ID");
      if (!secretAccessKey) missing.push("Secret Access Key");
      if (!bucketName) missing.push("Bucket Name");
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(", ")}. Please save your settings first.` },
        { status: 400 }
      );
    }

    // Log what we're using (mask sensitive data)
    console.log("[R2 Test] Using credentials:", {
      accountId: accountId,
      accessKeyIdPrefix: accessKeyId.substring(0, 8) + "...",
      secretKeyLength: secretAccessKey.length,
      bucketName: bucketName,
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    });

    // Create S3 client for R2
    const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
    const client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    // Test connection by listing objects
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      MaxKeys: 1,
    });

    await client.send(command);

    return NextResponse.json({
      success: true,
      message: "Connection successful",
    });
  } catch (error) {
    console.error("R2 connection test error:", error);

    let errorMessage = "Connection failed";
    let errorDetails = "";

    if (error instanceof Error) {
      errorDetails = error.message;
      if (error.message.includes("NoSuchBucket")) {
        errorMessage = "Bucket not found - check the bucket name";
      } else if (error.message.includes("AccessDenied")) {
        errorMessage = "Access denied - check bucket permissions";
      } else if (error.message.includes("InvalidAccessKeyId")) {
        errorMessage = "Invalid Access Key ID";
      } else if (error.message.includes("SignatureDoesNotMatch")) {
        errorMessage = "Invalid Secret Access Key";
      } else if (error.message.includes("getaddrinfo") || error.message.includes("ENOTFOUND")) {
        errorMessage = "Invalid Account ID - could not connect to R2 endpoint";
      } else if (error.message.includes("fetch failed") || error.message.includes("ECONNREFUSED")) {
        errorMessage = "Network error - could not reach R2";
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        details: errorDetails,
        success: false,
        debug: {
          accountIdUsed: accountId ? `${accountId.substring(0, 8)}...` : "missing",
          bucketNameUsed: bucketName || "missing",
          endpoint: accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "unknown",
        }
      },
      { status: 400 }
    );
  }
}
