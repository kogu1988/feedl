import Link from "next/link";
import { MessageSquareIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// Yorum sayısı rozetinin tek görsel kaynağı (plan.md Sprint 13): portal ve
// roadmap kartları aynı dili kullanır. Sayıya iç notlar (is_internal)
// dahil değildir — sorgu tarafında join koşulunda filtrelenir. 0'da hiç
// render edilmez (Canny modeli: sessiz kartlar); tıklanınca detay
// sayfasındaki Yorumlar bölümüne gider.
export function CommentCountBadge({
  postId,
  count,
  className,
}: {
  postId: string;
  count: number;
  className?: string;
}) {
  if (count <= 0) {
    return null;
  }

  return (
    <Link
      href={`/portal/${postId}#yorumlar`}
      aria-label={`${count} yorumu gör`}
      className={cn(
        "inline-flex items-center gap-1 underline-offset-4 transition-colors hover:text-foreground hover:underline",
        className,
      )}
    >
      <MessageSquareIcon className="size-3.5" aria-hidden="true" />
      {count} yorum
    </Link>
  );
}
