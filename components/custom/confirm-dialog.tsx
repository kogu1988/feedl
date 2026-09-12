"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// 2026-09-12 (kullanıcı) — yıkıcı işlemler `window.confirm` ile onaylanıyordu.
// Tarayıcının yerel diyaloğu ürünün dışında kalır: stillenemez, markasız,
// mobilde farklı görünür ve sayfa dondurur (`comment-card` portalda, diğerleri
// dashboard'da). Onay bir SORUDUR; toast ise kendiliğinden kaybolan bir
// BİLDİRİMDİR — soru soramaz. Doğru araç uygulamanın kendi Dialog'udur.
//
// Kullanım (her çağrı yerinde ayrı state tutmamak için):
//   const { confirm, dialog } = useConfirm();
//   ...
//   confirm({
//     title: `"${x.name}" silinsin mi?`,
//     description: "İşlem geri alınamaz.",
//     confirmLabel: "Sil",
//     onConfirm: () => void doDelete(x),
//   });
//   ...
//   return <>{...}{dialog}</>;

export interface ConfirmRequest {
  title: string;
  description?: string;
  /** Onay butonunun metni (varsayılan "Sil"). Fiile göre yaz: "Board'u sil". */
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  request,
  onOpenChange,
}: {
  open: boolean;
  request: ConfirmRequest | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{request?.title ?? ""}</DialogTitle>
          {request?.description ? (
            <DialogDescription>{request.description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {request?.cancelLabel ?? "Vazgeç"}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              // Sıra önemli: ÖNCE kapat (istek temizlenir), SONRA çalıştır.
              // Çalıştırma `busyId` gibi state güncellerken dialog açık kalsaydı
              // ikinci bir tıklama aynı işlemi tekrar tetikleyebilirdi.
              onOpenChange(false);
              request?.onConfirm();
            }}
          >
            {request?.confirmLabel ?? "Sil"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useConfirm() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = useCallback((next: ConfirmRequest) => setRequest(next), []);

  const dialog = (
    <ConfirmDialog
      open={request !== null}
      request={request}
      onOpenChange={(open) => {
        if (!open) setRequest(null);
      }}
    />
  );

  return { confirm, dialog };
}
