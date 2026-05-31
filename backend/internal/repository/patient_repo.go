package repository

import (
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"gorm.io/gorm"
)

type PatientRepository struct {
	db *gorm.DB
}

func NewPatientRepository() *PatientRepository {
	return &PatientRepository{db: database.DB}
}

func (r *PatientRepository) Create(patient *models.Patient) error {
	return r.db.Create(patient).Error
}

func (r *PatientRepository) FindByID(id uint) (*models.Patient, error) {
	var patient models.Patient
	err := r.db.Preload("User").Preload("AssignedDoctor").First(&patient, id).Error
	if err != nil {
		return nil, err
	}
	return &patient, nil
}

func (r *PatientRepository) FindByUserID(userID uint) (*models.Patient, error) {
	var patient models.Patient
	err := r.db.Preload("User").Preload("AssignedDoctor").Where("user_id = ?", userID).First(&patient).Error
	if err != nil {
		return nil, err
	}
	return &patient, nil
}

func (r *PatientRepository) FindAll(doctorID *uint, nameSearch string, mrnSearch string) ([]models.Patient, error) {
	var patients []models.Patient
	query := r.db.Preload("User").Preload("AssignedDoctor")

	if doctorID != nil {
		query = query.Where("assigned_doctor_id = ?", *doctorID)
	}

	if nameSearch != "" {
		// Joins to search in Users table
		query = query.Joins("JOIN users ON users.id = patients.user_id").
			Where("users.name ILIKE ?", "%"+nameSearch+"%")
	}

	if mrnSearch != "" {
		query = query.Where("medical_record_number ILIKE ?", "%"+mrnSearch+"%")
	}

	err := query.Find(&patients).Error
	return patients, err
}

func (r *PatientRepository) Update(patient *models.Patient) error {
	return r.db.Save(patient).Error
}
