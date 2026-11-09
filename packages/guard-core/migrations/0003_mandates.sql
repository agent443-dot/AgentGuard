CREATE TABLE `mandates` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`budget` text NOT NULL,
	`spent` text DEFAULT '0' NOT NULL,
	`domains` text NOT NULL,
	`recipients` text NOT NULL,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`ttl_seconds` integer NOT NULL,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `mandates_agent_status` ON `mandates` (`agent_id`,`status`);--> statement-breakpoint
CREATE INDEX `mandates_expires_at` ON `mandates` (`expires_at`);--> statement-breakpoint
ALTER TABLE `intents` ADD `mandate_id` text;