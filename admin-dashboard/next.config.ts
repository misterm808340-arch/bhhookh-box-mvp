import type { NextConfig } from "next";

/**
 * BHHOOKH BOX Admin Dashboard — Next.js config.
 *
 * Deploying to Firebase Hosting as a static site? Build with:
 *   NEXT_STATIC_EXPORT=1 npm run build     (macOS / Linux / Git Bash)
 * The build is then emitted to ./out — see README.md → "Deploy the admin dashboard".
 */
const nextConfig: NextConfig = {
  output: process.env.NEXT_STATIC_EXPORT === "1" ? "export" : "standalone",
  images: { unoptimized: true },
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
