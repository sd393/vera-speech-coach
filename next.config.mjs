/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    '@ffmpeg-installer/ffmpeg',
    'fluent-ffmpeg',
    'pdf-parse',
    'pdfjs-dist',
  ],
}

export default nextConfig
