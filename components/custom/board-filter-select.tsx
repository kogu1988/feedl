"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";

// Sprint 48d: dashboard board filtresi. Server component'te event handler
// ("onChange") geçilemediği için bu ufak client bileşen filtreyi yönetir;
// diğer filtreler (status/tag/per) korunur. router.replace ile URL değişir.

export interface BoardFilterItem {
  id: string;
  name: string;
  slug: string;
  visibility: "public" | "private";
}

export function BoardFilterSelect({
  boards,
  boardSlug,
}: {
  boards: BoardFilterItem[];
  boardSlug: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function select(next: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (next) params.set("board", next);
    else params.delete("board");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <select
      value={boardSlug}
      onChange={(e) => select(e.target.value)}
      aria-label="Board filtresi"
      className="h-9 max-w-[240px] rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <option value="">Tüm Board&apos;lar</option>
      {boards.map((board) => (
        <option key={board.id} value={board.slug}>
          {board.name}
        </option>
      ))}
    </select>
  );
}
