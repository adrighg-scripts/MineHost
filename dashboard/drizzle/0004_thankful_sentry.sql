CREATE INDEX `devices_token_hash_idx` ON `devices` (`token_hash`);--> statement-breakpoint
CREATE INDEX `jobs_device_created_idx` ON `jobs` (`device_id`,`created`);--> statement-breakpoint
CREATE INDEX `jobs_device_queue_idx` ON `jobs` (`device_id`,`state`,`expires`,`lease_until`);--> statement-breakpoint
CREATE INDEX `jobs_created_idx` ON `jobs` (`created`);--> statement-breakpoint
CREATE INDEX `members_device_account_idx` ON `members` (`device_id`,`account_id`);