package repository

import (
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"gorm.io/gorm"
)

type ECGRepository struct {
	db *gorm.DB
}

func NewECGRepository() *ECGRepository {
	return &ECGRepository{db: database.DB}
}

func (r *ECGRepository) Create(record *models.ECGRecord) error {
	return r.db.Create(record).Error
}

func (r *ECGRepository) FindByPatientID(patientID uint) ([]models.ECGRecord, error) {
	var records []models.ECGRecord
	err := r.db.Preload("Analysis").Where("patient_id = ?", patientID).Order("recorded_at desc").Find(&records).Error
	return records, err
}

func (r *ECGRepository) FindByID(id uint) (*models.ECGRecord, error) {
	var record models.ECGRecord
	err := r.db.Preload("Analysis").First(&record, id).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *ECGRepository) UpdateStatus(id uint, status string) error {
	return r.db.Model(&models.ECGRecord{}).Where("id = ?", id).Update("processing_status", status).Error
}

func (r *ECGRepository) CreateAnalysis(analysis *models.ECGAnalysis) error {
	return r.db.Create(analysis).Error
}
