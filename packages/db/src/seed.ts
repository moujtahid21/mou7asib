import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

const { prisma } = await import("./index.ts");

// Seed data must be idempotent (CLAUDE.md §9). Running this twice leaves the
// database in the same state as running it once.
async function main(): Promise<void> {
  const tenant = await prisma.tenant.upsert({
    where: { id: "01930000-0000-7000-8000-000000000001" },
    update: {},
    create: {
      id: "01930000-0000-7000-8000-000000000001",
      name: "Tenant de démonstration",
    },
  });

  await prisma.stackCheck.upsert({
    where: { id: "01930000-0000-7000-8000-000000000002" },
    update: {},
    create: {
      id: "01930000-0000-7000-8000-000000000002",
      tenantId: tenant.id,
      label: "Contrôle de pile D0",
      // A value with four decimal places and a fractional part that a float
      // cannot represent exactly — the point of the D0 round-trip check.
      amount: "1234.5678",
    },
  });

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
