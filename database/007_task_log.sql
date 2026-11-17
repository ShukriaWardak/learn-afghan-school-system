USE learn_afghan;
-- Additive development migration; apply after 006. No accounts or task records seeded.
CREATE TABLE IF NOT EXISTS task_log (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 owner_user_id BIGINT UNSIGNED NOT NULL,
 task_date DATE NOT NULL,
 title VARCHAR(180) NOT NULL,
 description TEXT NOT NULL,
 due_date DATE NULL,
 status ENUM('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
 progress_notes TEXT NOT NULL,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 FOREIGN KEY(owner_user_id) REFERENCES users(id),
 INDEX idx_task_owner_date(owner_user_id,task_date)
);
