import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Keep Node-only deps (e.g. `ws` from Convex) out of the Workers server bundle.
  serverExternalPackages: ["ws", "bufferutil", "utf-8-validate"],
};

export default nextConfig;

initOpenNextCloudflareForDev();
