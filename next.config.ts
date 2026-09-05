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

export default nextConfig;
