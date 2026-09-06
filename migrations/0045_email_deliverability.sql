ALTER TABLE "email_deliveries" ADD COLUMN "provider_id" text;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "status" varchar(20) DEFAULT 'sent' NOT NULL;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "error" text;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "bounced_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "complained_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "email_deliveries_provider_id_idx" ON "email_deliveries" USING btree ("provider_id");