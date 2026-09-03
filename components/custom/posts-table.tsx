"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon, TagIcon } from "lucide-react";

import { KeywordChips } from "@/components/custom/keyword-chips";
import { SentimentBadge } from "@/components/custom/sentiment-badge";
import { TypeBadge } from "@/components/custom/type-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  POST_STATUS_OPTIONS,
  StatusSelect,
  statusLabel,
} from "@/components/custom/status-select";

export interface PostsTableRow {
  id: string;
  title: string;
  status: string;
  postType: string | null;
  mergedIntoId: string | null;
  sentimentLabel: string | null;
  aiKeywords: string[] | null;
  createdAtLabel: string;
  voteCount: number;
  customerCount: number;
}

export interface BulkTagOption {
  id: string;
  name: string;
}

// Sprint 22: admin fikir tablosu — satır seçimi + toplu status/etiket
// işlemi. Seçim yalnızca istemci state'i; işlem sonrası router.refresh()
// sunucu verisini tazeler ve seçim temizlenir.
export function PostsTable({
  rows,
  tagOptions,
}: {
  rows: PostsTableRow[];
  tagOptions: BulkTagOption[];
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const toggle = (id: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const allChecked = rows.length > 0 && selected.size === rows.length;
  const toggleAll = (checked: boolean) => {
    setSelected(checked ? new Set(rows.map((row) => row.id)) : new Set());
  };

  const runBulk = async (payload: {
    status?: string;
    addTagId?: string;
  }) => {
    setError(null);
    setIsWorking(true);
    try {
      const res = await fetch("/api/admin/posts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          postIds: [...selected],
          ...(note.trim() ? { note: note.trim() } : {}),
          ...payload,
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Toplu işlem başarısız.");
        return;
      }
      setSelected(new Set());
      setNote("");
      startTransition(() => router.refresh());
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setIsWorking(false);
    }
  };

  const busy = isWorking || isPending;

  return (
    <div className="grid gap-3">
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-primary/30 bg-primary/5 p-2">
          <span className="text-sm font-medium">
            {selected.size} fikir seçili
          </span>
          <Textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Değişim açıklaması (opsiyonel) — yayına alma bildiriminde gösterilir"
            rows={2}
            maxLength={500}
            className="min-h-0 w-56 text-xs sm:w-72"
            disabled={busy}
          />
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" disabled={busy}>
                  {busy ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : null}
                  Durumu değiştir
                </Button>
              }
            />
            <DropdownMenuContent align="start">
              <DropdownMenuRadioGroup
                value=""
                onValueChange={(value) =>
                  void runBulk({ status: value })
                }
              >
                {POST_STATUS_OPTIONS.map((option) => (
                  <DropdownMenuRadioItem key={option.value} value={option.value}>
                    {statusLabel(option.value)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {tagOptions.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" size="sm" disabled={busy}>
                    <TagIcon className="size-4" aria-hidden="true" />
                    Etiket ekle
                  </Button>
                }
              />
              <DropdownMenuContent align="start">
                <DropdownMenuRadioGroup
                  value=""
                  onValueChange={(value) =>
                    void runBulk({ addTagId: value })
                  }
                >
                  {tagOptions.map((tag) => (
                    <DropdownMenuRadioItem key={tag.id} value={tag.id}>
                      #{tag.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelected(new Set())}
            disabled={busy}
          >
            Seçimi temizle
          </Button>
          {error ? <span className="text-xs text-destructive">{error}</span> : null}
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[40px]">
              <Checkbox
                checked={allChecked}
                onCheckedChange={(checked) => toggleAll(checked === true)}
                aria-label="Tümünü seç"
              />
            </TableHead>
            <TableHead className="w-[60px]">Oy</TableHead>
            <TableHead className="w-[80px] text-center">
              Müşteri
            </TableHead>
            <TableHead>Başlık</TableHead>
            <TableHead className="w-[200px]">AI</TableHead>
            <TableHead className="w-[140px]">Tarih</TableHead>
            <TableHead className="w-[170px] text-right">Durum</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((post) => (
            <TableRow key={post.id}>
              <TableCell>
                <Checkbox
                  checked={selected.has(post.id)}
                  onCheckedChange={(checked) =>
                    toggle(post.id, checked === true)
                  }
                  aria-label={`${post.title} seç`}
                />
              </TableCell>
              <TableCell className="font-medium tabular-nums">
                {post.voteCount}
              </TableCell>
              <TableCell className="text-center tabular-nums text-muted-foreground" title="Fikre oy veren şirket sayısı">
                {post.customerCount}
              </TableCell>
              <TableCell>
                <div className="max-w-[320px] truncate font-medium">
                  <a
                    href={`/portal/${post.id}`}
                    className="underline-offset-4 transition-colors hover:text-primary hover:underline"
                  >
                    {post.title}
                  </a>
                </div>
                {post.postType ? (
                  <div className="mt-0.5">
                    <TypeBadge type={post.postType} />
                  </div>
                ) : null}
                {post.mergedIntoId ? (
                  <div className="mt-0.5 inline-flex items-center gap-1 rounded-full border border-amber-600/30 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                    Birleştirildi
                  </div>
                ) : null}
              </TableCell>
              <TableCell>
                {post.sentimentLabel ? (
                  <div className="grid gap-1">
                    <SentimentBadge sentiment={post.sentimentLabel} />
                    {post.aiKeywords && post.aiKeywords.length > 0 ? (
                      <KeywordChips keywords={post.aiKeywords} max={2} />
                    ) : null}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {post.createdAtLabel}
              </TableCell>
              <TableCell className="text-right">
                <StatusSelect postId={post.id} status={post.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
