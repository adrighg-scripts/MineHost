CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot` text NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`payload` text NOT NULL,
	`state` text NOT NULL,
	`result` text,
	`created` integer NOT NULL,
	`expires` integer NOT NULL,
	`lease_until` integer
);
--> statement-breakpoint
CREATE TABLE `transfers` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`direction` text NOT NULL,
	`uploaded` integer NOT NULL,
	`expires` integer NOT NULL
);
