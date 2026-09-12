"use client";

import { useRef, useState } from "react";
import { AlertCircleIcon, BadgeCheckIcon, Loader2Icon } from "lucide-react";

import { CUSTOM_DOMAIN_CNAME_TARGET } from "@/lib/dns-records";

import { normalizeHex } from "@/lib/color";

import { Notice } from "@/components/custom/notice";
import { ProBadge } from "@/components/custom/pro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// Sprint 48a (madde 8) — workspace ayarları formu. Slug salt-okunur
// (subdomain kaynağı); custom domain, marka rengi ve logo düzenlenebilir.
// Sprint 63x — custom domain PRO özelliği: Free'de alan kilitlenir ve
// "Pro'ya Yükselt" CTA gösterilir (API de kontrol eder — çift güvenlik).

export interface WorkspaceSettingsView {
  id: string;
  name: string;
  slug: string;
  customDomain: string | null;
  brandColor: string | null;
  logoUrl: string | null;
  widgetSubmissionMode: "anonymous" | "email" | "signup" | null;
  widgetAnonymousVoting: boolean | null;
  // 2026-09-12 — custom domain sahiplik doğrulaması. Domain, TXT kaydı
  // doğrulanana kadar host çözümlemesinde kullanılmaz.
  customDomainVerifiedAt?: Date | string | null;
}

// API'nin döndürdüğü TXT kaydı bilgisi.
interface DomainVerificationView {
  domain: string;
  recordName: string;
  recordValue: string;
  verifiedAt: string | Date | null;
}

export function WorkspaceSettings({
  initial,
  isPro = false,
}: {
  initial: WorkspaceSettingsView;
  isPro?: boolean;
}) {
  const [name, setName] = useState(initial.name);
  const [customDomain, setCustomDomain] = useState(initial.customDomain ?? "");
  const [brandColor, setBrandColor] = useState(initial.brandColor ?? "#ff5c35");
  // Renk kutusunun gösterdiği değer: metin geçerli bir hex ise onu, değilse son
  // GEÇERLİ rengi kullanır. Böylece kullanıcı hex yazarken (henüz geçersizken)
  // kutu siyaha düşüp titremez. Ref, render sırasında değil handler'da güncellenir.
  const lastValidColor = useRef(normalizeHex(initial.brandColor ?? "") ?? "#ff5c35");
  function updateBrandColor(next: string) {
    setBrandColor(next);
    const valid = normalizeHex(next);
    if (valid) lastValidColor.current = valid;
  }
  const swatchColor =
    normalizeHex(brandColor) ?? lastValidColor.current;
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? "");
  const [submissionMode, setSubmissionMode] = useState<
    "anonymous" | "email" | "signup"
  >(initial.widgetSubmissionMode ?? "signup");
  const [anonymousVoting, setAnonymousVoting] = useState(
    initial.widgetAnonymousVoting ?? false,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [verification, setVerification] = useState<DomainVerificationView | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | Date | null>(
    initial.customDomainVerifiedAt ?? null,
  );
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  // Trafik (CNAME + Vercel) durumu — sahiplikten AYRI raporlanır.
  const [verifyTraffic, setVerifyTraffic] = useState<string | null>(null);

  async function save() {
    setError(null);
    setSaved(false);
    if (!name.trim()) {
      setError("Workspace adı gerekli.");
      return;
    }
    if (brandColor && !/^#?[0-9a-fA-F]{6}$/.test(brandColor.trim())) {
      setError("Marka rengi geçerli bir hex renk olmalı. Örn: #ff5c35");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/workspace", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          // Free'de custom domain kilitli — she şemaya gönderilmez (API de kontro
          // eder). Boş/default kalır.
          customDomain: customDomain.trim() || null,
          brandColor: brandColor.trim() ? brandColor.trim() : null,
          logoUrl: logoUrl.trim() || null,
          widgetSubmissionMode: submissionMode,
          widgetAnonymousVoting: anonymousVoting,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error || "Kaydedilemedi. Lütfen tekrar deneyin.");
        return;
      }
      // Custom domain kaydedildi → doğrulama TXT kaydını göster.
      const info = (json.data?.domainVerification ?? null) as DomainVerificationView | null;
      setVerification(info);
      setVerifiedAt(info?.verifiedAt ?? json.data?.customDomainVerifiedAt ?? null);
      setVerifyError(null);
      setVerifyMessage(null);
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Kaydedilemedi. Lütfen tekrar deneyin.",
      );
    } finally {
      setSaving(false);
    }
  }

  // DNS TXT kaydını doğrular. Doğrulanana kadar custom domain host
  // çözümlemesinde KULLANILMAZ (subdomain/default geçerli kalır).
  async function verifyDomain() {
    setVerifying(true);
    setVerifyError(null);
    setVerifyMessage(null);
    try {
      const res = await fetch("/api/admin/workspace/verify-domain", {
        method: "POST",
      });
      const json = await res.json();
      if (!json.success) {
        setVerifyError(json.error || "Doğrulanamadı. Lütfen tekrar dene.");
        return;
      }
      setVerifiedAt(json.data?.verifiedAt ?? new Date().toISOString());
      setVerifyMessage("Sahiplik doğrulandı.");
      // Trafik yarısı: CNAME bize bakmıyorsa/domain projeye eklenmediyse
      // sahiplik yine de doğrulanmıştır — kullanıcıyı hata gibi korkutmadan
      // ne yapması gerektiğini söyleriz.
      const traffic = json.data?.traffic as
        | { ok?: boolean; detail?: string }
        | undefined;
      setVerifyTraffic(traffic?.detail ?? null);
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : "Doğrulanamadı. Lütfen tekrar dene.",
      );
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="mt-6 grid gap-4 rounded-lg border p-4">
      <div className="grid gap-1.5">
        <Label htmlFor="ws-name">Workspace adı</Label>
        <Input
          id="ws-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          placeholder="Örn: feedl"
        />
        <p className="text-xs text-muted-foreground">
          Portalda ve e-postalarda görünen isim.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ws-slug">Subdomain (salt okunur)</Label>
        <div className="flex items-center gap-1 text-sm text-muted-foreground">
          <Input
            id="ws-slug"
            value={initial.slug}
            readOnly
            className="max-w-[180px] bg-muted"
          />
          <span>.feedl.app</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Workspace bazlı portal adresi — başka bir uygulama için örn.
          acme.feedl.app. Değiştirilemez.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ws-domain" className="flex items-center gap-1.5">
          Custom domain
          {!isPro && (
            <ProBadge lock />
          )}
        </Label>
        {isPro ? (
          <Input
            id="ws-domain"
            value={customDomain}
            onChange={(e) => {
              setCustomDomain(e.target.value);
              // Girdi değişti: gösterilen TXT kaydı/doğrulama artık bayat.
              setVerification(null);
              setVerifiedAt(null);
              setVerifyError(null);
              setVerifyMessage(null);
            }}
            placeholder="Örn: feedback.acme.com"
            maxLength={200}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <Input
              id="ws-domain"
              value={customDomain}
              readOnly
              placeholder="Örn: feedback.acme.com"
              disabled
              className="max-w-[320px] bg-muted"
            />
            <Button
              size="sm"
              render={
                <a href="/dashboard/billing">
                  Pro&apos;ya Yükselt
                </a>
              }
            >
              Pro&apos;ya Yükselt
            </Button>
          </div>
        )}
        {isPro ? (
          <div className="grid gap-2">
            <p className="text-xs text-muted-foreground">
              Kendi alan adın (http:// veya https:// olmadan yalnızca host).
              Kaydettikten sonra DNS kaydı burada görünür.
            </p>
            {verification ? (
              <div className="grid gap-2 rounded-md border bg-muted/40 p-3 text-xs">
                <div className="flex items-center gap-1.5 font-medium">
                  {verifiedAt ? (
                    <BadgeCheckIcon className="size-4 text-emerald-600" />
                  ) : (
                    <AlertCircleIcon className="size-4 text-amber-600" />
                  )}
                  {verifiedAt ? "Alan adı doğrulandı" : "Doğrulama bekliyor"}
                </div>
                {!verifiedAt && (
                  <>
                    <p className="text-muted-foreground">
                      {`Alan adının bu workspace'e düşmesi için DNS sağlayıcında İKİ kayıt gerekir:`}
                    </p>
                    <div className="grid gap-1">
                      <p className="font-medium">
                        1) Sahiplik (TXT) — alan adı senin mi?
                      </p>
                      <div className="grid gap-1 pl-3 font-mono">
                        <div className="break-all">
                          <span className="text-muted-foreground">Ad: </span>
                          {verification.recordName}
                        </div>
                        <div className="break-all">
                          <span className="text-muted-foreground">Değer: </span>
                          {verification.recordValue}
                        </div>
                      </div>
                      <p className="mt-1 font-medium">
                        {`2) Trafik (CNAME) — istekleri bize yönlendirir`}
                      </p>
                      <div className="grid gap-1 pl-3 font-mono">
                        <div className="break-all">
                          <span className="text-muted-foreground">Ad: </span>
                          {verification.domain}
                        </div>
                        <div className="break-all">
                          <span className="text-muted-foreground">Hedef: </span>
                          {CUSTOM_DOMAIN_CNAME_TARGET}
                        </div>
                      </div>
                    </div>
                    <p className="text-muted-foreground">
                      Domainin projeye eklenmesi (trafik tarafı) bizim
                      tarafımızda yapılır; sen yalnız DNS kayıtlarını girersin.
                    </p>
                    <Button
                      size="sm"
                      className="mt-1 justify-self-start"
                      onClick={verifyDomain}
                      disabled={verifying}
                    >
                      {verifying && <Loader2Icon className="size-4 animate-spin" />}
                      Doğrula
                    </Button>
                  </>
                )}
              </div>
            ) : null}
            {verifyError && (
              <p className="text-xs text-destructive">{verifyError}</p>
            )}
            {verifyTraffic && (
              <p className="text-xs text-muted-foreground">{verifyTraffic}</p>
            )}
            {verifyMessage && (
              <p className="text-xs text-emerald-600">{verifyMessage}</p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Custom domain yalnızca Pro planda. Pro&apos;ya geçerek kendi
            markalı alan adını kullan.
          </p>
        )}
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ws-color">Marka rengi (opsiyonel)</Label>
        <div className="flex items-center gap-2">
          <Input
            id="ws-color"
            value={brandColor}
            onChange={(e) => updateBrandColor(e.target.value)}
            placeholder="Örn: #ff5c35"
            maxLength={20}
            className="max-w-[180px]"
          />
          {/* Tıklanabilir renk kutusu: OS renk seçicisini açar (Chrome'da
              damlalık da var — sayfadan renk alınabilir); seçilen hex metin
              alanına yazılır. Kullanıcı hex'i elle yazdığında kutu otomatik
              güncellenir (`swatchColor` türetilir). Geçersiz ara yazımlarda
              kutu son GEÇERLİ renkte kalır — aksi halde her tuşta siyaha
              düşer ve titrerdi. */}
          <label
            className="relative inline-flex size-8 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-md border ring-offset-2 focus-within:ring-3 focus-within:ring-ring/50"
            style={{ backgroundColor: swatchColor }}
            title="Renk seç"
          >
            <input
              type="color"
              value={swatchColor}
              onChange={(e) => updateBrandColor(e.target.value)}
              aria-label="Marka rengini seç"
              className="absolute inset-0 size-full cursor-pointer opacity-0"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          6 haneli hex renk kodu — # ile veya # olmadan yazabilirsin (örn.
          #ff5c35). Boş bırakılırsa varsayılan mercan kullanılır.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ws-logo">Logo URL (opsiyonel)</Label>
        <Input
          id="ws-logo"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="Örn: https://cdn.example.com/logo.png"
          maxLength={500}
        />
        <p className="text-xs text-muted-foreground">
          Portal başlığında görüntülenecek marka logosu (tam URL).
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="ws-submission-mode">Widget fikir gönderimi</Label>
        <p className="text-xs text-muted-foreground">
          Müşteri sitene gömülen widget&apos;ta ziyaretçilerin nasıl fikir
          göndereceğini seç.
        </p>
        <select
          id="ws-submission-mode"
          value={submissionMode}
          onChange={(e) =>
            setSubmissionMode(
              e.target.value as "anonymous" | "email" | "signup",
            )
          }
          className="h-9 w-full max-w-[320px] rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <option value="anonymous">Anonim — üye olmadan fikir + oy</option>
          <option value="email">E-posta — sadece mail adresinle</option>
          <option value="signup">Kayıt zorunlu — üye olarak</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Anonim: herkes üye olmadan fikir verebilir ve oy atabilir (IP başına).
          E-posta: sadece mail adresi istenir; kayıt yok. Kayıt: kurum içi
          toplama için uygundur.
        </p>
      </div>

      <div className="grid gap-1.5">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={anonymousVoting}
            onChange={(e) => setAnonymousVoting(e.target.checked)}
            className="size-4 rounded border-input"
          />
          Anonim modda oy vermeye izin ver
        </label>
        <p className="text-xs text-muted-foreground">
          Kapalıysa anonim ziyaretçiler yalnız fikir gönderebilir; oy için
          kayıt/email gerekir.
        </p>
      </div>

      <div className="flex items-center gap-2 pt-2">
        <Button onClick={save} disabled={saving}>
          {saving && (
            <Loader2Icon className="animate-spin" aria-hidden="true" />
          )}
          Kaydet
        </Button>
        {saved && (
          <span className="text-sm text-emerald-600 dark:text-emerald-400">
            Kaydedildi.
          </span>
        )}
      </div>

      {error && (
        <Notice>
          {error}
        </Notice>
      )}
    </div>
  );
}
