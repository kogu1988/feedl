import Link from "next/link";

// Sprint 21: tıklanabilir etiket rozetleri — portalda ?tag= filtresine
// gider. AI keyword'lerinin normalize edilmiş formal hali (tags tablosu);
// etiketi olmayan (eski) fikirlerde KeywordChips fallback'i kullanılır.
export function TagChips({
  tags,
  max = 4,
  basePath = "/portal",
}: {
  tags: string[];
  max?: number;
  basePath?: string;
}) {
  if (tags.length === 0) {
    return null;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {tags.slice(0, max).map((tag) => (
        <Link
          key={tag}
          href={`${basePath}?tag=${encodeURIComponent(tag)}`}
          scroll={false}
          className="inline-flex items-center rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          #{tag}
        </Link>
      ))}
    </span>
  );
}
