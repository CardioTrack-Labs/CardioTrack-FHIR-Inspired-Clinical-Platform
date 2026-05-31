package models

import (
	"time"
)

type Medication struct {
	ID            uint       `gorm:"primaryKey" json:"id"`
	PatientID     uint       `gorm:"not null;index" json:"patient_id"`
	Patient       Patient    `gorm:"foreignKey:PatientID" json:"-"`
	Name          string     `gorm:"not null" json:"name"`
	Dosage        string     `gorm:"not null" json:"dosage"`
	Frequency     string     `gorm:"not null" json:"frequency"`
	StartDate     time.Time  `gorm:"not null" json:"start_date"`
	EndDate       *time.Time `json:"end_date"`
	PrescribedByID uint      `gorm:"not null" json:"prescribed_by_id"`
	PrescribedBy  User       `gorm:"foreignKey:PrescribedByID" json:"-"`
	Status        string     `gorm:"type:varchar(20);not null" json:"status"`
	CreatedAt     time.Time  `json:"created_at"`
}
