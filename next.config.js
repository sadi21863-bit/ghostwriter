const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent @neondatabase/serverless from being bundled
  // Requires DATABASE_URL at build time — set in Vercel + use copy .env.local .env locally
  serverExternalPackages: ['@neondatabase/serverless'],
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
              "connect-src 'self' https://api.anthropic.com https://cloud.higgsfield.ai https://api.resend.com https://cdn.growthbook.io https://*.ingest.sentry.io https://*.ingest.us.sentry.io https://api.razorpay.com https://checkout.razorpay.com https://lumberjack.razorpay.com https://cdn.razorpay.com wss: wss://api.sardine.ai",
              "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com",
              "media-src 'self' blob:",
              "frame-ancestors 'none'",
            ].join('; '),
          },
        ],
      },
    ];
  },
};

const analyzedConfig = withBundleAnalyzer(nextConfig);

try {
  const { withSentryConfig } = require('@sentry/nextjs');
  module.exports = withSentryConfig(analyzedConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  }, {
    widenClientFileUpload: true,
    hideSourceMaps: true,
  });
} catch {
  module.exports = analyzedConfig;
}
