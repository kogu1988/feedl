ALTER TABLE "workspaces" ADD COLUMN "plan" varchar(20) DEFAULT 'free' NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "paddle_customer_id" varchar(40);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "paddle_subscription_id" varchar(40);--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "tracked_user_limit" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "board_limit" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "workspaces" ADD COLUMN "member_limit" integer DEFAULT 1 NOT NULL;