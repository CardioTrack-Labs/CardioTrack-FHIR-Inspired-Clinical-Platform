package handlers

import (
	"errors"
	"fmt"
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
	userRepo    *repository.UserRepository
}

func NewPatientHandler() *PatientHandler {
	return &PatientHandler{
		patientRepo: repository.NewPatientRepository(),
		userRepo:    repository.NewUserRepository(),
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

// GetMyProfile returns the patient record for the currently logged-in patient user.
// This endpoint is accessible to all authenticated users (patient role included).
// It resolves the patient by matching patients.user_id = JWT user_id.
func (h *PatientHandler) GetMyProfile(c *gin.Context) {
	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := userIDVal.(uint)

	patient, err := h.patientRepo.FindByUserID(userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Auto-generation fallback: Check if user has the patient role
			user, userErr := h.userRepo.FindByID(userID)
			if userErr == nil && user != nil && user.Role == "patient" {
				newPatient := &models.Patient{
					UserID:              userID,
					DateOfBirth:         time.Date(1990, 1, 1, 0, 0, 0, 0, time.UTC),
					Gender:              "other",
					MedicalRecordNumber: fmt.Sprintf("MRN-%d", time.Now().UnixNano()%100000000),
				}
				if createErr := h.patientRepo.Create(newPatient); createErr == nil {
					// Retrieve the completed object with all relation fields preloaded
					if preloadedPatient, reloadErr := h.patientRepo.FindByUserID(userID); reloadErr == nil {
						c.JSON(http.StatusOK, mapPatientToResponse(preloadedPatient))
						return
					}
				}
			}
			c.JSON(http.StatusNotFound, gin.H{"error": "No patient profile found for this account"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
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
