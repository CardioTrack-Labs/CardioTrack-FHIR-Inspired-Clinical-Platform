package models

import (
	"time"
)

type RiskAssessment struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	PatientID      uint      `gorm:"not null;index" json:"patient_id"`
	Patient        Patient   `gorm:"foreignKey:PatientID" json:"-"`
	ScoreType      string    `gorm:"type:varchar(50);not null" json:"score_type"`
	ScoreValue     int       `gorm:"not null" json:"score_value"`
	RiskCategory   string    `gorm:"type:varchar(50);not null" json:"risk_category"`
	Recommendation string    `gorm:"type:text" json:"recommendation"`
	CalculatedByID uint      `gorm:"not null" json:"calculated_by_id"`
	CalculatedBy   User      `gorm:"foreignKey:CalculatedByID" json:"-"`
	CalculatedAt   time.Time `gorm:"not null" json:"calculated_at"`
}
