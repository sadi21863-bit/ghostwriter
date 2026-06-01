/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent @neondatabase/serverless from being bundled
  // Requires DATABASE_URL at build time — set in Vercel + use copy .env.local .env locally
  serverExternalPackages: ['@neondatabase/serverless'],
};

// Only wrap with Sentry if NEXT_PUBLIC_SENTRY_DSN is configured
const hasSentry = !!process.env.NEXT_PUBLIC_SENTRY_DSN;

if (hasSentry) {
  try {
    const { withSentryConfig } = require('@sentry/nextjs');
    module.exports = withSentryConfig(nextConfig, {
      silent: true,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
    }, {
      widenClientFileUpload: true,
      hideSourceMaps: true,
    });
  } catch {
    module.exports = nextConfig;
  }
} else {
  module.exports = nextConfig;
}
