CREATE TABLE `device_links` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`poll_hash` text NOT NULL,
	`model` text NOT NULL,
	`expires` integer NOT NULL,
	`claimed_by` integer,
	`device_id` text,
	`encrypted` text
);
