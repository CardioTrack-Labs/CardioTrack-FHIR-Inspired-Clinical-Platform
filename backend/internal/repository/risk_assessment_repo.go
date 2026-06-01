package repository

import (
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"gorm.io/gorm"
)

type RiskAssessmentRepository struct {
	db *gorm.DB
}

func NewRiskAssessmentRepository() *RiskAssessmentRepository {
	return &RiskAssessmentRepository{db: database.DB}
}

func (r *RiskAssessmentRepository) Create(assessment *models.RiskAssessment) error {
	return r.db.Create(assessment).Error
}

func (r *RiskAssessmentRepository) FindByPatientID(patientID uint) ([]models.RiskAssessment, error) {
	var assessments []models.RiskAssessment
	err := r.db.Preload("CalculatedBy").Where("patient_id = ?", patientID).Order("calculated_at desc").Find(&assessments).Error
	return assessments, err
}
