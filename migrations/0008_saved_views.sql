CREATE TABLE "saved_views" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"params" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
