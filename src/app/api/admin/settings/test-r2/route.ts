import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

// POST: Test R2 connection with provided credentials
export async function POST(request: NextRequest) {
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
    const { accountId, accessKeyId, secretAccessKey, bucketName } = body;

    if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

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
    if (error instanceof Error) {
      if (error.message.includes("NoSuchBucket")) {
        errorMessage = "Bucket not found";
      } else if (error.message.includes("AccessDenied") || error.message.includes("InvalidAccessKeyId")) {
        errorMessage = "Invalid credentials";
      } else if (error.message.includes("SignatureDoesNotMatch")) {
        errorMessage = "Invalid secret access key";
      }
    }

    return NextResponse.json(
      { error: errorMessage, success: false },
      { status: 400 }
    );
  }
}
