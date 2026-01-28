import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  console.log("\n=== Invalid Email Cleanup for Comic Shops ===\n");

  // Find all comic shops with emails that don't contain "@" (invalid emails)
  const invalidEmailShops = await db.comicShop.findMany({
    where: {
      email: {
        not: null,
      },
      NOT: {
        email: {
          contains: "@",
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  console.log(`Found ${invalidEmailShops.length} shops with invalid emails (missing @)\n`);

  if (invalidEmailShops.length === 0) {
    console.log("No invalid emails to clean up.");
    await db.$disconnect();
    return;
  }

  // Show sample of invalid emails
  console.log("Sample of invalid emails being removed:");
  invalidEmailShops.slice(0, 20).forEach((shop) => {
    console.log(`  - "${shop.email}" (${shop.name})`);
  });
  if (invalidEmailShops.length > 20) {
    console.log(`  ... and ${invalidEmailShops.length - 20} more\n`);
  }

  // Update all invalid emails to null
  const result = await db.comicShop.updateMany({
    where: {
      email: {
        not: null,
      },
      NOT: {
        email: {
          contains: "@",
        },
      },
    },
    data: {
      email: null,
    },
  });

  console.log(`\n✅ Cleaned up ${result.count} invalid emails (set to null)`);

  await db.$disconnect();
}

main().catch(console.error);
