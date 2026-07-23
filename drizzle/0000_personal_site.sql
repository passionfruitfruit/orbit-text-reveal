CREATE TABLE `admin_sessions` (
	`token_digest` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`revoked_at` integer
);
--> statement-breakpoint
CREATE INDEX `admin_sessions_expires_idx` ON `admin_sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `blog_posts` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`markdown` text,
	`external_url` text,
	`cover_url` text,
	`published_at` integer NOT NULL,
	`visible` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`parent_id` text,
	`root_id` text NOT NULL,
	`nickname` text NOT NULL,
	`body` text NOT NULL,
	`contact` text,
	`visitor_allows_public` integer DEFAULT false NOT NULL,
	`approved` integer DEFAULT false NOT NULL,
	`author_role` text DEFAULT 'visitor' NOT NULL,
	`deleted_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `comments_root_parent_idx` ON `comments` (`root_id`,`parent_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `comments_moderation_idx` ON `comments` (`approved`,`deleted_at`,`created_at`);--> statement-breakpoint
CREATE TABLE `content_items` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`external_id` text,
	`source_id` text,
	`blog_id` text,
	`title` text NOT NULL,
	`summary` text NOT NULL,
	`url` text NOT NULL,
	`image_url` text,
	`published_at` integer NOT NULL,
	`external_updated_at` integer,
	`stats_json` text,
	`visible` integer DEFAULT true NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`source_missing` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`source_id`) REFERENCES `source_accounts`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`blog_id`) REFERENCES `blog_posts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `content_platform_external_idx` ON `content_items` (`platform`,`external_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `content_blog_idx` ON `content_items` (`blog_id`);--> statement-breakpoint
CREATE INDEX `content_public_order_idx` ON `content_items` (`visible`,`sort_order`,`published_at`,`id`);--> statement-breakpoint
CREATE INDEX `content_source_idx` ON `content_items` (`source_id`,`source_missing`);--> statement-breakpoint
CREATE TABLE `site_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `source_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`platform` text NOT NULL,
	`account` text NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`last_attempt_at` integer,
	`last_success_at` integer,
	`last_error` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `source_platform_account_idx` ON `source_accounts` (`platform`,`account`);--> statement-breakpoint
CREATE INDEX `source_enabled_idx` ON `source_accounts` (`enabled`);--> statement-breakpoint
CREATE TABLE `submission_limits` (
	`key_digest` text NOT NULL,
	`kind` text NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`key_digest`, `kind`, `window_start`)
);
--> statement-breakpoint
CREATE INDEX `submission_limits_window_idx` ON `submission_limits` (`window_start`);