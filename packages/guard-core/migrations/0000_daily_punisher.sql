CREATE TABLE `agents` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`created_at` text NOT NULL,
	`revoked_at` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `agents_token_hash_unique` ON `agents` (`token_hash`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` text NOT NULL,
	`intent_id` text,
	`agent_id` text,
	`event` text NOT NULL,
	`decision` text,
	`reasons` text,
	`detail` text,
	FOREIGN KEY (`intent_id`) REFERENCES `intents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_log_intent` ON `audit_log` (`intent_id`);--> statement-breakpoint
CREATE INDEX `audit_log_at` ON `audit_log` (`at`);--> statement-breakpoint
CREATE TABLE `daily_spend` (
	`agent_id` text NOT NULL,
	`chain` text NOT NULL,
	`day` text NOT NULL,
	`spent` text DEFAULT '0' NOT NULL,
	PRIMARY KEY(`agent_id`, `chain`, `day`),
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `intents` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`kind` text NOT NULL,
	`chain` text NOT NULL,
	`token` text NOT NULL,
	`amount` text NOT NULL,
	`recipient` text NOT NULL,
	`domain` text,
	`reason` text NOT NULL,
	`status` text NOT NULL,
	`reject_reasons` text NOT NULL,
	`tx_id` text,
	`created_at` text NOT NULL,
	`expires_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `intents_agent_status` ON `intents` (`agent_id`,`status`);--> statement-breakpoint
CREATE INDEX `intents_expires_at` ON `intents` (`expires_at`);--> statement-breakpoint
CREATE TABLE `policies` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`chains` text NOT NULL,
	`tokens` text NOT NULL,
	`per_tx_max` text NOT NULL,
	`daily_max` text NOT NULL,
	`approval_threshold` text NOT NULL,
	`allowed_recipients` text NOT NULL,
	`allowed_domains` text NOT NULL,
	`paused` integer DEFAULT false NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`agent_id`) REFERENCES `agents`(`id`) ON UPDATE no action ON DELETE no action
);
