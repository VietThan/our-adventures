import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for the rsync-based deploy workflow.
  // Produces .next/standalone/ (self-contained Node.js server),
  // .next/static/, and public/ — all three are rsynced to EC2.
  output: 'standalone',
};

export default nextConfig;
