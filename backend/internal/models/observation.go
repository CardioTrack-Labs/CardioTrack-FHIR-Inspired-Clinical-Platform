package models

import (
	"time"
)

type Observation struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	PatientID  uint      `gorm:"not null;index" json:"patient_id"`
	Patient    Patient   `gorm:"foreignKey:PatientID" json:"-"`
	Type       string    `gorm:"type:varchar(50);not null;index" json:"type"`
	Value      float64   `gorm:"type:decimal(10,2);not null" json:"value"`
	Unit       string    `gorm:"type:varchar(20);not null" json:"unit"`
	RecordedByID uint    `gorm:"not null" json:"recorded_by_id"`
	RecordedBy User      `gorm:"foreignKey:RecordedByID" json:"-"`
	RecordedAt time.Time `gorm:"not null" json:"recorded_at"`
	IsAbnormal bool      `gorm:"not null;default:false" json:"is_abnormal"`
	Notes      string    `gorm:"type:text" json:"notes"`
	CreatedAt  time.Time `json:"created_at"`
}
