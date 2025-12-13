import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Find incomplete pledges (checkout not confirmed)
  const incompletePledges = await db.pledge.findMany({
    where: {
      confirmationEmailSent: false,
    },
    select: {
      id: true,
      amount: true,
      status: true,
      stripePaymentMethodId: true,
      createdAt: true,
      project: { select: { title: true, id: true } },
      user: { select: { email: true } },
    },
  });

  console.log("\n=== Incomplete Pledges ===\n");

  if (incompletePledges.length === 0) {
    console.log("No incomplete pledges found.");
    return;
  }

  for (const pledge of incompletePledges) {
    console.log(`ID: ${pledge.id}`);
    console.log(`  Amount: $${pledge.amount}`);
    console.log(`  Status: ${pledge.status}`);
    console.log(`  Payment Method: ${pledge.stripePaymentMethodId ? "Saved" : "Not saved"}`);
    console.log(`  Project: ${pledge.project.title}`);
    console.log(`  User: ${pledge.user.email}`);
    console.log(`  Created: ${pledge.createdAt}`);
    console.log("");
  }

  // To delete, uncomment these lines:
  // const result = await db.pledge.deleteMany({
  //   where: {
  //     confirmationEmailSent: false,
  //   },
  // });
  // console.log(`Deleted ${result.count} incomplete pledges`);

  await db.$disconnect();
}

main().catch(console.error);
