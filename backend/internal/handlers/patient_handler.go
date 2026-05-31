package handlers

import (
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/AthanasiosChlr/cardiotrack/internal/dto"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"github.com/AthanasiosChlr/cardiotrack/internal/repository"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type PatientHandler struct {
	patientRepo *repository.PatientRepository
}

func NewPatientHandler() *PatientHandler {
	return &PatientHandler{
		patientRepo: repository.NewPatientRepository(),
	}
}

func (h *PatientHandler) CreatePatient(c *gin.Context) {
	var req dto.CreatePatientRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dob, err := time.Parse("2006-01-02", req.DateOfBirth)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format, use YYYY-MM-DD"})
		return
	}

	patient := &models.Patient{
		UserID:                req.UserID,
		DateOfBirth:           dob,
		Gender:                req.Gender,
		MedicalRecordNumber:   req.MedicalRecordNumber,
		BloodType:             req.BloodType,
		EmergencyContactName:  req.EmergencyContactName,
		EmergencyContactPhone: req.EmergencyContactPhone,
		AssignedDoctorID:      req.AssignedDoctorID,
	}

	if err := h.patientRepo.Create(patient); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create patient profile"})
		return
	}

	c.JSON(http.StatusCreated, mapPatientToResponse(patient))
}

func (h *PatientHandler) GetPatient(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid ID"})
		return
	}

	patient, err := h.patientRepo.FindByID(uint(id))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	// RBAC enforcement for patients viewing their own profile
	if enforceUserID, exists := c.Get("enforce_patient_user_id"); exists {
		if patient.UserID != enforceUserID.(uint) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
			return
		}
	}

	// RBAC enforcement for doctors viewing their assigned patients
	if enforceDoctorID, exists := c.Get("enforce_doctor_id"); exists {
		if patient.AssignedDoctorID == nil || *patient.AssignedDoctorID != enforceDoctorID.(uint) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Patient not assigned to you"})
			return
		}
	}

	c.JSON(http.StatusOK, mapPatientToResponse(patient))
}

func (h *PatientHandler) ListPatients(c *gin.Context) {
	nameSearch := c.Query("name")
	mrnSearch := c.Query("mrn")
	doctorIDStr := c.Query("doctor_id")

	var filterDoctorID *uint

	// RBAC for doctors
	if enforceDoctorID, exists := c.Get("enforce_doctor_id"); exists {
		docID := enforceDoctorID.(uint)
		filterDoctorID = &docID
	} else if doctorIDStr != "" {
		id, err := strconv.ParseUint(doctorIDStr, 10, 32)
		if err == nil {
			docID := uint(id)
			filterDoctorID = &docID
		}
	}

	patients, err := h.patientRepo.FindAll(filterDoctorID, nameSearch, mrnSearch)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch patients"})
		return
	}

	var responses []dto.PatientResponse
	for _, p := range patients {
		responses = append(responses, mapPatientToResponse(&p))
	}

	c.JSON(http.StatusOK, responses)
}

func mapPatientToResponse(p *models.Patient) dto.PatientResponse {
	resp := dto.PatientResponse{
		ID:                    p.ID,
		UserID:                p.UserID,
		DateOfBirth:           p.DateOfBirth.Format("2006-01-02"),
		Gender:                p.Gender,
		MedicalRecordNumber:   p.MedicalRecordNumber,
		BloodType:             p.BloodType,
		EmergencyContactName:  p.EmergencyContactName,
		EmergencyContactPhone: p.EmergencyContactPhone,
		CreatedAt:             p.CreatedAt,
		UpdatedAt:             p.UpdatedAt,
	}

	if p.User.ID != 0 {
		resp.User = &dto.UserResponse{
			ID:        p.User.ID,
			Email:     p.User.Email,
			Name:      p.User.Name,
			Role:      p.User.Role,
			CreatedAt: p.User.CreatedAt,
		}
	}

	if p.AssignedDoctor != nil {
		resp.AssignedDoctor = &dto.UserResponse{
			ID:        p.AssignedDoctor.ID,
			Email:     p.AssignedDoctor.Email,
			Name:      p.AssignedDoctor.Name,
			Role:      p.AssignedDoctor.Role,
			CreatedAt: p.AssignedDoctor.CreatedAt,
		}
	}

	return resp
}
