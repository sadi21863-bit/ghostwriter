/** @type {import('next').NextConfig} */
module.exports = {
  // Prevent @neondatabase/serverless from being bundled
  // Requires DATABASE_URL at build time — set in Vercel + use copy .env.local .env locally
  serverExternalPackages: ['@neondatabase/serverless'],
};
