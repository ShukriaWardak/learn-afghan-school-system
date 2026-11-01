USE learn_afghan;
-- Apply after schema.sql, 002_login_attempts.sql, and 003_personnel.sql.
-- No student records are seeded.
CREATE TABLE IF NOT EXISTS students (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 student_code VARCHAR(45) NOT NULL UNIQUE,
 full_name VARCHAR(180) NOT NULL,
 branch_id INT UNSIGNED NOT NULL,
 grade_level VARCHAR(40) NOT NULL,
 status ENUM('active','inactive','graduated') NOT NULL DEFAULT 'active',
 version INT UNSIGNED NOT NULL DEFAULT 1,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 CONSTRAINT fk_student_branch FOREIGN KEY(branch_id) REFERENCES branches(id),
 INDEX idx_students_branch_status(branch_id,status)
);
