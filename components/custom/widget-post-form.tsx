"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  createPostSchema,
  type CreatePostInput,
} from "@/lib/validations/post";

// Widget fikir formu (plan.md Sprint 32): portal kuralları (createPostSchema)
// birebir korunur; gönderim /api/widget/posts'a yapılır ve kimlik widget
// çerezinden çözülür. Form bileşeni registry'den kalktığı için elle
// kompoze edilir (react-hook-form + zod) — bkz. SKILL.md tuzaklar.
export function WidgetPostForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
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
    setSuccess(false);

    try {
      const res = await fetch("/api/widget/posts", {
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
      setSuccess(true);
      router.refresh();
    } catch {
      setFormError("Bağlantı hatası. Lütfen tekrar deneyin.");
    }
  };

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(onSubmit)(event);
      }}
      className="grid gap-3 rounded-lg border bg-muted/30 p-3"
    >
      <p className="text-sm font-medium">Fikir gönder</p>
      <div className="grid gap-1.5">
        <Input
          placeholder="Kısa ve net bir başlık"
          aria-label="Başlık"
          aria-invalid={Boolean(errors.title)}
          {...register("title")}
        />
        {errors.title ? (
          <p className="text-xs text-destructive">{errors.title.message}</p>
        ) : null}
      </div>
      <div className="grid gap-1.5">
        <Textarea
          rows={3}
          placeholder="İhtiyacı ve beklediğin faydayı detaylandır"
          aria-label="Açıklama"
          aria-invalid={Boolean(errors.description)}
          {...register("description")}
        />
        {errors.description ? (
          <p className="text-xs text-destructive">
            {errors.description.message}
          </p>
        ) : null}
      </div>
      {formError ? (
        <p className="text-xs text-destructive" role="alert">
          {formError}
        </p>
      ) : null}
      {success ? (
        <p className="text-xs text-emerald-600 dark:text-emerald-400" role="status">
          Fikrin alındı, teşekkürler!
        </p>
      ) : null}
      <Button type="submit" size="sm" disabled={isSubmitting}>
        {isSubmitting ? "Gönderiliyor..." : "Gönder"}
      </Button>
    </form>
  );
}
