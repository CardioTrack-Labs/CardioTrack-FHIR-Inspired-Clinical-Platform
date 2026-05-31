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
