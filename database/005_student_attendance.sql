USE learn_afghan;
-- Development-only additive migration. Import after 004_students.sql.
-- Do not place real learner attendance in this prototype until approved.
CREATE TABLE IF NOT EXISTS student_attendance (
 id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 student_id BIGINT UNSIGNED NOT NULL,
 attendance_date DATE NOT NULL,
 status ENUM('present','absent','late','excused') NOT NULL,
 version INT UNSIGNED NOT NULL DEFAULT 1,
 recorded_by BIGINT UNSIGNED NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_student_attendance_day(student_id,attendance_date),
 INDEX idx_attendance_date_student(attendance_date,student_id),
 CONSTRAINT fk_attendance_student FOREIGN KEY(student_id) REFERENCES students(id),
 CONSTRAINT fk_attendance_actor FOREIGN KEY(recorded_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;
