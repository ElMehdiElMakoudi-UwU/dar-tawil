import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Emits .next/standalone with its own minimal server — the container copies
  // that instead of node_modules, which keeps the image small.
  output: "standalone",
  poweredByHeader: false,
  // Kept as real node_modules in the standalone output (not bundled), so the
  // container's migration script can import the driver too.
  serverExternalPackages: ["postgres"],
  // The dev-only "N" badge defaults to bottom-left, on top of the back-office
  // user box at the foot of the sidebar.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
