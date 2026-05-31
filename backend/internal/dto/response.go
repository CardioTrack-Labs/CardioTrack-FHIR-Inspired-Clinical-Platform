package dto

import "time"

type UserResponse struct {
	ID        uint      `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
}

type TokenResponse struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
}

type AuthResponse struct {
	User   UserResponse  `json:"user"`
	Tokens TokenResponse `json:"tokens"`
}

type PatientResponse struct {
	ID                    uint          `json:"id"`
	UserID                uint          `json:"user_id"`
	User                  *UserResponse `json:"user,omitempty"`
	DateOfBirth           string        `json:"date_of_birth"`
	Gender                string        `json:"gender"`
	MedicalRecordNumber   string        `json:"medical_record_number"`
	BloodType             string        `json:"blood_type,omitempty"`
	EmergencyContactName  string        `json:"emergency_contact_name,omitempty"`
	EmergencyContactPhone string        `json:"emergency_contact_phone,omitempty"`
	AssignedDoctor        *UserResponse `json:"assigned_doctor,omitempty"`
	CreatedAt             time.Time     `json:"created_at"`
	UpdatedAt             time.Time     `json:"updated_at"`
}

type ObservationResponse struct {
	ID         uint          `json:"id"`
	PatientID  uint          `json:"patient_id"`
	Type       string        `json:"type"`
	Value      float64       `json:"value"`
	Unit       string        `json:"unit"`
	RecordedBy *UserResponse `json:"recorded_by,omitempty"`
	RecordedAt time.Time     `json:"recorded_at"`
	IsAbnormal bool          `json:"is_abnormal"`
	Notes      string        `json:"notes,omitempty"`
	CreatedAt  time.Time     `json:"created_at"`
}

type ConditionResponse struct {
	ID          uint          `json:"id"`
	PatientID   uint          `json:"patient_id"`
	ICD10Code   string        `json:"icd10_code"`
	Description string        `json:"description"`
	OnsetDate   string        `json:"onset_date"`
	Status      string        `json:"status"`
	DiagnosedBy *UserResponse `json:"diagnosed_by,omitempty"`
	CreatedAt   time.Time     `json:"created_at"`
}

type MedicationResponse struct {
	ID           uint          `json:"id"`
	PatientID    uint          `json:"patient_id"`
	Name         string        `json:"name"`
	Dosage       string        `json:"dosage"`
	Frequency    string        `json:"frequency"`
	StartDate    string        `json:"start_date"`
	EndDate      *string       `json:"end_date,omitempty"`
	PrescribedBy *UserResponse `json:"prescribed_by,omitempty"`
	Status       string        `json:"status"`
	CreatedAt    time.Time     `json:"created_at"`
}
