USE learn_afghan;
-- Development-only additive migration. Apply after 005_student_attendance.sql.
-- No real or sample personnel records are seeded.
CREATE TABLE IF NOT EXISTS personnel_attendance (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 personnel_id BIGINT UNSIGNED NOT NULL,
 attendance_date DATE NOT NULL,
 status ENUM('present','absent','late','excused') NOT NULL,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 recorded_by BIGINT UNSIGNED NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_personnel_day (personnel_id, attendance_date),
 INDEX idx_personnel_attendance_day (attendance_date, personnel_id),
 CONSTRAINT fk_personnel_attendance_personnel FOREIGN KEY (personnel_id) REFERENCES personnel(id),
 CONSTRAINT fk_personnel_attendance_actor FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
