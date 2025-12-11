import { NextResponse } from "next/server";
import { db } from "@/lib/db";

interface HealthCheck {
  name: string;
  status: "healthy" | "degraded" | "unhealthy";
  responseTime?: number;
  error?: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  uptime: number;
  timestamp: string;
  checks: HealthCheck[];
  metrics: {
    database: {
      totalUsers: number;
      totalProjects: number;
      totalPledges: number;
    };
  };
}

// Simple health check endpoint for maintenance page and admin dashboard
export async function GET() {
  const startTime = Date.now();
  const checks: HealthCheck[] = [];
  let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

  // Check database connectivity
  const dbCheck = await checkDatabase();
  checks.push(dbCheck);
  if (dbCheck.status === "unhealthy") {
    overallStatus = "unhealthy";
  } else if (dbCheck.status === "degraded") {
    overallStatus = "degraded";
  }

  // Get database metrics if healthy
  let metrics = {
    database: {
      totalUsers: 0,
      totalProjects: 0,
      totalPledges: 0,
    },
  };

  if (dbCheck.status !== "unhealthy") {
    try {
      const [userCount, projectCount, pledgeCount] = await Promise.all([
        db.user.count(),
        db.project.count(),
        db.pledge.count(),
      ]);
      metrics = {
        database: {
          totalUsers: userCount,
          totalProjects: projectCount,
          totalPledges: pledgeCount,
        },
      };
    } catch {
      // Metrics are non-critical, continue
    }
  }

  // Check external services (non-blocking)
  const stripeCheck = checkStripeConfig();
  checks.push(stripeCheck);

  const emailCheck = checkEmailConfig();
  checks.push(emailCheck);

  const storageCheck = checkStorageConfig();
  checks.push(storageCheck);

  // Downgrade to degraded if any non-critical service is unhealthy
  const nonCriticalUnhealthy = checks
    .filter((c) => c.name !== "database")
    .some((c) => c.status === "unhealthy");
  if (nonCriticalUnhealthy && overallStatus === "healthy") {
    overallStatus = "degraded";
  }

  const response: HealthResponse = {
    status: overallStatus,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
    metrics,
  };

  const statusCode = overallStatus === "unhealthy" ? 503 : 200;

  return NextResponse.json(response, { status: statusCode });
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    // Simple query to check database connectivity
    await db.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;

    // Consider degraded if response time > 1000ms
    if (responseTime > 1000) {
      return {
        name: "database",
        status: "degraded",
        responseTime,
      };
    }

    return {
      name: "database",
      status: "healthy",
      responseTime,
    };
  } catch (error) {
    return {
      name: "database",
      status: "unhealthy",
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

function checkStripeConfig(): HealthCheck {
  const hasSecretKey = !!process.env.STRIPE_SECRET_KEY;
  const hasPublishableKey = !!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  const hasWebhookSecret = !!process.env.STRIPE_WEBHOOK_SECRET;

  if (hasSecretKey && hasPublishableKey && hasWebhookSecret) {
    return { name: "stripe", status: "healthy" };
  } else if (hasSecretKey && hasPublishableKey) {
    return {
      name: "stripe",
      status: "degraded",
      error: "Webhook secret not configured",
    };
  } else {
    return {
      name: "stripe",
      status: "unhealthy",
      error: "Stripe keys not configured",
    };
  }
}

function checkEmailConfig(): HealthCheck {
  const hasSendGridKey = !!process.env.SENDGRID_API_KEY;
  const hasFromEmail = !!process.env.SENDGRID_FROM_EMAIL;

  if (hasSendGridKey && hasFromEmail) {
    return { name: "email", status: "healthy" };
  } else if (hasSendGridKey) {
    return {
      name: "email",
      status: "degraded",
      error: "From email not configured",
    };
  } else {
    return {
      name: "email",
      status: "unhealthy",
      error: "SendGrid not configured",
    };
  }
}

function checkStorageConfig(): HealthCheck {
  const hasAccessKey = !!process.env.S3_ACCESS_KEY_ID;
  const hasSecretKey = !!process.env.S3_SECRET_ACCESS_KEY;
  const hasBucket = !!process.env.S3_BUCKET_NAME;
  const hasEndpoint = !!process.env.S3_ENDPOINT;

  if (hasAccessKey && hasSecretKey && hasBucket && hasEndpoint) {
    return { name: "storage", status: "healthy" };
  } else if (hasAccessKey && hasSecretKey) {
    return {
      name: "storage",
      status: "degraded",
      error: "Bucket or endpoint not configured",
    };
  } else {
    return {
      name: "storage",
      status: "unhealthy",
      error: "S3 storage not configured",
    };
  }
}
