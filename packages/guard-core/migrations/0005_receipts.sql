CREATE TABLE `clearances` (
	`intent_id` text PRIMARY KEY NOT NULL,
	`policy_hash` text NOT NULL,
	`simulation` text NOT NULL,
	`approved_by` text NOT NULL,
	FOREIGN KEY (`intent_id`) REFERENCES `intents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `owner_approvals` (
	`intent_id` text PRIMARY KEY NOT NULL,
	`method` text NOT NULL,
	FOREIGN KEY (`intent_id`) REFERENCES `intents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`intent_id` text PRIMARY KEY NOT NULL,
	`issued_at` text NOT NULL,
	`body` text NOT NULL,
	FOREIGN KEY (`intent_id`) REFERENCES `intents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `receipts_issued_at` ON `receipts` (`issued_at`);