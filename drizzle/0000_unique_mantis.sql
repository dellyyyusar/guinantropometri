CREATE TABLE `antro_anthropometric_reference` (
	`id` int AUTO_INCREMENT NOT NULL,
	`indicator` enum('BB_U','PB_U','TB_U','BB_PB','BB_TB','IMT_U_PB','IMT_U_TB') NOT NULL,
	`gender` enum('L','P') NOT NULL,
	`age_month` decimal(5,1) NOT NULL DEFAULT -1,
	`measurement_cm` decimal(5,1) NOT NULL DEFAULT -1,
	`minus_3sd` decimal(6,2) NOT NULL,
	`minus_2sd` decimal(6,2) NOT NULL,
	`minus_1sd` decimal(6,2) NOT NULL,
	`median` decimal(6,2) NOT NULL,
	`plus_1sd` decimal(6,2) NOT NULL,
	`plus_2sd` decimal(6,2) NOT NULL,
	`plus_3sd` decimal(6,2) NOT NULL,
	`l` decimal(9,5),
	`m` decimal(9,5),
	`s` decimal(9,5),
	`source_table` varchar(64) NOT NULL,
	`source_document` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `antro_anthropometric_reference_id` PRIMARY KEY(`id`),
	CONSTRAINT `reference_lookup_uq` UNIQUE(`indicator`,`gender`,`age_month`,`measurement_cm`)
);
--> statement-breakpoint
CREATE TABLE `antro_anthropometric_results` (
	`id` int AUTO_INCREMENT NOT NULL,
	`measurement_id` int NOT NULL,
	`weight_for_age_z` decimal(6,2),
	`weight_for_age_status` varchar(64) NOT NULL,
	`length_height_for_age_z` decimal(6,2),
	`length_height_for_age_status` varchar(64) NOT NULL,
	`weight_for_length_height_z` decimal(6,2),
	`weight_for_length_height_status` varchar(64) NOT NULL,
	`bmi_for_age_z` decimal(6,2),
	`bmi_for_age_status` varchar(64) NOT NULL,
	`overall_status` varchar(64) NOT NULL,
	`calculation_version` varchar(32) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `antro_anthropometric_results_id` PRIMARY KEY(`id`),
	CONSTRAINT `anthropometric_results_measurement_uq` UNIQUE(`measurement_id`)
);
--> statement-breakpoint
CREATE TABLE `antro_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`entity` varchar(32) NOT NULL,
	`entity_id` varchar(64) NOT NULL,
	`action` enum('CREATE','UPDATE','DELETE') NOT NULL,
	`old_data` json,
	`new_data` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `antro_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `antro_children` (
	`id` int AUTO_INCREMENT NOT NULL,
	`child_code` varchar(32) NOT NULL,
	`name` varchar(100) NOT NULL,
	`gender` enum('L','P') NOT NULL,
	`date_of_birth` date NOT NULL,
	`birth_weight` decimal(5,3),
	`birth_length` decimal(5,2),
	`mother_name` varchar(100),
	`father_name` varchar(100),
	`address` varchar(255),
	`notes` text,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `antro_children_id` PRIMARY KEY(`id`),
	CONSTRAINT `children_child_code_uq` UNIQUE(`child_code`)
);
--> statement-breakpoint
CREATE TABLE `antro_measurements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`child_id` int NOT NULL,
	`measurement_date` date NOT NULL,
	`weight_kg` decimal(5,3) NOT NULL,
	`raw_length_height_cm` decimal(5,2),
	`measurement_method` enum('STANDING','LYING') NOT NULL,
	`corrected_length_height_cm` decimal(5,2),
	`age_year` smallint NOT NULL,
	`age_month` smallint NOT NULL,
	`age_day` smallint NOT NULL,
	`age_total_months` decimal(6,2) NOT NULL,
	`bmi` decimal(6,2),
	`notes` text,
	`created_by` int,
	`updated_by` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `antro_measurements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `antro_sessions` (
	`id` varchar(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `antro_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `antro_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`email` varchar(190) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('admin','petugas') NOT NULL DEFAULT 'petugas',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `antro_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uq` UNIQUE(`email`)
);
--> statement-breakpoint
ALTER TABLE `antro_anthropometric_results` ADD CONSTRAINT `fk_results_measurement` FOREIGN KEY (`measurement_id`) REFERENCES `antro_measurements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `antro_audit_logs` ADD CONSTRAINT `fk_audit_user` FOREIGN KEY (`user_id`) REFERENCES `antro_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `antro_children` ADD CONSTRAINT `fk_children_created_by` FOREIGN KEY (`created_by`) REFERENCES `antro_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `antro_children` ADD CONSTRAINT `fk_children_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `antro_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `antro_measurements` ADD CONSTRAINT `fk_measurements_child` FOREIGN KEY (`child_id`) REFERENCES `antro_children`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `antro_measurements` ADD CONSTRAINT `fk_measurements_created_by` FOREIGN KEY (`created_by`) REFERENCES `antro_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `antro_measurements` ADD CONSTRAINT `fk_measurements_updated_by` FOREIGN KEY (`updated_by`) REFERENCES `antro_users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `antro_sessions` ADD CONSTRAINT `fk_sessions_user` FOREIGN KEY (`user_id`) REFERENCES `antro_users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `anthropometric_results_overall_idx` ON `antro_anthropometric_results` (`overall_status`);--> statement-breakpoint
CREATE INDEX `audit_logs_entity_idx` ON `antro_audit_logs` (`entity`,`entity_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_user_idx` ON `antro_audit_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `audit_logs_created_at_idx` ON `antro_audit_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `children_name_idx` ON `antro_children` (`name`);--> statement-breakpoint
CREATE INDEX `children_date_of_birth_idx` ON `antro_children` (`date_of_birth`);--> statement-breakpoint
CREATE INDEX `measurements_child_date_idx` ON `antro_measurements` (`child_id`,`measurement_date`);--> statement-breakpoint
CREATE INDEX `measurements_measurement_date_idx` ON `antro_measurements` (`measurement_date`);--> statement-breakpoint
CREATE INDEX `sessions_user_id_idx` ON `antro_sessions` (`user_id`);