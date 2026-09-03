import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { TriangleAlertIcon } from "lucide-react";

import { WidgetSetup } from "@/components/custom/widget-setup";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAdminUserId } from "@/lib/auth/admin";
import { isWidgetConfigured } from "@/lib/widget/jwt";

// Sprint 32: widget SDK kurulum sayfası — embed snippet, test jetonu
// üretici, üretim için Node.js imza örneği ve ortam değişkeni notları.
export const dynamic = "force-dynamic";

export default async function WidgetAdminPage() {
  const adminId = await getAdminUserId();
  if (!adminId) {
    redirect("/portal");
  }

  // Snippet, ziyaret edilen adresi otomatik izler (domain değişirse güncel kalır).
  const headerList = await headers();
  const host =
    headerList.get("x-forwarded-host") ?? headerList.get("host") ?? "getfeedl.vercel.app";
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const baseUrl = `${proto}://${host}`;

  const configured = isWidgetConfigured();

  return (
    <main className="container mx-auto max-w-5xl p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Widget SDK</h1>
      <p className="mt-2 text-muted-foreground">
        Fikir portalını kendi sitenize gömün: ziyaretçiler sitenizden çıkmadan
        fikir gönderir ve oy verir.
      </p>

      {!configured ? (
        <p className="mt-6 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <TriangleAlertIcon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          FEEDL_WIDGET_SECRET henüz yapılandırılmamış. Jeton üretimi ve oturum
          açma bu gizli anahtar ayarlanana kadar çalışmaz.
        </p>
      ) : null}

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Kurulum</CardTitle>
          <CardDescription>
            Jeton üret, snippet&apos;i kopyala, sitene ekle — hepsi bu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <WidgetSetup baseUrl={baseUrl} />
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Üretim: jetonu kendi backend&apos;inizde imalayın</CardTitle>
          <CardDescription>
            HS256, sıfır bağımlılık — Node.js örneği. sub zorunlu ve en fazla
            64 karakter (harf, rakam, - ve _); exp zorunlu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 text-xs leading-relaxed">
            <code>{NODE_EXAMPLE}</code>
          </pre>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Ortam değişkenleri ve notlar</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground">
          <p>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">FEEDL_WIDGET_SECRET</code>{" "}
            — müşteri ve feedl&apos;in paylaştığı gizli anahtar (en az 16 karakter,
            öneri: <code className="rounded bg-muted px-1.5 py-0.5 text-xs">openssl rand -hex 32</code>).
          </p>
          <p>
            <code className="rounded bg-muted px-1.5 py-0.5 text-xs">FEEDL_WIDGET_ALLOWED_ORIGINS</code>{" "}
            — opsiyonel; virgülle ayrılmış origin listesi (örn.
            https://siteniz.com). Boşsa kısıt yok.
          </p>
          <p>
            Safari, üçüncü taraf çerezleri (ITP) kısıtlar: kimlikli oturum
            Safari&apos;de açılmayabilir; widget yine salt-okunur liste olarak
            çalışır.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}

const NODE_EXAMPLE = `import { createHmac } from "node:crypto";

function signWidgetToken(sub, name, email, ttlSeconds = 3600) {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({
    alg: "HS256", typ: "JWT",
  })).toString("base64url");
  const payload = Buffer.from(JSON.stringify({
    iss: "feedl",
    aud: "feedl-widget",
    sub,
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    iat: now,
    exp: now + ttlSeconds,
  })).toString("base64url");
  const signature = createHmac("sha256", process.env.FEEDL_WIDGET_SECRET)
    .update(header + "." + payload)
    .digest("base64url");
  return header + "." + payload + "." + signature;
}

// Giriş yapmış kullanıcınız için jeton üretip sayfaya gömün:
const token = signWidgetToken("user-42", "Ayse Yilmaz", "ayse@ornek.com");`;
