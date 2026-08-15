import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// Local dev only: read the repo-root .env. In production the platform supplies
// the environment, and this call finds no file and does nothing.
loadEnv({
  path: fileURLToPath(new URL("../../.env", import.meta.url)),
  quiet: true,
});

const nextConfig: NextConfig = {
  // @mou7asib/db, @mou7asib/ui and @mou7asib/accounting ship TypeScript/TSX source
  // directly (Prisma 7 generates .ts; the other two have no build step of their own), so
  // Next must compile them rather than expect prebuilt JS.
  transpilePackages: ["@mou7asib/db", "@mou7asib/ui", "@mou7asib/accounting"],
  typedRoutes: true,
  experimental: { useTypeScriptCli: true },
};

export default nextConfig;
