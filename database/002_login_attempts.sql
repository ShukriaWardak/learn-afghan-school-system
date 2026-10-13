USE learn_afghan;
CREATE TABLE IF NOT EXISTS login_attempts (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 username VARCHAR(100) NOT NULL,
 ip_hash CHAR(64) NOT NULL,
 attempted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 INDEX idx_login_username_time (username, attempted_at),
 INDEX idx_login_ip_time (ip_hash, attempted_at)
) ENGINE=InnoDB;
-- Purge old records periodically (e.g. retain 7 days).
