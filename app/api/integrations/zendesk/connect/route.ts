// Sprint 63g — Zendesk per-workspace connect.
import { createIntegrationConnectHandler, zendeskConnectSchema } from "@/lib/integrations-route";

const handler = createIntegrationConnectHandler("zendesk", zendeskConnectSchema);

export const GET = handler.GET;
export const POST = handler.POST;
export const DELETE = handler.DELETE;
