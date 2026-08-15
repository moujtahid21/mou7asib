import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const { prisma } = await import("./index.ts");
const { REFERENCE_ACCOUNT_SEEDS } = await import("./referenceAccounts.ts");
const { TVA_RATE_SEEDS } = await import("./tvaRates.ts");

// Seed data must be idempotent (CLAUDE.md §9). Running this twice leaves the
// database in the same state as running it once.
async function main(): Promise<void> {
  await prisma.tenant.upsert({
    where: { id: "01930000-0000-7000-8000-000000000001" },
    update: {},
    create: {
      id: "01930000-0000-7000-8000-000000000001",
      name: "Tenant de démonstration",
    },
  });

  // Class headers before leaves — leaves' parentCode FK requires the header to already
  // exist, and REFERENCE_ACCOUNT_SEEDS is ordered that way. Sequential, not
  // Promise.all, for the same reason.
  for (const account of REFERENCE_ACCOUNT_SEEDS) {
    await prisma.referenceAccount.upsert({
      where: { code: account.code },
      update: {
        label: account.label,
        labelAr: account.labelAr,
        classDigit: account.classDigit,
        parentCode: account.parentCode,
      },
      create: account,
    });
  }

  for (const rate of TVA_RATE_SEEDS) {
    await prisma.tvaRate.upsert({
      where: { rateCode_effectiveFrom: { rateCode: rate.rateCode, effectiveFrom: new Date(rate.effectiveFrom) } },
      update: { label: rate.label, rate: rate.rate, legalSourceNote: rate.legalSourceNote, isPlaceholder: true },
      create: {
        rateCode: rate.rateCode,
        label: rate.label,
        rate: rate.rate,
        effectiveFrom: new Date(rate.effectiveFrom),
        legalSourceNote: rate.legalSourceNote,
        isPlaceholder: true,
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });
