-- CardioTrack Seed Data (PostgreSQL)
-- Human-readable SQL inserts corresponding to the internal/seed/seed.go logic.
-- Note: Passwords below are raw texts and NOT bcrypt hashes, so do not use this file
-- directly in production. This is for reference or testing where auth might be bypassed.
-- In reality, seed.go hashes these passwords before inserting.

INSERT INTO users (email, password_hash, name, role) VALUES 
('admin@cardiotrack.dev', 'admin123', 'System Admin', 'admin'),
('dr.smith@cardiotrack.dev', 'doctor123', 'Dr. Smith', 'doctor'),
('dr.jones@cardiotrack.dev', 'doctor123', 'Dr. Jones', 'doctor'),
('dr.cardio@cardiotrack.dev', 'doctor123', 'Dr. Cardio', 'cardiologist'),
('patient1@cardiotrack.dev', 'patient123', 'John Doe', 'patient'),
('patient2@cardiotrack.dev', 'patient123', 'Jane Smith', 'patient');

-- Assume IDs map sequentially from 1 to 6
INSERT INTO patients (user_id, date_of_birth, gender, medical_record_number, blood_type, assigned_doctor_id) VALUES
(5, '1980-05-15', 'Male', 'MRN-001', 'O+', 2),
(6, '1992-08-22', 'Female', 'MRN-002', 'A-', 3);

INSERT INTO observations (patient_id, type, value, unit, recorded_by_id, recorded_at, is_abnormal, notes) VALUES
(1, 'Blood Pressure', 120.5, 'mmHg', 2, CURRENT_TIMESTAMP, false, 'Normal reading');

INSERT INTO conditions (patient_id, icd10_code, description, onset_date, status, diagnosed_by_id) VALUES
(1, 'I10', 'Essential (primary) hypertension', CURRENT_TIMESTAMP - INTERVAL '1 year', 'active', 2);
