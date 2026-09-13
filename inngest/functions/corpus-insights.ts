// Sprint 70.1 — tek sorumluluk: corpusInsights.
import { asc, count, desc, eq } from "drizzle-orm";
import { effectivePlanKeyForWorkspace } from "@/lib/paddle";
import { analyzeCorpus } from "@/lib/ai/insights";
import { getDb } from "@/lib/db";
import { posts, votes, workspaces } from "@/lib/db/schema";
import { inngest } from "../client";
import { MAX_CORPUS } from "./shared";

export const corpusInsights = inngest.createFunction(
  {
    id: "corpus-insights",
    retries: 2,
    triggers: { event: "corpus-insights.request" },
    // Workspace BASINA 1 eşzamanlı analiz (anahtarlı). Eskiden global
    // FUNCTION limitiydi (`concurrency: 1`): tek bir workspace'in yavaş
    // analizi diğer TÜM workspace'leri bekletiyordu (çok kiracılı
    // adaletsizlik) ve 2026-09-11'de bu tek global slot takılıp fonksiyon
    // saatlerce QUEUED kaldı (diğer fonksiyonlar normal çalışırken).
    // Anahtarlı limit her workspace'e kendi slotunu verir.
    concurrency: { limit: 1, key: "event.data.workspaceId" },
  },
  async ({ event, step }) => {
    const workspaceId = (event.data as { workspaceId: string }).workspaceId;
    const db = getDb();

    // İşlem başladı: status='pending'.
    await step.run("mark-pending", async () => {
      await db
        .update(workspaces)
        .set({ corpusInsightsStatus: "pending", updatedAt: new Date() })
        .where(eq(workspaces.id, workspaceId));
    });

    try {
      // Sprint 63n — defense-in-depth: workspace artık pro değilse (downgrade
      // veya sırada bekleyen eski event) LLM çağrısı ÜRETME. Kuyrukta kalan bir
      // event bile maliyet doğurmaz; cache'e "pro gerekir" notu yazılır.
      // 2026-09-12: etkin plan hesap düzeyi kuralı içerir (owner'ın başka bir
      // Pro workspace'i varsa bu workspace de Pro) — ham `workspaces.plan`
      // okumak, owner'ın diğer workspace'lerinde içgörüleri yanlışlıkla keserdi.
      const planKey = await step.run("check-plan", async () => {
        return effectivePlanKeyForWorkspace(workspaceId);
      });
      if (planKey !== "pro") {
        await step.run("store-pro-required", async () => {
          // Cache'e PLAN METNİ YAZILMAZ. Eskiden buraya "AI içgörüleri Pro plan
          // özelliğidir…" cümlesi recommendation olarak yazılıyordu; plan
          // Pro'ya geçince bu bayat metin gerçek içgörü sanılıp gösteriliyordu
          // (sayfada hem Pro uyarısı hem "Yenile" butonu görünüyordu).
          // Doğrusu: cache'i BOŞ bırak — sayfa kilit durumunu CANLI plandan
          // türetir, cache yalnız gerçek analiz sonucu taşır.
          await db
            .update(workspaces)
            .set({
              corpusInsights: null,
              corpusInsightsStatus: "idle",
              corpusInsightsAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(workspaces.id, workspaceId));
        });
        return { status: "done", corpusSize: 0, planned: "free" };
      }

      // En çok oy alan fikirleri topla (aynı MAX_CORPUS sınırı).
      const rows = await step.run("load-corpus", async () => {
        return db
          .select({
            id: posts.id,
            title: posts.title,
            description: posts.description,
            status: posts.status,
            voteCount: count(votes.id),
          })
          .from(posts)
          .leftJoin(votes, eq(votes.postId, posts.id))
          .where(eq(posts.workspaceId, workspaceId))
          .groupBy(posts.id)
          .orderBy(desc(count(votes.id)), asc(posts.id))
          .limit(MAX_CORPUS);
      });

      if (rows.length === 0) {
        await step.run("store-empty", async () => {
          await db
            .update(workspaces)
            .set({
              corpusInsightsStatus: "done",
              corpusInsightsAt: new Date(),
              corpusInsights: {
                themes: [],
                trends: [],
                quickWins: [],
                risks: [],
                recommendation:
                  "Henüz yeterli geri bildirim yok. İlk fikirler geldikçe içgörü üretilir.",
              },
              updatedAt: new Date(),
            })
            .where(eq(workspaces.id, workspaceId));
        });
        return { status: "done", corpusSize: 0 };
      }

      // LLM analizi (arka planda devam eder; timeout yok). Şekil bozukluğu
      // analyzeCorpus içinde graceful fallback'e düşer; yalnız AĞ hatası fırlatır
      // → Inngest retry (2x) sonrası hala başarısızsa alttaki catch status='error' yapar.
      const insights = await step.run("analyze-corpus", async () =>
        analyzeCorpus(
          rows.map((r) => ({
            title: r.title,
            description: r.description,
            status: r.status,
            votes: Number(r.voteCount),
          })),
        ),
      );

      await step.run("store-result", async () => {
        await db
          .update(workspaces)
          .set({
            corpusInsightsStatus: "done",
            corpusInsightsAt: new Date(),
            corpusInsights: insights,
            updatedAt: new Date(),
          })
          .where(eq(workspaces.id, workspaceId));
      });

      return { status: "done", corpusSize: rows.length };
    } catch (err) {
      // Kalıcı hata: status='error' — böylece route pending'de takılmaz ve
      // kullanıcı tekrar "Yenile" ile retry edebilir. Rethrow: Inngest yine de
      // hata kaydı tutar ve retry (yukarıda 2x) politikanı uygular.
      console.error(
        "corpus-insights failed:",
        err instanceof Error ? err.message : err,
      );
      await step.run("mark-error", async () => {
        await db
          .update(workspaces)
          .set({
            corpusInsightsStatus: "error",
            corpusInsightsAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(workspaces.id, workspaceId));
      });
      throw err;
    }
  },
);

// Faz 4 — haftalık AI özeti (digest).
// Alınan kararlar (2026-09-10):
//  · Sıklık: haftalık cron (Pazartesi 06:00 UTC = 09:00 TRT) + "yeni geri
//    bildirim yoksa gönderme" eşiği (boş özet gürültüdür).
//  · Teslimat: hem dashboard içgörü önbelleği tazelenir hem admin'lere e-posta.
// · Kime: workspace ekibi (owner/manager/member) ve email_digest tercihi
//    açık olanlar — platform personeli (`users.role='admin'`) dahil değil.
// LLM maliyeti workspace başına haftada 1 korpus çağrısıdır; free plan hiç
// çağrı üretmez (erken çıkış).
