const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  // 1. What homepage shows
  const pledgeStats = await db.pledge.aggregate({
    where: { status: "COMPLETED", deletedAt: null, user: { deletedAt: null, lockedAt: null } },
    _sum: { amount: true },
  });
  console.log("=== HOMEPAGE totalPledged ===");
  console.log("Value:", Number(pledgeStats._sum.amount || 0));
  console.log("");

  // 2. All projects with amounts
  console.log("=== PROJECTS ===");
  const projects = await db.project.findMany({
    where: { status: { in: ["LIVE", "FUNDED", "FAILED"] }, deletedAt: null },
    select: { id: true, title: true, status: true, currentAmount: true, backerCount: true, goalAmount: true },
    orderBy: { currentAmount: "desc" },
  });
  let projectTotal = 0;
  for (const p of projects) {
    const raised = Number(p.currentAmount);
    projectTotal += raised;
    console.log(p.title, "|", p.status, "| raised:", raised, "| goal:", Number(p.goalAmount), "| backers:", p.backerCount);
  }
  console.log("Sum of project currentAmounts:", projectTotal);
  console.log("");

  // 3. Discrepancy check
  console.log("=== DISCREPANCY CHECK ===");
  for (const pr of projects) {
    const agg = await db.pledge.aggregate({
      where: { projectId: pr.id, status: "COMPLETED", deletedAt: null },
      _sum: { amount: true },
      _count: true,
    });
    const actual = Number(agg._sum.amount || 0);
    const says = Number(pr.currentAmount);
    console.log(pr.title, "|", pr.status, "| project says:", says, "| pledges sum:", actual, "| diff:", says - actual, "| pledges:", agg._count);
  }
  console.log("");

  // 4. Excluded pledges from locked/deleted users
  console.log("=== EXCLUDED PLEDGES (deleted/locked users) ===");
  const excluded = await db.pledge.findMany({
    where: { status: "COMPLETED", deletedAt: null, user: { OR: [{ deletedAt: { not: null } }, { lockedAt: { not: null } }] } },
    select: { amount: true, project: { select: { title: true } } },
  });
  if (excluded.length === 0) {
    console.log("No excluded pledges from deleted/locked users");
  } else {
    excluded.forEach(function(p) { console.log(p.project.title, "|", Number(p.amount)); });
  }

  await db.$disconnect();
}

main().catch(function(e) { console.error(e); process.exit(1); });
