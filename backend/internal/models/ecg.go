package models

import (
	"time"
)

type ECGRecord struct {
	ID               uint          `gorm:"primaryKey" json:"id"`
	PatientID        uint          `gorm:"not null;index" json:"patient_id"`
	Patient          Patient       `gorm:"foreignKey:PatientID" json:"-"`
	FileURL          string        `gorm:"type:text;not null" json:"file_url"`
	UploadedByID     uint          `gorm:"not null" json:"uploaded_by_id"`
	UploadedBy       User          `gorm:"foreignKey:UploadedByID" json:"-"`
	RecordedAt       time.Time     `gorm:"not null" json:"recorded_at"`
	ProcessingStatus string        `gorm:"type:varchar(20);not null;default:'pending'" json:"processing_status"` // pending, processing, done, failed
	CreatedAt        time.Time     `json:"created_at"`
	Analysis         *ECGAnalysis  `gorm:"foreignKey:ECGRecordID" json:"analysis,omitempty"`
}

type ECGAnalysis struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	ECGRecordID       uint      `gorm:"not null;uniqueIndex" json:"ecg_record_id"`
	HeartRateMean     float64   `gorm:"type:decimal(6,2);not null" json:"heart_rate_mean"`
	HeartRateMin      float64   `gorm:"type:decimal(6,2);not null" json:"heart_rate_min"`
	HeartRateMax      float64   `gorm:"type:decimal(6,2);not null" json:"heart_rate_max"`
	SDNN              float64   `gorm:"type:decimal(6,2);not null" json:"sdnn"`  // HRV SDNN in ms
	RMSSD             float64   `gorm:"type:decimal(6,2);not null" json:"rmssd"` // HRV RMSSD in ms
	PNN50             float64   `gorm:"type:decimal(6,2);not null" json:"pnn50"` // HRV pNN50 in %
	RPeaksCount       int       `gorm:"not null" json:"r_peaks_count"`
	HRVInterpretation string    `gorm:"type:varchar(20);not null" json:"hrv_interpretation"` // normal, reduced, poor
	AnalysisJSON      string    `gorm:"type:text" json:"analysis_json"`                      // Complete raw analysis data
	AnalyzedAt        time.Time `json:"analyzed_at"`
}
