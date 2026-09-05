// Sprint 63g — Slack per-workspace connect (store signing secret + bot token).
import { createIntegrationConnectHandler, slackConnectSchema } from "@/lib/integrations-route";

const handler = createIntegrationConnectHandler("slack", slackConnectSchema);

export const GET = handler.GET;
export const POST = handler.POST;
export const DELETE = handler.DELETE;
