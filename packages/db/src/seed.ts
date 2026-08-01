import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

loadEnv({
  path: fileURLToPath(new URL("../../../.env", import.meta.url)),
  quiet: true,
});

const { prisma } = await import("./index.ts");

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
