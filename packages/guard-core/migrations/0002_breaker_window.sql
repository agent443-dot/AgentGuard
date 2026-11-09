CREATE TABLE `cleared_payments` (
	`intent_id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`at` text NOT NULL,
	FOREIGN KEY (`intent_id`) REFERENCES `intents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cleared_payments_agent_at` ON `cleared_payments` (`agent_id`,`at`);