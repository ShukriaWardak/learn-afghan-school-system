-- Add the class register to the database selected for this installation.
CREATE TABLE IF NOT EXISTS class_register (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 branch_id INT UNSIGNED NOT NULL,
 academic_year SMALLINT UNSIGNED NOT NULL,
 grade_level TINYINT UNSIGNED NOT NULL,
 section VARCHAR(40) NOT NULL,
 active TINYINT(1) NOT NULL DEFAULT 1,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 UNIQUE KEY uq_class_section (branch_id,academic_year,grade_level,section),
 FOREIGN KEY (branch_id) REFERENCES branches(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
