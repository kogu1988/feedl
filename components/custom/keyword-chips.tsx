// AI anahtar kelime rozetleri (plan.md Sprint 11). Uzun listeler taşmasın
// diye ilk `max` kadarı gösterilir, kalan "+n" olarak özetlenir.
export function KeywordChips({
  keywords,
  max = 4,
}: {
  keywords: string[];
  max?: number;
}) {
  if (keywords.length === 0) {
    return null;
  }

  const shown = keywords.slice(0, max);
  const rest = keywords.length - shown.length;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((keyword, index) => (
        <span
          key={`${keyword}-${index}`}
          className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground"
        >
          {keyword}
        </span>
      ))}
      {rest > 0 ? (
        <span className="text-xs text-muted-foreground">+{rest}</span>
      ) : null}
    </div>
  );
}
