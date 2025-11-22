import type { NextConfig } from "next"

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
})

const nextConfig: NextConfig = withBundleAnalyzer({
  output: "standalone",
  experimental: {
    optimizePackageImports: ["@phosphor-icons/react"],
    nodeMiddleware: true,
  },
  serverExternalPackages: [
    "shiki",
    "vscode-oniguruma",
    // PDF parsing dependencies - must be externalized for Node.js
    "pdf-parse",
    "canvas",
    "pdfjs-dist",
  ],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "www.google.com",
        port: "",
        pathname: "/s2/favicons/**",
      },
    ],
  },
  eslint: {
    // @todo: remove before going live
    ignoreDuringBuilds: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize pdf-parse and its native dependencies for server-side
      config.externals = config.externals || []
      config.externals.push({
        "pdf-parse": "commonjs pdf-parse",
        canvas: "commonjs canvas",
      })
    }
    return config
  },
})

export default nextConfig
