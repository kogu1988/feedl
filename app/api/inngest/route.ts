import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { aiAutopilot, notifyShipped } from "@/inngest/functions";

// Inngest serve endpoint. Lokal geliştirmede Dev Server (localhost:8288),
// production'da Inngest Cloud INNGEST_SIGNING_KEY ile doğrulayarak bu rotayı
// çağırır. Middleware bu rotayı public tutar (middleware.ts).
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [aiAutopilot, notifyShipped],
});
