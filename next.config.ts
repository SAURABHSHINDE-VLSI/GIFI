import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {};

initOpenNextCloudflareForDev({ configPath: "./wrangler.jsonc" });

export default nextConfig;
