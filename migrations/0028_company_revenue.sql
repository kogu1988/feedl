ALTER TABLE "companies" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "renewal_date" date;--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "segment" varchar(40);