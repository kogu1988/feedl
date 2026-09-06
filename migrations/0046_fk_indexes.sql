CREATE INDEX "comments_user_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_user_idx" ON "posts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "posts_board_idx" ON "posts" USING btree ("board_id");--> statement-breakpoint
CREATE INDEX "votes_post_idx" ON "votes" USING btree ("post_id");