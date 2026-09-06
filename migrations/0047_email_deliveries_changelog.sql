ALTER TABLE "email_deliveries" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD COLUMN "email" text;--> statement-breakpoint
CREATE INDEX "email_deliveries_email_idx" ON "email_deliveries" USING btree ("email","type","entity_id");