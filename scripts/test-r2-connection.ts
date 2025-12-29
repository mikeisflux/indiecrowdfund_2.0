/**
 * CLI script to test R2 connection directly
 *
 * Prerequisites:
 *   npx prisma generate  (if not already done)
 *
 * Run with:
 *   npx tsx scripts/test-r2-connection.ts
 *
 * This bypasses the API and tests the connection directly to help debug issues.
 * It will show your server's outgoing IP address, which must match the IP
 * configured in your Cloudflare R2 API token's IP filtering settings.
 */

import { S3Client, ListObjectsV2Command, HeadBucketCommand } from "@aws-sdk/client-s3";
import { PrismaClient } from "@prisma/client";

async function testR2Connection() {
  console.log("🔧 R2 Connection Test Script\n");

  // Get server's public IP to verify IP filtering
  console.log("1. Checking server's public IP...");
  try {
    const ipResponse = await fetch("https://api.ipify.org?format=json");
    const ipData = await ipResponse.json();
    console.log(`   Server outgoing IP: ${ipData.ip}`);
    console.log("   ⚠️  Make sure this IP is allowed in your Cloudflare R2 API token settings!\n");
  } catch (err) {
    console.log("   Could not determine public IP\n");
  }

  // Load credentials from database
  console.log("2. Loading credentials from database...");
  const prisma = new PrismaClient();

  try {
    const settings = await prisma.platformSettings.findUnique({
      where: { id: "default" },
      select: {
        r2AccountId: true,
        r2AccessKeyId: true,
        r2SecretAccessKey: true,
        r2BucketName: true,
      },
    });

    if (!settings) {
      console.log("   ❌ No platform settings found");
      process.exit(1);
    }

    const { r2AccountId, r2AccessKeyId, r2SecretAccessKey, r2BucketName } = settings;

    console.log(`   Account ID: ${r2AccountId ? r2AccountId.substring(0, 8) + "..." : "NOT SET"}`);
    console.log(`   Access Key ID: ${r2AccessKeyId ? r2AccessKeyId.substring(0, 8) + "..." : "NOT SET"}`);
    console.log(`   Secret Key: ${r2SecretAccessKey ? "***SET***" : "NOT SET"}`);
    console.log(`   Bucket Name: ${r2BucketName || "NOT SET"}\n`);

    if (!r2AccountId || !r2AccessKeyId || !r2SecretAccessKey || !r2BucketName) {
      console.log("   ❌ Missing required R2 credentials");
      process.exit(1);
    }

    // Create S3 client
    const endpoint = `https://${r2AccountId}.r2.cloudflarestorage.com`;
    console.log(`3. Connecting to R2 endpoint: ${endpoint}\n`);

    const client = new S3Client({
      region: "auto",
      endpoint,
      credentials: {
        accessKeyId: r2AccessKeyId,
        secretAccessKey: r2SecretAccessKey,
      },
    });

    // Test 1: HeadBucket (checks bucket exists and we have access)
    console.log("4. Testing HeadBucket (verify bucket access)...");
    try {
      await client.send(new HeadBucketCommand({ Bucket: r2BucketName }));
      console.log("   ✅ HeadBucket succeeded - bucket exists and accessible\n");
    } catch (err) {
      const error = err as Error & { Code?: string; $metadata?: { httpStatusCode?: number } };
      console.log(`   ❌ HeadBucket failed:`);
      console.log(`      Code: ${error.Code || error.name}`);
      console.log(`      HTTP Status: ${error.$metadata?.httpStatusCode || "unknown"}`);
      console.log(`      Message: ${error.message}\n`);

      if (error.Code === "AccessDenied" || error.message?.includes("AccessDenied")) {
        console.log("   💡 ACCESS DENIED troubleshooting:");
        console.log("      - Verify the Access Key ID is correct");
        console.log("      - Verify the Secret Access Key is correct");
        console.log("      - Check IP filtering on your Cloudflare API token");
        console.log("      - Ensure bucket is in the token's scope");
        console.log("      - Wait 1-2 minutes if token was recently created/modified\n");
      }

      process.exit(1);
    }

    // Test 2: ListObjectsV2 (checks read permissions)
    console.log("5. Testing ListObjectsV2 (verify read permissions)...");
    try {
      const result = await client.send(new ListObjectsV2Command({
        Bucket: r2BucketName,
        MaxKeys: 5,
      }));
      console.log(`   ✅ ListObjectsV2 succeeded`);
      console.log(`      Objects found: ${result.Contents?.length || 0}`);
      if (result.Contents && result.Contents.length > 0) {
        console.log(`      First object: ${result.Contents[0].Key}`);
      }
      console.log("");
    } catch (err) {
      const error = err as Error & { Code?: string; $metadata?: { httpStatusCode?: number } };
      console.log(`   ❌ ListObjectsV2 failed:`);
      console.log(`      Code: ${error.Code || error.name}`);
      console.log(`      Message: ${error.message}\n`);
      process.exit(1);
    }

    console.log("🎉 All R2 connection tests passed!");

  } catch (err) {
    console.error("❌ Unexpected error:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testR2Connection();
