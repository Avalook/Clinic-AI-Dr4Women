import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for a minimal Docker runtime image.
  output: "standalone",
};

export default nextConfig;
