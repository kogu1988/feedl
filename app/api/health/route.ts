import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";

// Uptime izleme ucu (2026-09-12, denetim #8).
//
// Bir monitör (UptimeRobot / Better Stack vb.) buraya periyodik vurur. Yalnız
// `200` dönmek yetersiz olurdu: süreç ayakta ama veritabanı erişilemezse bu
// "yeşil ama kırık" demektir — bu yüzden DB'ye GERÇEK bir sorgu atılır.
//
// Sızıntı yok: gövdede sayaç, tablo adı, env adı veya hata metni DÖNMEZ
// (monitör durum koduna bakar; ayrıntı sunucu log'una gider).
//
// Önbelleklenmez: önbelleğe alınmış bir sağlık kontrolü işe yaramaz.
export const dynamic = "force-dynamic";

// Monitör 30–60 sn'de bir vurur; kesinti saatler sürerse Sentry'yi (captureConsole
// ile `console.error`'u olaya çeviriyoruz) yağmura tutmamak için hata yalnız İLK
// seferde `error` seviyesinde loglanır, sonrakiler `warn`. Süreç yeniden
// başlarsa yeniden bildirir.
// (Modül seviyesi bayrak: tenant verisi taşımaz — sızıntı sınıfı değil.)
let outageReported = false;

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    outageReported = false;
    return Response.json({ status: "ok", db: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (outageReported) {
      console.warn("[health] veritabanı hâlâ erişilemez:", message);
    } else {
      outageReported = true;
      console.error("[health] veritabanına erişilemedi:", message);
    }
    return Response.json(
      { status: "error", db: "unreachable" },
      { status: 503 },
    );
  }
}
