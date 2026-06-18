// Client-side observability hook.
// Sentry is only initialised when an explicit DSN is provided via
// NEXT_PUBLIC_SENTRY_DSN. By default this is a no-op so the app runs cleanly
// without external error-reporting dependencies (and without CSP/network noise).
import * as Sentry from "@sentry/nextjs";

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    integrations: [Sentry.replayIntegration()],
    tracesSampleRate: 1,
    enableLogs: true,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    sendDefaultPii: true,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
