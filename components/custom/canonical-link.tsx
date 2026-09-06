"use client";

import { useEffect } from "react";

// Sprint 63q (rev.) — kanonik URL, REDIRECT'SİZ. Bir workspace'in custom domain'i
// varsa ve ziyaretçi o domain'e DEĞİL de (örn. acme.feedl.app subdomain'ine)
// geliyorsa, `<link rel="canonical">` öğesini document.head'e ekleriz. Bu,
// SEO'ya doğru kanonik adresi söyler; kullanıcıyı yönlendirmez (redirect yok).
// Path korunur (search params atılır — sort/tag varyasyonları duplicate olmasın).
// Custom domain host'unda ziyaretçi zaten kanonik adrestedir → eklenmez.
export function CanonicalLink({ customDomain }: { customDomain: string | null }) {
  useEffect(() => {
    if (!customDomain) return;

    try {
      const { location } = window;
      const currentHost = location.host.toLowerCase();
      const canonicalHost = customDomain.replace(/^https?:\/\//, "").replace(/[/\s]+$/, "").toLowerCase();

      // Ziyaretçi zaten kanonik host'taysa ekleme (mükerrer link istenmez).
      if (currentHost === canonicalHost) return;

      const canonicalUrl = `https://${canonicalHost}${location.pathname}`;

      // Varsa eski canonical link'i kaldır (tek kaynak).
      document.querySelectorAll('link[rel="canonical"]').forEach((el) => el.remove());
      const link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      link.setAttribute("href", canonicalUrl);
      document.head.appendChild(link);
    } catch {
      // Head manipülasyonu başarısızsa sessiz geç — SEO niceliktir, kırıcı değil.
    }
  }, [customDomain]);

  return null;
}
