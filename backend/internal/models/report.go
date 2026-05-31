package models

import (
	"time"
)

type Report struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	PatientID  uint      `gorm:"not null;index" json:"patient_id"`
	Patient    Patient   `gorm:"foreignKey:PatientID" json:"-"`
	Title      string    `gorm:"not null" json:"title"`
	ReportType string    `gorm:"type:varchar(50);not null" json:"report_type"`
	FileURL    string    `gorm:"not null" json:"file_url"`
	UploadedByID uint    `gorm:"not null" json:"uploaded_by_id"`
	UploadedBy User      `gorm:"foreignKey:UploadedByID" json:"-"`
	ReportDate time.Time `gorm:"not null" json:"report_date"`
	CreatedAt  time.Time `json:"created_at"`
}
