CREATE TABLE `x402_pins` (
	`agent_id` text NOT NULL,
	`domain` text NOT NULL,
	`chain` text NOT NULL,
	`token` text NOT NULL,
	`recipient` text NOT NULL,
	`amount` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`agent_id`, `domain`),
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `policies` ADD `mode` text DEFAULT 'live' NOT NULL;--> statement-breakpoint
ALTER TABLE `policies` ADD `price_increase_max_pct` integer DEFAULT 100 NOT NULL;--> statement-breakpoint
ALTER TABLE `policies` ADD `max_payments_per_minute` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `policies` ADD `require_mandate` integer DEFAULT false NOT NULL;