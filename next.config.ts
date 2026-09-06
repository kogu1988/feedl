import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // Changelog 2026-09-05'te /portal altından üst seviyeye taşındı
      // (/changelog) — canlıdaki eski URL'ler geçici redirect ile korunur.
      { source: "/portal/changelog", destination: "/changelog", permanent: false },
      {
        source: "/portal/changelog/:id",
        destination: "/changelog/:id",
        permanent: false,
      },
    ];
  },
};

// Sprint 63w (B1) — Sentry Next.js SDK. `silent: true`, `authToken` yoksa CI
// source-map upload atlanır (build'i kırmaz). DSN runtime'da env'den okunur.
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
  sourcemaps: { disable: true },
});
