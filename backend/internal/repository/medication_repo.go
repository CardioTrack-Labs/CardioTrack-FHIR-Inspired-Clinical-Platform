package repository

import (
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"gorm.io/gorm"
)

type MedicationRepository struct {
	db *gorm.DB
}

func NewMedicationRepository() *MedicationRepository {
	return &MedicationRepository{db: database.DB}
}

func (r *MedicationRepository) Create(medication *models.Medication) error {
	return r.db.Create(medication).Error
}

func (r *MedicationRepository) FindByPatientID(patientID uint) ([]models.Medication, error) {
	var medications []models.Medication
	err := r.db.Preload("PrescribedBy").Where("patient_id = ?", patientID).Order("start_date desc").Find(&medications).Error
	return medications, err
}

func (r *MedicationRepository) FindByID(id uint) (*models.Medication, error) {
	var medication models.Medication
	err := r.db.Preload("PrescribedBy").First(&medication, id).Error
	if err != nil {
		return nil, err
	}
	return &medication, nil
}
