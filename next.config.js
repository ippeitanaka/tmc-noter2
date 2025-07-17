/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ["blob.v0.dev"],
    unoptimized: false,
  },
  webpack: (config, { isServer }) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      os: false,
    }

    if (!isServer) {
      config.output.globalObject = "self"
    }

    return config
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  serverExternalPackages: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  // ファイルアップロード用の設定
  experimental: {
    serverComponentsExternalPackages: ["@ffmpeg/ffmpeg", "@ffmpeg/util"],
  },
}

module.exports = nextConfig
