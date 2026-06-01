import type { NextConfig } from "next";

// ``output: "standalone"`` builds a self-contained server for the Docker image,
// but it breaks Vercel's own routing (every route 404s). Vercel sets VERCEL=1
// during its build — skip standalone there and let Vercel manage the output.
const onVercel = !!process.env.VERCEL;

const nextConfig: NextConfig = {
  ...(onVercel ? {} : { output: "standalone" }),
};

export default nextConfig;
