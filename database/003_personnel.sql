USE learn_afghan;
CREATE TABLE IF NOT EXISTS personnel (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 code VARCHAR(45) NOT NULL UNIQUE,
 full_name VARCHAR(180) NOT NULL,
 kind ENUM('teacher','staff') NOT NULL,
 branch_id INT UNSIGNED NOT NULL,
 department_id INT UNSIGNED NOT NULL,
 job_title VARCHAR(180) NOT NULL,
 status ENUM('active','inactive') NOT NULL DEFAULT 'active',
 version INT UNSIGNED NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(branch_id) REFERENCES branches(id),
 FOREIGN KEY(department_id) REFERENCES departments(id),
 INDEX idx_personnel_branch_kind(branch_id,kind),
 INDEX idx_personnel_department(department_id)
);
-- This registry does not create login accounts. No personal records are seeded.
