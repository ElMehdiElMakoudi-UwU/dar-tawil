import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with its own minimal server — the container copies
  // that instead of node_modules, which keeps the image small.
  output: "standalone",
  poweredByHeader: false,
};

export default nextConfig;
