-- Apply AFTER database/schema.sql and database/002_login_attempts.sql.
-- Creates empty organizational directories; no names or personnel records are seeded.
USE learn_afghan;

CREATE TABLE IF NOT EXISTS teacher_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    display_name VARCHAR(180) NOT NULL,
    branch_id INT UNSIGNED NOT NULL,
    status ENUM('pending','active','inactive') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_teacher_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
    INDEX idx_teacher_branch (branch_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS staff_records (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(30) NOT NULL UNIQUE,
    display_name VARCHAR(180) NOT NULL,
    department_id INT UNSIGNED NOT NULL,
    branch_id INT UNSIGNED NULL,
    status ENUM('pending','active','inactive') NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_staff_department FOREIGN KEY (department_id) REFERENCES departments(id),
    CONSTRAINT fk_staff_branch FOREIGN KEY (branch_id) REFERENCES branches(id),
    INDEX idx_staff_branch (branch_id),
    INDEX idx_staff_department (department_id)
) ENGINE=InnoDB;
