import "server-only";

// Sprint 58 (madde 2) — per-workspace Linear otomasyonu. Linear GraphQL API
// üzerinden webhook oluşturma/silme/listeleme. API key her çağrıda
// `Authorization` header'ı olarak gönderilir. Dikkat: Linear `webhookCreate`
// şeması `resourceTypes` (zorunlu) kullanır; `secret` oluşturma anında döner.

const LINEAR_GRAPHQL_URL = "https://api.linear.app/graphql";

export interface LinearWebhook {
  id: string;
  label?: string | null;
  url?: string | null;
  secret?: string | null;
  enabled: boolean;
  resourceTypes?: string[];
  allPublicTeams?: boolean;
}

interface GraphQLError {
  message: string;
  extensions?: { code?: string };
}

// GQL isteği gönderir; hataları normalize eder. Dönen `data` tipini döndürür.
async function gql<T = Record<string, unknown>>(
  apiKey: string,
  query: string,
): Promise<{ data: T | null; errors: GraphQLError[] }> {
  const res = await fetch(LINEAR_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: apiKey },
    body: JSON.stringify({ query }),
  });
  const json = (await res.json().catch(() => null)) as
    | { data: T | null; errors?: GraphQLError[] }
    | null;
  return {
    data: json?.data ?? null,
    errors: json?.errors ?? [],
  };
}

// Linear org bilgisi (connect'te API key'in geçerli olup olmadığını doğrular).
export async function linearViewer(
  apiKey: string,
): Promise<{ viewer: { id: string; name: string; email: string } } | null> {
  const { data, errors } = await gql<{ viewer: { id: string; name: string; email: string } }>(
    apiKey,
    `{ viewer { id name email } }`,
  );
  if (errors.length > 0 || !data?.viewer) return null;
  return data;
}

// Webhook oluşturur. `resourceTypes` Linear enum değerleri: Issue, Comment,
// CustomerNeed, Project, Cycle vb. `allPublicTeams` ve opsiyonel `teamId`.
// Dönen webhook `secret` içerir (HMAC doğrulama anahtarı).
export async function linearCreateWebhook(
  apiKey: string,
  input: {
    label: string;
    url: string;
    resourceTypes: string[];
    allPublicTeams?: boolean;
    teamId?: string | null;
  },
): Promise<{ ok: boolean; webhook?: LinearWebhook; error?: string }> {
  const { data, errors } = await gql<{
    webhookCreate: { success: boolean; webhook: LinearWebhook };
  }>(
    apiKey,
    `mutation {
      webhookCreate(input: {
        label: ${JSON.stringify(input.label)}
        url: ${JSON.stringify(input.url)}
        resourceTypes: ${JSON.stringify(input.resourceTypes)}
        allPublicTeams: ${input.allPublicTeams === false ? "false" : "true"}
        ${input.teamId ? `teamId: ${JSON.stringify(input.teamId)}` : ""}
      }) {
        success
        webhook { id label url secret enabled resourceTypes allPublicTeams }
      }
    }`,
  );
  if (errors.length > 0) {
    return { ok: false, error: errors[0]?.message ?? "Linear isteği başarısız." };
  }
  const result = data?.webhookCreate;
  if (!result?.success || !result.webhook) {
    return { ok: false, error: "Linear webhook oluşturulamadı." };
  }
  return { ok: true, webhook: result.webhook };
}

// Webhook'u siler (id ile).
export async function linearDeleteWebhook(
  apiKey: string,
  webhookId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, errors } = await gql<{ webhookDelete: { success: boolean } }>(
    apiKey,
    `mutation { webhookDelete(id: ${JSON.stringify(webhookId)}) { success } }`,
  );
  if (errors.length > 0) {
    return { ok: false, error: errors[0]?.message ?? "Linear webhook silinemedi." };
  }
  return { ok: data?.webhookDelete?.success ?? false };
}

// Workspace'teki webhook'ları listeler (uygulama sırasında debug için).
export async function linearListWebhooks(
  apiKey: string,
): Promise<{ ok: boolean; webhooks?: LinearWebhook[]; error?: string }> {
  const { data, errors } = await gql<{ webhooks: { nodes: LinearWebhook[] } }>(
    apiKey,
    `{ webhooks { nodes { id label url enabled resourceTypes allPublicTeams } } }`,
  );
  if (errors.length > 0) {
    return { ok: false, error: errors[0]?.message ?? "Linear webhook listesi alınamadı." };
  }
  return { ok: true, webhooks: data?.webhooks?.nodes ?? [] };
}
