package repository

import (
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"gorm.io/gorm"
)

type ReportRepository struct {
	db *gorm.DB
}

func NewReportRepository() *ReportRepository {
	return &ReportRepository{db: database.DB}
}

func (r *ReportRepository) Create(report *models.Report) error {
	return r.db.Create(report).Error
}

func (r *ReportRepository) FindByPatientID(patientID uint) ([]models.Report, error) {
	var reports []models.Report
	err := r.db.Preload("UploadedBy").Where("patient_id = ?", patientID).Order("report_date desc").Find(&reports).Error
	return reports, err
}

func (r *ReportRepository) FindByID(id uint) (*models.Report, error) {
	var report models.Report
	err := r.db.Preload("UploadedBy").First(&report, id).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}
