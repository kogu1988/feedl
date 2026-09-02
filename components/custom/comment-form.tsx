"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  createCommentSchema,
  type CreateCommentInput,
} from "@/lib/validations/comment";

// Post detay sayfasındaki yorum formu (plan.md Sprint 10). shadcn form
// bileşeni registry'den kalktığı için elle kompoze edilir (new-post-dialog
// ile aynı desen). Admin olmayanlara "İç not" kutusu hiç gösterilmez.
// Sprint 24: parentId verilirse kompakt "yanıt" moduna geçer.
export function CommentForm({
  postId,
  isAdmin,
  parentId,
  onCancel,
}: {
  postId: string;
  isAdmin: boolean;
  parentId?: string;
  onCancel?: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateCommentInput>({
    resolver: zodResolver(createCommentSchema),
    defaultValues: { body: "", isInternal: false, parentId },
  });

  const isInternal = watch("isInternal");
  const isReply = Boolean(parentId);

  const onSubmit = async (values: CreateCommentInput) => {
    setFormError(null);

    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok || !json.success) {
        setFormError(json.error ?? "Yorum kaydedilemedi. Lütfen tekrar deneyin.");
        return;
      }

      reset({ body: "", isInternal: false, parentId });
      onCancel?.();
      router.refresh();
    } catch {
      setFormError("Bağlantı hatası. Lütfen tekrar deneyin.");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={isReply ? "grid gap-2" : "grid gap-3"}
    >
      <Textarea
        rows={isReply ? 2 : 3}
        placeholder={isReply ? "Yanıtını yaz..." : "Düşünceni yaz..."}
        aria-label="Yorum"
        aria-invalid={Boolean(errors.body)}
        {...register("body")}
      />
      {errors.body ? (
        <p className="text-sm text-destructive">{errors.body.message}</p>
      ) : null}

      {isAdmin ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id="comment-internal"
            checked={isInternal}
            onCheckedChange={(checked) => setValue("isInternal", checked === true)}
          />
          <label
            htmlFor="comment-internal"
            className="text-sm font-normal text-muted-foreground"
          >
            İç not olarak kaydet (müşteriye görünmez)
          </label>
        </div>
      ) : null}

      {formError ? (
        <p className="text-sm text-destructive" role="alert">
          {formError}
        </p>
      ) : null}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={isSubmitting} size={isReply ? "sm" : "default"}>
          {isSubmitting ? "Gönderiliyor..." : isReply ? "Yanıtla" : "Yorum Yap"}
        </Button>
        {isReply && onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            İptal
          </Button>
        ) : null}
      </div>
    </form>
  );
}
