package models

import (
	"time"
)

type Condition struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	PatientID   uint      `gorm:"not null;index" json:"patient_id"`
	Patient     Patient   `gorm:"foreignKey:PatientID" json:"-"`
	ICD10Code   string    `gorm:"type:varchar(20);not null;index" json:"icd10_code"`
	Description string    `gorm:"not null" json:"description"`
	OnsetDate   time.Time `gorm:"not null" json:"onset_date"`
	Status      string    `gorm:"type:varchar(20);not null" json:"status"`
	DiagnosedByID uint    `gorm:"not null" json:"diagnosed_by_id"`
	DiagnosedBy User      `gorm:"foreignKey:DiagnosedByID" json:"-"`
	CreatedAt   time.Time `json:"created_at"`
}
