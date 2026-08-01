CREATE TABLE `shared_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_user_id` text NOT NULL,
	`profile_name` text NOT NULL,
	`description` text NOT NULL DEFAULT '',
	`author_name` text NOT NULL,
	`tags_json` text NOT NULL DEFAULT '[]',
	`file_data` blob NOT NULL,
	`file_size` integer NOT NULL,
	`created_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text NOT NULL DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `shared_profile_tags` (
	`profile_id` text NOT NULL,
	`tag` text NOT NULL,
	`tag_normalized` text NOT NULL,
	PRIMARY KEY(`profile_id`, `tag_normalized`),
	FOREIGN KEY (`profile_id`) REFERENCES `shared_profiles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `shared_profiles_created_at_idx` ON `shared_profiles` (`created_at`);
--> statement-breakpoint
CREATE INDEX `shared_profiles_owner_created_idx` ON `shared_profiles` (`owner_user_id`, `created_at`);
--> statement-breakpoint
CREATE INDEX `shared_profile_tags_normalized_idx` ON `shared_profile_tags` (`tag_normalized`, `profile_id`);
--> statement-breakpoint
PRAGMA optimize;
