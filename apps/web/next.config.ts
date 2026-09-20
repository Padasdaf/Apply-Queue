import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, "../../.env"), quiet: true });

const nextConfig: NextConfig = {
  transpilePackages: ["@applyqueue/shared"],
};

export default nextConfig;
