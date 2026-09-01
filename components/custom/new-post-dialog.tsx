"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { statusLabels } from "@/lib/post-format";
import {
  createPostSchema,
  type CreatePostInput,
} from "@/lib/validations/post";

interface SimilarPost {
  id: string;
  title: string;
  status: string;
  voteCount: number;
}

const SUGGESTION_MIN_LENGTH = 3;
const SUGGESTION_DEBOUNCE_MS = 400;

// shadcn form bileşeni registry'den kalktığı için form elle kompoze edilir
// (react-hook-form + zod); bkz. .agents/skills/feedl/SKILL.md tuzaklar.
export function NewPostDialog() {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [similarPosts, setSimilarPosts] = useState<SimilarPost[]>([]);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { title: "", description: "" },
  });

  const title = watch("title");
  const abortRef = useRef<AbortController | null>(null);

  // plan.md Sprint 8: başlık yazarken canlı benzer fikir önerisi — duplicate
  // önleme UX'i (Canny modeli). Arama çok kelimeli ve diakritik duyarsız
  // (lib/post-search); embedding tabanlı tam duplicate tespiti arka planda
  // AI autopilot'ta yapılır.
  useEffect(() => {
    const trimmed = title.trim();
    if (!open || trimmed.length < SUGGESTION_MIN_LENGTH) {
      setSimilarPosts([]);
      return;
    }

    const timer = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      fetch(`/api/posts?q=${encodeURIComponent(trimmed)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((json: { success?: boolean; data?: SimilarPost[] }) => {
          if (json.success && Array.isArray(json.data)) {
            setSimilarPosts(json.data.slice(0, 5));
          }
        })
        .catch(() => {
          // Öneri almak başarısız olsa form akışı etkilenmez.
        });
    }, SUGGESTION_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [title, open]);

  const onSubmit = async (values: CreatePostInput) => {
    setFormError(null);

    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !json.success) {
        setFormError(
          json.error ?? "Fikir kaydedilemedi. Lütfen tekrar deneyin.",
        );
        return;
      }

      reset();
      setOpen(false);
      router.refresh();
    } catch {
      setFormError("Bağlantı hatası. Lütfen tekrar deneyin.");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setFormError(null);
        }
      }}
    >
      <DialogTrigger render={<Button />}>Yeni Fikir Gönder</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Yeni Fikir Gönder</DialogTitle>
          <DialogDescription>
            Ürünü nasıl geliştirebileceğimizi anlat; ekibin göreceği ilk yer
            burası.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="post-title" className="text-sm font-medium">
              Başlık
            </label>
            <Input
              id="post-title"
              placeholder="Kısa ve net bir başlık"
              aria-invalid={Boolean(errors.title)}
              {...register("title")}
            />
            {errors.title ? (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            ) : null}
          </div>

          {similarPosts.length > 0 ? (
            <div
              className="grid gap-2 rounded-md border border-border bg-muted/40 p-3"
              role="status"
            >
              <p className="text-xs font-medium text-muted-foreground">
                Benziyor olabilecek fikirler var — önce onlara oy vermek
                isteyebilirsin:
              </p>
              <ul className="grid gap-1.5">
                {similarPosts.map((post) => (
                  <li key={post.id} className="flex items-center gap-2 text-sm">
                    <span className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground">
                      {statusLabels[post.status] ?? post.status}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{post.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {post.voteCount} oy
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="grid gap-2">
            <label htmlFor="post-description" className="text-sm font-medium">
              Açıklama
            </label>
            <Textarea
              id="post-description"
              rows={5}
              placeholder="İhtiyacı ve beklediğin faydayı detaylandır"
              aria-invalid={Boolean(errors.description)}
              {...register("description")}
            />
            {errors.description ? (
              <p className="text-sm text-destructive">
                {errors.description.message}
              </p>
            ) : null}
          </div>

          {formError ? (
            <p className="text-sm text-destructive" role="alert">
              {formError}
            </p>
          ) : null}

          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Gönderiliyor..." : "Fikri Gönder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
