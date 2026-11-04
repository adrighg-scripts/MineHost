DROP INDEX `redemption_lookup_idx`;--> statement-breakpoint
CREATE UNIQUE INDEX `redemption_lookup_idx` ON `invitation_redemptions` (`token_hash`,`account_id`);