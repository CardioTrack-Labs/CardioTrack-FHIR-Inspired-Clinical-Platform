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
