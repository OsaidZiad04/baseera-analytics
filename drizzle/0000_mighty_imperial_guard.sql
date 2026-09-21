CREATE TABLE `baseera_ai_usage` (
	`owner_id` text PRIMARY KEY NOT NULL,
	`window` integer NOT NULL,
	`count` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `baseera_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`file_name` text NOT NULL,
	`object_key` text NOT NULL,
	`version` integer NOT NULL,
	`revision` integer NOT NULL,
	`rows` integer NOT NULL,
	`sheets` integer NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `baseera_projects_owner` ON `baseera_projects` (`owner_id`,`updated_at`);