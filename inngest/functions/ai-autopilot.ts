// Sprint 70.1 — tek sorumluluk: aiAutopilot.
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { analyzeIdea, compareIdeas, normalizeTags } from "@/lib/ai/analysis";
import { buildLearnedContext } from "@/lib/ai/prompts";
import { embedText } from "@/lib/ai/openrouter";
import { getDb } from "@/lib/db";
import { getWorkspaceId } from "@/lib/db/workspace";
import { aiSuggestions, aiTriageSignals, boards, postTags, posts, tags } from "@/lib/db/schema";
import { postCreatedEventSchema, type PostCreatedEvent } from "@/lib/validations/events";
import { inngest } from "../client";
import { DUPLICATE_SIMILARITY_THRESHOLD, DUPLICATE_CANDIDATE_LIMIT, extractRows, type DuplicateCandidate } from "./shared";

export const aiAutopilot = inngest.createFunction(
  { id: "ai-autopilot", retries: 2, triggers: { event: "post/created" } },
  async ({ event, step }) => {
    const payload: PostCreatedEvent = postCreatedEventSchema.parse(event.data);

    // 1) Yeni postun metnini vektöre çevir.
    const embedding: number[] = await step.run(
      "generate-embedding",
      async () => {
        const vector = await embedText(
          `${payload.title}\n${payload.description}`,
        );
        if (vector.length !== 2048) {
          throw new Error(`Unexpected embedding dimension: ${vector.length}`);
        }
        return vector;
      },
    );

    // 2) En benzer eski postu bul (cosine, HNSW yok — sıralı tarama yeterli).
    const candidate: DuplicateCandidate | null = await step.run(
      "find-duplicate-candidate",
      async () => {
        const vectorLiteral = `[${embedding.join(",")}]`;
        const result = await getDb().execute(sql`
          SELECT id, title, description,
                 1 - (embedding_vector <=> ${vectorLiteral}::halfvec) AS similarity
          FROM posts
          WHERE embedding_vector IS NOT NULL AND id <> ${payload.postId}
          ORDER BY embedding_vector <=> ${vectorLiteral}::halfvec
          LIMIT ${DUPLICATE_CANDIDATE_LIMIT}
        `);

        const mapped: DuplicateCandidate[] = [];
        for (const row of extractRows(result)) {
          const similarity = Number(row.similarity);
          if (
            typeof row.id === "string" &&
            typeof row.title === "string" &&
            typeof row.description === "string" &&
            Number.isFinite(similarity)
          ) {
            mapped.push({
              id: row.id,
              title: row.title,
              description: row.description,
              similarity,
            });
          }
        }

        const best = mapped.sort((a, b) => b.similarity - a.similarity)[0];
        return best && best.similarity > DUPLICATE_SIMILARITY_THRESHOLD
          ? best
          : null;
      },
    );

    // 3) Aday varsa LLM ile çift doğrula. Sprint 33: DUPLICATE kararı artık
    // doğrudan uygulanmaz — pending öneri olarak Autopilot Inbox'a düşer;
    // admin approve edince Sprint 20 merge CTE'si birleştirir.
    let duplicateSuggestion: {
      duplicateOf: string;
      similarity: number;
      note: string;
    } | null = null;

    if (candidate) {
      const relation = await step.run(
        "confirm-duplicate-with-llm",
        async () =>
          compareIdeas(
            { title: candidate.title, description: candidate.description },
            { title: payload.title, description: payload.description },
          ),
      );

      if (relation === "DUPLICATE") {
        duplicateSuggestion = {
          duplicateOf: candidate.id,
          similarity: candidate.similarity,
          note: `Bu istek "${candidate.title}" ile yüksek olasılıkla tekrar (cosine ${candidate.similarity.toFixed(3)}, LLM onaylı)`,
        };
      }
    }

    // 4) Özet + sentiment + etiketler. Tenant bağlamı: postun board adı
    // analyzeIdea'ya geçirilir (bağımsız workspace'lerde içerik karışmaz).
    // Faz 1: teknik bağlam (cihaz/viewport/tarayıcı/OS) da eklenir — AI'ya
    // "kanıt" verir (ör. "mobilde" bug'ı).
    const aiContext = await step.run("resolve-ai-context", async () => {
      const [post] = await getDb()
        .select({
          boardId: posts.boardId,
          workspaceId: posts.workspaceId,
          deviceType: posts.deviceType,
          viewportWidth: posts.viewportWidth,
          viewportHeight: posts.viewportHeight,
          browser: posts.browser,
          os: posts.os,
        })
        .from(posts)
        .where(eq(posts.id, payload.postId))
        .limit(1);
      if (!post) {
        return { boardName: undefined, technical: undefined, learned: undefined };
      }
      let boardName: string | undefined;
      if (post.boardId) {
        const [board] = await getDb()
          .select({ name: boards.name })
          .from(boards)
          .where(eq(boards.id, post.boardId))
          .limit(1);
        boardName = board?.name ?? undefined;
      }
      const parts: string[] = [];
      if (post.deviceType) parts.push(`cihaz: ${post.deviceType}`);
      if (post.viewportWidth && post.viewportHeight) {
        parts.push(`viewport: ${post.viewportWidth}×${post.viewportHeight}`);
      }
      if (post.browser) parts.push(`tarayıcı: ${post.browser}`);
      if (post.os) parts.push(`OS: ${post.os}`);

      // Faz 3: workspace'in son triage sinyalleri (ilgisiz / tür düzeltmesi) →
      // prompt bağlamı. En yeni 8 sinyal, post başlığıyla birlikte.
      const signalRows = await getDb()
        .select({
          kind: aiTriageSignals.kind,
          aiValue: aiTriageSignals.aiValue,
          correctValue: aiTriageSignals.correctValue,
          title: posts.title,
        })
        .from(aiTriageSignals)
        .innerJoin(posts, eq(posts.id, aiTriageSignals.postId))
        .where(eq(aiTriageSignals.workspaceId, post.workspaceId))
        .orderBy(desc(aiTriageSignals.createdAt))
        .limit(8);
      const learned = buildLearnedContext(
        signalRows.map((s) => ({
          kind: s.kind === "type_corrected" ? "type_corrected" : "not_relevant",
          title: s.title,
          aiValue: s.aiValue,
          correctValue: s.correctValue,
        })),
      );
      return {
        boardName,
        technical: parts.length > 0 ? parts.join(" · ") : undefined,
        learned: learned || undefined,
      };
    });
    const analysis = await step.run("analyze-idea", async () =>
      analyzeIdea(
        { title: payload.title, description: payload.description },
        {
          boardName: aiContext.boardName,
          technical: aiContext.technical,
          learned: aiContext.learned,
        },
      ),
    );

    // 5) Tüm sonuçları tek yazımda kaydet. duplicateOf artık buraya yazılmaz
    // (Sprint 33) — onay bekleyen öneri inbox'ta durur.
    await step.run("persist-ai-results", async () => {
      await getDb()
        .update(posts)
        .set({
          aiSummary: analysis.summary,
          sentimentLabel: analysis.sentiment,
          aiKeywords: analysis.keywords,
          postType: analysis.type,
          embeddingVector: embedding,
          updatedAt: new Date(),
        })
        .where(eq(posts.id, payload.postId));
    });

    // 5b) Sprint 33: pending duplicate önerisini inbox'a yaz. Delete+insert
    // idempotent: retry'da önceki pending kayıt silinip yeniden eklenir,
    // sonuç aynı kalır.
    if (duplicateSuggestion) {
      await step.run("save-duplicate-suggestion", async () => {
        await getDb()
          .delete(aiSuggestions)
          .where(
            and(
              eq(aiSuggestions.postId, payload.postId),
              eq(aiSuggestions.type, "duplicate"),
              eq(aiSuggestions.status, "pending"),
            ),
          );
        await getDb().insert(aiSuggestions).values({
          postId: payload.postId,
          type: "duplicate",
          payload: duplicateSuggestion,
          confidence: Math.round(duplicateSuggestion.similarity * 100),
        });
      });
    }

    // 6) Sprint 21: keyword'leri normalize edip tags + post_tags'e yaz.
    //    Upsert idempotent; eski bağlantılar temizlenip yenilenir (retry
    //    sonrası tekrar çalışsa bile sonuç aynı kalır).
    await step.run("sync-tags", async () => {
      const names = normalizeTags(analysis.keywords);
      if (names.length === 0) {
        return { tags: 0 };
      }

      const workspaceId = await getWorkspaceId();

      await getDb()
        .insert(tags)
        .values(names.map((name) => ({ name, workspaceId })))
        .onConflictDoNothing();

      const tagRows = await getDb()
        .select({ id: tags.id, name: tags.name })
        .from(tags)
        .where(
          and(eq(tags.workspaceId, workspaceId), inArray(tags.name, names)),
        );

      await getDb()
        .delete(postTags)
        .where(eq(postTags.postId, payload.postId));

      await getDb()
        .insert(postTags)
        .values(
          tagRows.map((tag) => ({ postId: payload.postId, tagId: tag.id })),
        )
        .onConflictDoNothing();

      return { tags: tagRows.length };
    });

    return {
      duplicateSuggested: Boolean(duplicateSuggestion),
      sentiment: analysis.sentiment,
    };
  },
);

// plan.md Sprint 6 + Sprint 26: durum değişikliği bildirimi. Alıcılar
// artık post_followers tablosundan (yazar + oy veren + yorum yazanlar
// otomatik takipçi). shipped geçişi kutlama maili; diğer geçişler bilgilendirme
// maili alır. Tercihler (users.email_status_updates) ve email_deliveries
// idempotency uygulanır; her alıcı için kişisel unsubscribe linki render edilir.
