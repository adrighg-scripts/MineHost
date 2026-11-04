CREATE TABLE `invitations` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`permissions` text NOT NULL,
	`expires` integer NOT NULL,
	`used_by` integer
);
--> statement-breakpoint
CREATE TABLE `members` (
	`id` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`account_id` integer NOT NULL,
	`permissions` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `devices` ADD `owner_id` integer;--> statement-breakpoint
ALTER TABLE `devices` ADD `token_hash` text;--> statement-breakpoint
ALTER TABLE `jobs` ADD `device_id` text DEFAULT 'phone' NOT NULL;--> statement-breakpoint
ALTER TABLE `jobs` ADD `requested_by` integer;--> statement-breakpoint
ALTER TABLE `transfers` ADD `device_id` text DEFAULT 'phone' NOT NULL;--> statement-breakpoint
ALTER TABLE `transfers` ADD `account_id` integer;--> statement-breakpoint
ALTER TABLE `transfers` ADD `permission` text DEFAULT 'files.read' NOT NULL;