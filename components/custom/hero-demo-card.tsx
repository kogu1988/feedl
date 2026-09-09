"use client";

import { useEffect, useState } from "react";
import { ThumbsUpIcon } from "lucide-react";

import { IdeaCard } from "@/components/custom/idea-card";
import { StatusBadge } from "@/components/custom/status-badge";
import { TypeBadge } from "@/components/custom/type-badge";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Landing hero'nun "oy = talep" karakteristik anını taşıyan mock fikir kartı.
// DESIGN.md §8: hareket yalnızca eyleme cevap verir, tek orkestralı an. Burada
// hero-rise stabil olduktan sonra tek bir "yeni oy geldi" pop'u (128 → 129,
// 200ms) — ürünün en özgün dünyası (oyalanan geri bildirim). Görsel kimliği
// değiştirmez (muted thumb + font-mono sayaç); `aria-hidden` decoratiftir,
// `prefers-reduced-motion`'da pop çalışmaz (yalnız statik 129 gösterilir).
export function HeroDemoCard() {
  const [count, setCount] = useState(128);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // hero-rise (~630ms) oturduktan sonra tek oy anı; 250ms'de pop başlar,
    // 200ms scale sonra yerine oturur.
    const start = window.setTimeout(() => {
      setCount(129);
      setPop(true);
    }, 1300);
    const end = window.setTimeout(() => setPop(false), 1500);
    return () => {
      window.clearTimeout(start);
      window.clearTimeout(end);
    };
  }, []);

  return (
    <IdeaCard
      title="Karanlık mod desteği"
      ariaHidden
      badges={
        <>
          <StatusBadge status="shipped" />
          <TypeBadge type="feature" />
          <SentimentBadge sentiment="pozitif" />
        </>
      }
      date="31 Ağustos 2026"
      tags={
        <>
          <Badge className="border-border bg-muted text-muted-foreground">#karanlıkmod</Badge>
          <Badge className="border-border bg-muted text-muted-foreground">#tema</Badge>
        </>
      }
      description="Gözleri çok yoran açık temaya alternatif olarak karanlık mod istiyoruz. Ayarlardan açılıp kapatılabilse iyi olur."
      // Oy anı: muted thumb + font-mono sayaç (DESIGN §3); pop yalnız scale.
      voteAction={
        <span
          className={cn(
            "inline-flex items-center gap-1 text-sm font-medium transition-transform duration-200 ease-out",
            pop ? "scale-110" : "scale-100",
          )}
        >
          <ThumbsUpIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <span className="font-mono tabular-nums">{count}</span>
        </span>
      }
      commentCount={32}
    />
  );
}
