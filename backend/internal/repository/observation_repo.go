package repository

import (
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"gorm.io/gorm"
)

type ObservationRepository struct {
	db *gorm.DB
}

func NewObservationRepository() *ObservationRepository {
	return &ObservationRepository{db: database.DB}
}

func (r *ObservationRepository) Create(observation *models.Observation) error {
	return r.db.Create(observation).Error
}

func (r *ObservationRepository) FindByPatientID(patientID uint) ([]models.Observation, error) {
	var observations []models.Observation
	err := r.db.Preload("RecordedBy").Where("patient_id = ?", patientID).Order("recorded_at desc").Find(&observations).Error
	return observations, err
}

func (r *ObservationRepository) FindByID(id uint) (*models.Observation, error) {
	var observation models.Observation
	err := r.db.Preload("RecordedBy").First(&observation, id).Error
	if err != nil {
		return nil, err
	}
	return &observation, nil
}
