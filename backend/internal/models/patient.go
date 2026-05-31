package models

import (
	"time"
)

type Patient struct {
	ID                    uint      `gorm:"primaryKey" json:"id"`
	UserID                uint      `gorm:"uniqueIndex;not null" json:"user_id"`
	User                  User      `gorm:"foreignKey:UserID" json:"-"`
	DateOfBirth           time.Time `gorm:"not null" json:"date_of_birth"`
	Gender                string    `gorm:"type:varchar(10);not null" json:"gender"`
	MedicalRecordNumber   string    `gorm:"uniqueIndex;not null" json:"medical_record_number"`
	BloodType             string    `gorm:"type:varchar(5)" json:"blood_type"`
	EmergencyContactName  string    `json:"emergency_contact_name"`
	EmergencyContactPhone string    `json:"emergency_contact_phone"`
	AssignedDoctorID      *uint     `json:"assigned_doctor_id"`
	AssignedDoctor        *User     `gorm:"foreignKey:AssignedDoctorID" json:"-"`
	CreatedAt             time.Time `json:"created_at"`
	UpdatedAt             time.Time `json:"updated_at"`
}
