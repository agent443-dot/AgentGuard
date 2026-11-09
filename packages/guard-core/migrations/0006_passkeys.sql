CREATE TABLE `passkey_challenges` (
	`purpose` text PRIMARY KEY NOT NULL,
	`challenge` text NOT NULL,
	`expires_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `passkeys` (
	`id` text PRIMARY KEY NOT NULL,
	`public_key` text NOT NULL,
	`counter` integer NOT NULL,
	`transports` text NOT NULL,
	`created_at` text NOT NULL
);
