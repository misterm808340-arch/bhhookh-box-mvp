import type { NextConfig } from "next";

/**
 * BHHOOKH BOX Admin Dashboard — Next.js config.
 *
 * Deploying to Firebase Hosting as a static site? Build with:
 *   NEXT_STATIC_EXPORT=1 npm run build     (macOS / Linux / Git Bash)
 * The build is then emitted to ./out — see README.md → "Deploy the admin dashboard".
 *
 * Deploying to GitHub Pages (project site)? Build with the basePath too:
 *   NEXT_STATIC_EXPORT=1 NEXT_BASE_PATH=/bhhookh-box-admin npm run build
 */
const nextConfig: NextConfig = {
  output: process.env.NEXT_STATIC_EXPORT === "1" ? "export" : "standalone",
  basePath: process.env.NEXT_BASE_PATH || undefined,
  images: { unoptimized: true },
  reactStrictMode: false,
};

export default nextConfig;
