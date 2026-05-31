-- CardioTrack Schema (PostgreSQL)
-- This file is for human-readable reference and manual migrations.
-- The application uses GORM AutoMigrate for automatic schema synchronization.

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'patient',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE patients (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_of_birth TIMESTAMP WITH TIME ZONE NOT NULL,
    gender VARCHAR(10) NOT NULL,
    medical_record_number VARCHAR(255) UNIQUE NOT NULL,
    blood_type VARCHAR(5),
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(255),
    assigned_doctor_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE observations (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    value DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    recorded_by_id INTEGER NOT NULL REFERENCES users(id),
    recorded_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_abnormal BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_observations_patient_id ON observations(patient_id);
CREATE INDEX idx_observations_type ON observations(type);

CREATE TABLE conditions (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    icd10_code VARCHAR(20) NOT NULL,
    description TEXT NOT NULL,
    onset_date TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL,
    diagnosed_by_id INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_conditions_patient_id ON conditions(patient_id);
CREATE INDEX idx_conditions_icd10_code ON conditions(icd10_code);

CREATE TABLE medications (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    dosage VARCHAR(255) NOT NULL,
    frequency VARCHAR(255) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE,
    prescribed_by_id INTEGER NOT NULL REFERENCES users(id),
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_medications_patient_id ON medications(patient_id);

CREATE TABLE reports (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL,
    file_url TEXT NOT NULL,
    uploaded_by_id INTEGER NOT NULL REFERENCES users(id),
    report_date TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_reports_patient_id ON reports(patient_id);

CREATE TABLE risk_assessments (
    id SERIAL PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    score_type VARCHAR(50) NOT NULL,
    score_value INTEGER NOT NULL,
    risk_category VARCHAR(50) NOT NULL,
    recommendation TEXT,
    calculated_by_id INTEGER NOT NULL REFERENCES users(id),
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX idx_risk_assessments_patient_id ON risk_assessments(patient_id);

CREATE TABLE refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_revoked_at ON refresh_tokens(revoked_at);
