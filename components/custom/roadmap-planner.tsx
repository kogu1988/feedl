"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2Icon } from "lucide-react";

import { StatusBadge } from "@/components/custom/status-badge";
import { EmptyState } from "@/components/custom/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface PlannerRow {
  id: string;
  title: string;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  targetDate: string | null; // YYYY-AA-GG
  impact: number | null;
  effort: number | null;
}

export interface AdminOption {
  id: string;
  name: string;
}

const SCALE = [1, 2, 3];

// Sprint 28: iç roadmap planlayıcı — planned/in-progress fikirlerine owner,
// hedef tarih ve impact/effort atanır; skor (impact/effort) UI'da hesaplanır.
// Her alan değişiminde tek PATCH /api/admin/posts isteği atılır.
export function RoadmapPlanner({
  rows,
  admins,
}: {
  rows: PlannerRow[];
  admins: AdminOption[];
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const patch = async (
    postId: string,
    payload: Record<string, string | number | null>,
  ) => {
    setError(null);
    setBusyId(postId);
    try {
      const res = await fetch("/api/admin/posts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId, ...payload }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setError(json.error ?? "Güncellenemedi.");
        return;
      }
      router.refresh();
    } catch {
      setError("Bağlantı hatası.");
    } finally {
      setBusyId(null);
    }
  };

  const score = (row: PlannerRow): string => {
    if (!row.impact || !row.effort) return "—";
    return (row.impact / row.effort).toFixed(2);
  };

  if (rows.length === 0) {
    return (
      <EmptyState>
        Planlanan veya geliştirilen fikir yok — durumlarını güncelleyince
        burada görünür.
      </EmptyState>
    );
  }

  return (
    <div className="grid gap-2">
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fikir</TableHead>
            <TableHead className="w-[140px]">Sahip</TableHead>
            <TableHead className="w-[150px]">Hedef tarih</TableHead>
            <TableHead className="w-[100px]">Etki</TableHead>
            <TableHead className="w-[100px]">Efor</TableHead>
            <TableHead className="w-[70px] text-right">Skor</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                <a
                  href={`/portal/${row.id}`}
                  className="line-clamp-1 max-w-[280px] font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
                >
                  {row.title}
                </a>
                <div className="mt-0.5">
                  <StatusBadge status={row.status} />
                </div>
              </TableCell>
              <TableCell>
                <select
                  value={row.ownerId ?? ""}
                  onChange={(event) =>
                    void patch(row.id, {
                      ownerId: event.target.value || null,
                    })
                  }
                  disabled={busyId === row.id}
                  className="h-8 w-full rounded-md border bg-background px-1.5 text-xs"
                  aria-label={`${row.title} sahibi`}
                >
                  <option value="">—</option>
                  {admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.name}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                <input
                  type="date"
                  value={row.targetDate ?? ""}
                  onChange={(event) =>
                    void patch(row.id, {
                      targetDate: event.target.value || null,
                    })
                  }
                  disabled={busyId === row.id}
                  className="h-8 w-full rounded-md border bg-background px-1.5 text-xs"
                  aria-label={`${row.title} hedef tarihi`}
                />
              </TableCell>
              {(["impact", "effort"] as const).map((field) => (
                <TableCell key={field}>
                  <select
                    value={row[field] ?? ""}
                    onChange={(event) =>
                      void patch(row.id, {
                        [field]: event.target.value
                          ? Number(event.target.value)
                          : null,
                      })
                    }
                    disabled={busyId === row.id}
                    className="h-8 w-full rounded-md border bg-background px-1.5 text-xs"
                    aria-label={`${row.title} ${field}`}
                  >
                    <option value="">—</option>
                    {SCALE.map((value) => (
                      <option key={value} value={value}>
                        {value}
                      </option>
                    ))}
                  </select>
                </TableCell>
              ))}
              <TableCell className="text-right">
                {busyId === row.id ? (
                  <Loader2Icon className="ml-auto size-4 animate-spin" />
                ) : (
                  <span className="font-mono text-sm tabular-nums">
                    {score(row)}
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
