// Sprint 70.1 — tek sorumluluk: sendWebhooks.
import { NonRetriableError } from "inngest";
import { deliverToAllEndpoints, deliverWebhook, loadWebhookEndpoints } from "@/lib/webhooks/dispatch";
import { hydrateWebhookPayload } from "@/lib/webhooks/payload";
import { markDeliveryDelivered, recordDeliveryFailure } from "@/lib/webhooks/delivery-log";
import { getWorkspaceId } from "@/lib/db/workspace";
import { inngest } from "../client";
import { WEBHOOK_EVENT_MAP } from "./shared";

export const sendWebhooks = inngest.createFunction(
  {
    id: "send-webhooks",
    retries: 3,
    triggers: [
      { event: "post/created" },
      { event: "post/status.changed" },
      { event: "post/comment.created" },
      { event: "post/comment.deleted" },
      { event: "vote/created" },
      { event: "vote/deleted" },
      { event: "changelog/published" },
    ],
  },
  async ({ event, step }) => {
    const webhookEvent = WEBHOOK_EVENT_MAP[event.name];
    if (!webhookEvent) {
      throw new NonRetriableError(`Bilinmeyen webhook olayı: ${event.name}`);
    }

    const endpoints = await step.run("load-endpoints", () =>
      loadWebhookEndpoints(webhookEvent),
    );
    if (endpoints.length === 0) {
      return { event: webhookEvent, delivered: 0 };
    }

    // Tüketicinin kullanabileceği bağlamı tek kez çöz; teslimat her endpoint
    // için aynı zengin payload'ı kullanır.
    const hydrated = await step.run("hydrate-payload", () =>
      hydrateWebhookPayload(webhookEvent, event.data),
    );

    // Her endpoint'e BAĞIMSIZ teslimat: bir endpoint'in hatası diğerlerini aç
    // bırakmasın. Hatalar toplanır ve sonunda fırlatılır → Inngest retry eder
    // + dead-letter kaydı düşer; başarılı endpoint'ler step memoization
    // sayesinde TEKRAR teslim edilmez.
    const { delivered, failed } = await deliverToAllEndpoints(
      endpoints,
      (endpoint) =>
        step.run(`deliver-${endpoint.id}`, async () => {
          const upsert = {
            workspaceId: await getWorkspaceId(),
            endpointId: endpoint.id,
            event: webhookEvent,
            payload: hydrated,
          };
          try {
            await deliverWebhook(endpoint, webhookEvent, hydrated);
            await markDeliveryDelivered(upsert);
          } catch (deliveryErr) {
            // Dead-letter kaydı + Inngest'in retry etmesi için rethrow.
            await recordDeliveryFailure(
              upsert,
              deliveryErr instanceof Error
                ? deliveryErr.message
                : "Bilinmeyen teslimat hatası",
            );
            throw deliveryErr;
          }
        }),
    );
    if (failed.length > 0) {
      throw new Error(
        `${failed.length}/${endpoints.length} webhook endpoint teslimatı başarısız: ${failed.join(", ")}`,
      );
    }

    return { event: webhookEvent, delivered };
  },
);

// Sprint 40: changelog abonelerine yeni duyuru maili (changelog/published).
// Alıcılar changelog_subscribers'tan çözülür — anonim aboneler users
// tablosunda olmadığı için email_deliveries idempotency KULLANILAMAZ;
// tekrar gönderimi Inngest step memoization önler (adım bir kez
// tamamlanınca retry/replay aynı adımı tekrar çalıştırmaz).
