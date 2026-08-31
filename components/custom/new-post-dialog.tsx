"use client";

import { useState } from "react";
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
import {
  createPostSchema,
  type CreatePostInput,
} from "@/lib/validations/post";

// shadcn form bileşeni registry'den kalktığı için form elle kompoze edilir
// (react-hook-form + zod); bkz. .agents/skills/feedl/SKILL.md tuzaklar.
export function NewPostDialog() {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { title: "", description: "" },
  });

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
