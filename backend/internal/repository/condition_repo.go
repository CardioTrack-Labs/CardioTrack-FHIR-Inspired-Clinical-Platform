package repository

import (
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"gorm.io/gorm"
)

type ConditionRepository struct {
	db *gorm.DB
}

func NewConditionRepository() *ConditionRepository {
	return &ConditionRepository{db: database.DB}
}

func (r *ConditionRepository) Create(condition *models.Condition) error {
	return r.db.Create(condition).Error
}

func (r *ConditionRepository) FindByPatientID(patientID uint) ([]models.Condition, error) {
	var conditions []models.Condition
	err := r.db.Preload("DiagnosedBy").Where("patient_id = ?", patientID).Order("onset_date desc").Find(&conditions).Error
	return conditions, err
}

func (r *ConditionRepository) FindByID(id uint) (*models.Condition, error) {
	var condition models.Condition
	err := r.db.Preload("DiagnosedBy").First(&condition, id).Error
	if err != nil {
		return nil, err
	}
	return &condition, nil
}
