const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent @neondatabase/serverless from being bundled
  // Requires DATABASE_URL at build time — set in Vercel + use copy .env.local .env locally
  serverExternalPackages: ['@neondatabase/serverless'],
  // ffmpeg-static's binary must be explicitly declared or Vercel's default file
  // tracing fails to find it at runtime in the serverless bundle (confirmed via
  // vercel-labs/ffmpeg-on-vercel and github.com/vercel/next.js#53791) — it works
  // locally without this, which is why the bug stays hidden until deployed.
  outputFileTracingIncludes: {
    "/api/projects/[projectId]/production/scenes/[sceneNumber]/generate-video/status":
      ["./node_modules/ffmpeg-static/ffmpeg"],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://checkout.razorpay.com https://cdn.razorpay.com",
              "worker-src 'self' blob:",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "style-src-elem 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://fonts.gstatic.com https://checkout-static-next.razorpay.com",
              "connect-src 'self' https://api.anthropic.com https://cloud.higgsfield.ai https://api.resend.com https://cdn.growthbook.io https://api.razorpay.com https://checkout.razorpay.com https://lumberjack.razorpay.com https://cdn.razorpay.com wss: wss://api.sardine.ai",
              "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
              // https: needed for <video> playback of Segmind/Vercel Blob URLs
              // (production shot/scene videos) — matches img-src's existing
              // broad https: allowance for the same class of provider URLs.
              "media-src 'self' blob: https:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

module.exports = withBundleAnalyzer(nextConfig);
