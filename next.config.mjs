/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['sharp', 'onnxruntime-node'],
  },
  // Vercelのボディサイズ制限を明示的に設定
  serverRuntimeConfig: {
    maxBodySize: '10mb',
  },
}

export default nextConfig
