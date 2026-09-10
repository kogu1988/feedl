"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/custom/empty-state";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/custom/status-badge";
import { WidgetVoteButton } from "@/components/custom/widget-vote-button";
import { WidgetPostForm } from "@/components/custom/widget-post-form";
import { WidgetTriage } from "@/components/custom/widget-triage";
import { PoweredByFeedlMark } from "@/components/custom/powered-by-feedl-mark";
import { SearchIcon, PlusIcon, XIcon, MapPinIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { summarize } from "@/lib/post-format";

// Sprint 64 — widget'ı kompakt + canlı yapan pan (client). Butonlar (Fikir
// ara / Fikir gönder) tıklayınca ilgili alan açar; arama, sıralama ve sayfalama
// /api/widget/posts'a fetch edilir — sayfa yenilenmez, sonuçlar canlı gelir.
// "Farklı bir konu mu · Pro" = WidgetTriage (AI sınıflandırma, Pro özelliği).

type Sort = "votes" | "new";

interface WidgetPost {
  id: string;
  title: string;
  description: string;
  status: string;
  voteCount: number;
  voted: boolean;
}

interface WidgetPanelProps {
  ws?: string | null;
  portalHref: string;
  submissionMode: "anonymous" | "email" | "signup";
  authenticated: boolean;
  canVote: boolean;
  isPro: boolean;
}

export function WidgetPanel({
  ws,
  portalHref,
  submissionMode,
  authenticated,
  canVote,
  isPro,
}: WidgetPanelProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<Sort>("votes");
  const [page, setPage] = useState(1);
  const [posts, setPosts] = useState<WidgetPost[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Faz 2: gömülü mü? SSR'de `window` yok → başlangıçta false, mount sonrası
  // ölçülür. Render sırasında okunsaydı sunucu (false) ile istemci (true)
  // çıktısı farklılaşır ve hydration mismatch oluşurdu.
  const [embedded, setEmbedded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEmbedded(window.parent !== window);
  }, []);

  const wsParam = ws ? `&ws=${encodeURIComponent(ws)}` : "";

  const load = useCallback(
    async (nextPage: number, nextSort: Sort, nextQ: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/widget/posts?q=${encodeURIComponent(nextQ)}&page=${nextPage}&sort=${nextSort}&limit=5${wsParam}`,
          { credentials: "include" },
        );
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error ?? "Fikirler yüklenemedi.");
        }
        setPosts(json.data.posts);
        setTotal(json.data.total);
        setTotalPages(json.data.totalPages);
        setPage(json.data.page ?? nextPage);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fikirler yüklenemedi.");
        setPosts([]);
        setTotal(0);
        setTotalPages(1);
      } finally {
        setLoading(false);
      }
    },
    [wsParam],
  );

  // İlk yükleme + vurgu (sıralama değişince listenin üstüne dön).
  useEffect(() => {
    void load(1, sort, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  function goPage(next: number) {
    if (loading) return;
    setPage(next);
    void load(next, sort, q);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function applySearch() {
    setSearchOpen(false);
    void load(1, sort, q);
  }

  function changeSort(next: Sort) {
    setSort(next);
  }

  // Faz 2: görsel feedback butonu yalnız iframe içinde (host sayfa varken)
  // anlamlı — panelin parent'ına postMessage ile devreder; pin + ekran
  // görüntüsü host script'te (public/widget.js) çalışır (iframe host DOM'una
  // erişemez). Standalone /widget sayfasında (parent yok) gizlenir.
  function startVisualFeedback() {
    // Host script `feedl:visual-start` mesajını feedl origin'i doğrulayarak
    // karşılar; panel kapanır ve pin overlay host sayfada açılır.
    window.parent.postMessage({ type: "feedl:visual-start" }, "*");
  }

  return (
    <div className="w-full">
      {/* Kompakt araç çubuğu: Fikir ara + Fikir gönder + (iframe'de) Görsel. */}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => setSearchOpen((v) => !v)}
          aria-expanded={searchOpen}
        >
          {searchOpen ? <XIcon className="size-3.5" aria-hidden="true" /> : <SearchIcon className="size-3.5" aria-hidden="true" />}
          Fikir ara
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => setFormOpen((v) => !v)}
          aria-expanded={formOpen}
        >
          <PlusIcon className="size-3.5" aria-hidden="true" />
          Fikir gönder
        </Button>
        {/* Faz 2: yalnız gömülü (iframe) bağlamda — host sayfada pin + ekran görüntüsü. */}
        {embedded ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="shrink-0 gap-1.5"
            onClick={startVisualFeedback}
            aria-label="Görsel geri bildirim"
          >
            <MapPinIcon className="size-3.5" aria-hidden="true" />
            Görsel
          </Button>
        ) : null}
      </div>

      {/* Arama alanı (açılır) — canlı değil, uygula değil; Enter/yazınca filtreler. */}
      {searchOpen ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            applySearch();
          }}
          className="mt-2 flex gap-2"
        >
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Fikirlerde ara..."
            aria-label="Fikirlerde ara"
            maxLength={100}
          />
          <Button type="submit" variant="outline" size="sm" className="shrink-0">
            Ara
          </Button>
        </form>
      ) : null}

      {/* Fikir gönder formu — açılır (triage ayrı, her zaman görünür). */}
      {formOpen ? (
        <div className="mt-2">
          <WidgetPostForm submissionMode={submissionMode} ws={ws} authenticated={authenticated} />
        </div>
      ) : null}

      {/* AI sohbet (Pro) / yükseltme çağrısı (free) — her zaman görünür. */}
      <div className="mt-2">
        <WidgetTriage ws={ws} isPro={isPro} />
      </div>

      {/* Sıralama + sonuç sayısı — kompakt satır. */}
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <div className="inline-flex rounded-md border border-input">
          <button
            type="button"
            onClick={() => changeSort("votes")}
            className={cn(
              "rounded-l-md px-2.5 py-1 transition-colors",
              sort === "votes" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            En çok oy
          </button>
          <button
            type="button"
            onClick={() => changeSort("new")}
            className={cn(
              "rounded-r-md px-2.5 py-1 transition-colors",
              sort === "new" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            En yeni
          </button>
        </div>
        <span>
          {total} fikir{q ? ` · "${q}"` : ""}
        </span>
      </div>

      {/* Canlı liste — yükseklik kayması olmasın diye min-height. */}
      <div ref={listRef} className="mt-2 min-h-30">
        {loading ? (
          <p className="py-6 text-center text-xs text-muted-foreground">Yükleniyor…</p>
        ) : error ? (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{error}</p>
        ) : posts.length === 0 ? (
          <EmptyState>
            {q ? `"${q}" ile eşleşen fikir yok.` : "Henüz fikir yok."}
          </EmptyState>
        ) : (
          <ul className="grid gap-2">
            {posts.map((row) => (
              <li key={row.id} className="flex items-start gap-2.5 rounded-lg border p-3">
                <WidgetVoteButton
                  postId={row.id}
                  initialCount={row.voteCount}
                  initialVoted={row.voted}
                  authenticated={canVote}
                  ws={ws}
                />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`${portalHref}/${row.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium leading-snug underline-offset-2 hover:text-primary hover:underline"
                  >
                    {row.title}
                  </Link>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                    {summarize(row.description, 120)}
                  </p>
                  <div className="mt-2">
                    <StatusBadge status={row.status} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Sayfalama — canlı (fetch), refresh yok. */}
      {totalPages > 1 ? (
        <nav className="mt-3 flex items-center justify-between gap-2 text-xs" aria-label="Sayfalama">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page <= 1}
            onClick={() => goPage(page - 1)}
          >
            &larr; Önceki
          </Button>
          <span className="text-muted-foreground">{page} / {totalPages}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading || page >= totalPages}
            onClick={() => goPage(page + 1)}
          >
            Sonraki &rarr;
          </Button>
        </nav>
      ) : null}

      {/* Plan matrisi: free workspace'te feedl rozeti (logoya tıklayınca siteye
          gider); Pro'da gizlenir. Rozet iframe içinde (feedl origin) render
          edildiği için müşteri sayfasından kaldırılamaz. */}
      {!isPro ? (
        <PoweredByFeedlMark className="mt-4 flex items-center justify-center gap-1.5 text-xs text-muted-foreground" />
      ) : null}
    </div>
  );
}
