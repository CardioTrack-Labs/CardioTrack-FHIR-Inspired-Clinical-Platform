package dto

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Name     string `json:"name" binding:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token" binding:"required"`
}

type CreatePatientRequest struct {
	UserID                uint   `json:"user_id" binding:"required"`
	DateOfBirth           string `json:"date_of_birth" binding:"required"` // YYYY-MM-DD
	Gender                string `json:"gender" binding:"required"`
	MedicalRecordNumber   string `json:"medical_record_number" binding:"required"`
	BloodType             string `json:"blood_type"`
	EmergencyContactName  string `json:"emergency_contact_name"`
	EmergencyContactPhone string `json:"emergency_contact_phone"`
	AssignedDoctorID      *uint  `json:"assigned_doctor_id"`
}

type CreateObservationRequest struct {
	Type       string  `json:"type" binding:"required"`
	Value      float64 `json:"value" binding:"required"`
	Unit       string  `json:"unit" binding:"required"`
	RecordedAt string  `json:"recorded_at"` // RFC3339
	Notes      string  `json:"notes"`
}

type CreateConditionRequest struct {
	ICD10Code   string `json:"icd10_code" binding:"required"`
	Description string `json:"description" binding:"required"`
	OnsetDate   string `json:"onset_date" binding:"required"` // YYYY-MM-DD
	Status      string `json:"status" binding:"required"`     // active, resolved, etc.
}

type CreateMedicationRequest struct {
	Name      string `json:"name" binding:"required"`
	Dosage    string `json:"dosage" binding:"required"`
	Frequency string `json:"frequency" binding:"required"`
	StartDate string `json:"start_date" binding:"required"` // YYYY-MM-DD
	EndDate   string `json:"end_date"`                      // YYYY-MM-DD
	Status    string `json:"status" binding:"required"`     // active, discontinued
}

type CreateRiskAssessmentRequest struct {
	ScoreType      string `json:"score_type" binding:"required"`
	ScoreValue     int    `json:"score_value"`
	RiskCategory   string `json:"risk_category" binding:"required"`
	Recommendation string `json:"recommendation"`
}

