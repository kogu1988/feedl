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

// Sprint 63z — widget fikir formu. Workspace gönderim moduna göre davranır:
//   anonymous → oturum GEREKMEZ; fikir doğrudan POST /api/widget/posts?a=ws
//   email     → oturum yoksa önce e-posta al, POST /api/widget/session/email
//                ile çerez kur, sonra fikri gönder (üye olmadan).
//   signup    → oturum yoksa "giriş yap" yönlendirmesi (mevcut davranış).
type SubmissionMode = "anonymous" | "email" | "signup";

export function WidgetPostForm({
  submissionMode,
  ws,
  authenticated,
}: {
  submissionMode: SubmissionMode;
  ws?: string | null;
  authenticated: boolean;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");
  const router = useRouter();

  const wsParam = ws ? `?ws=${encodeURIComponent(ws)}` : "";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreatePostInput>({
    resolver: zodResolver(createPostSchema),
    defaultValues: { title: "", description: "" },
  });

  // Email modunda oturum yoksa: önce e-posta doğrula + çerez kur (üye olmadan).
  async function ensureEmailSession(): Promise<string | null> {
    if (authenticated || submissionMode !== "email") return null;
    if (!email.trim()) {
      setFormError("Fikir göndermek için e-postanı girmelisin.");
      return null;
    }
    try {
      const res = await fetch(`/api/widget/session/email${wsParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), workspace: ws ?? undefined }),
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setFormError(json.error ?? "E-posta doğrulanamadı.");
        return null;
      }
      return json.data?.email ?? email.trim();
    } catch {
      setFormError("Bağlantı hatası. Lütfen tekrar deneyin.");
      return null;
    }
  }

  const onSubmit = async (values: CreatePostInput) => {
    setFormError(null);
    setSuccess(false);

    if (submissionMode === "signup" && !authenticated) {
      setFormError("Fikir göndermek için giriş yapmalısın.");
      return;
    }

    const emailDone = await ensureEmailSession();
    if (submissionMode === "email" && !authenticated && !emailDone) return;

    try {
      const res = await fetch(`/api/widget/posts${wsParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
        credentials: "include",
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
      {submissionMode === "email" && !authenticated ? (
        <div className="grid gap-1.5">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-posta adresin"
            aria-label="E-posta adresin"
            maxLength={254}
          />
          <p className="text-xs text-muted-foreground">
            Üye olmadan fikir verebilirsin — sadece e-posta girmen yeterli.
          </p>
        </div>
      ) : null}
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
