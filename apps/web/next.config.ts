import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import type { NextConfig } from "next";

// Local dev only: read the repo-root .env. In production the platform supplies
// the environment, and this call finds no file and does nothing.
loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

const nextConfig: NextConfig = {
  // @mou7asib/db ships TypeScript source (Prisma 7 generates .ts), so Next
  // must compile it rather than expect prebuilt JS.
  transpilePackages: ["@mou7asib/db"],
  typedRoutes: true,
  experimental: { useTypeScriptCli: true },
};

export default nextConfig;
