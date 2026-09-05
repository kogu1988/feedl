// Sprint 63g — Intercom per-workspace connect.
import { createIntegrationConnectHandler, intercomConnectSchema } from "@/lib/integrations-route";

const handler = createIntegrationConnectHandler("intercom", intercomConnectSchema);

export const GET = handler.GET;
export const POST = handler.POST;
export const DELETE = handler.DELETE;
