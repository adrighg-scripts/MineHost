CREATE TABLE `invitation_redemptions` (
	`id` integer PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`account_id` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `redemption_lookup_idx` ON `invitation_redemptions` (`token_hash`,`account_id`);--> statement-breakpoint
ALTER TABLE `invitations` ADD `label` text DEFAULT 'Einladung' NOT NULL;--> statement-breakpoint
ALTER TABLE `invitations` ADD `recipient` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `invitations` ADD `max_uses` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `invitations` ADD `uses` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invitations` ADD `access_hours` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `invitations` ADD `revoked` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `expires` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
UPDATE invitations SET uses=1 WHERE used_by IS NOT NULL;
--> statement-breakpoint
INSERT INTO invitation_redemptions(token_hash,account_id) SELECT token_hash,used_by FROM invitations WHERE used_by IS NOT NULL;
