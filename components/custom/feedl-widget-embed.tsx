"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

import {
  ensureFeedlWidget,
  teardownFeedlWidget,
} from "@/lib/widget/embed-client";
import {
  isSelfEmbedSurface,
  type FeedlSelfEmbedConfig,
} from "@/lib/widget/embed";

// Widget'ın CLIENT yaşam döngüsü — (main) layout'ta bir kez render edilir.
//
// Neden layout'ta ve neden yüzeye göre: widget düğümleri `document.body`'de
// React'in dışında yaşar. Sayfa bazında mount edilseydi, `/roadmap` →
// `/changelog` gibi İKİ İZİNLİ yüzey arasındaki geçişte eski örnek sökülüp
// yenisi kurulur, widget (iframe dahil) her gezinmede yeniden yüklenirdi.
// Burada effect yalnız `active` DEĞİŞTİĞİNDE koşar: izinli yüzeyler arasında
// gezinirken widget yerinde kalır, izinli yüzeyden çıkıldığında sökülür.
export function FeedlWidgetEmbed({
  config,
}: {
  config: FeedlSelfEmbedConfig | null;
}) {
  const pathname = usePathname();
  const active = Boolean(config) && isSelfEmbedSurface(pathname);

  useEffect(() => {
    if (!active || !config) return;
    ensureFeedlWidget(config);
    // Yüzeyden çıkıldığında (veya layout unmount) sök: hayalet balon kalmasın.
    return () => teardownFeedlWidget();
  }, [active, config]);

  return null;
}
