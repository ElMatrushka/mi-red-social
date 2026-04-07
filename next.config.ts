import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true, // <-- Agrega esto
  },
};

export default nextConfig;
