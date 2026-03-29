/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Skip heavy mediapipe packages from webpack processing — loaded from CDN at runtime
  experimental: {
    optimizePackageImports: ['framer-motion', 'lucide-react'],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    return config
  },
}

export default nextConfig;
