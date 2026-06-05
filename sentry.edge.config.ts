import * as Sentry from '@sentry/nextjs';

const DSN = 'https://657bbe6491f97ef3b4cbe982db36d737@o4511512591794176.ingest.us.sentry.io/4511512610471936';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.05 : 1.0,
  enabled: process.env.NODE_ENV === 'production',
  enableLogs: true,
});
