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

type MedicationHandler struct {
	repo *repository.MedicationRepository
}

func NewMedicationHandler() *MedicationHandler {
	return &MedicationHandler{
		repo: repository.NewMedicationRepository(),
	}
}

func (h *MedicationHandler) CreateMedication(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	var req dto.CreateMedicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startDate, err := time.Parse("2006-01-02", req.StartDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid start date format, use YYYY-MM-DD"})
		return
	}

	var endDate *time.Time
	if req.EndDate != "" {
		ed, err := time.Parse("2006-01-02", req.EndDate)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid end date format, use YYYY-MM-DD"})
			return
		}
		endDate = &ed
	}

	userID, _ := c.Get("user_id")

	medication := &models.Medication{
		PatientID:      uint(patientID),
		Name:           req.Name,
		Dosage:         req.Dosage,
		Frequency:      req.Frequency,
		StartDate:      startDate,
		EndDate:        endDate,
		Status:         req.Status,
		PrescribedByID: userID.(uint),
	}

	if err := h.repo.Create(medication); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create medication"})
		return
	}

	c.JSON(http.StatusCreated, mapMedicationToResponse(medication))
}

func (h *MedicationHandler) ListMedications(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	medications, err := h.repo.FindByPatientID(uint(patientID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch medications"})
		return
	}

	var responses []dto.MedicationResponse
	for _, med := range medications {
		responses = append(responses, mapMedicationToResponse(&med))
	}

	c.JSON(http.StatusOK, responses)
}

func (h *MedicationHandler) GetMedication(c *gin.Context) {
	idStr := c.Param("med_id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid medication ID"})
		return
	}

	med, err := h.repo.FindByID(uint(id))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Medication not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	patientIDStr := c.Param("id")
	patientID, _ := strconv.ParseUint(patientIDStr, 10, 32)
	if med.PatientID != uint(patientID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Medication not found for this patient"})
		return
	}

	c.JSON(http.StatusOK, mapMedicationToResponse(med))
}

func mapMedicationToResponse(med *models.Medication) dto.MedicationResponse {
	resp := dto.MedicationResponse{
		ID:        med.ID,
		PatientID: med.PatientID,
		Name:      med.Name,
		Dosage:    med.Dosage,
		Frequency: med.Frequency,
		StartDate: med.StartDate.Format("2006-01-02"),
		Status:    med.Status,
		CreatedAt: med.CreatedAt,
	}

	if med.EndDate != nil {
		ed := med.EndDate.Format("2006-01-02")
		resp.EndDate = &ed
	}

	if med.PrescribedBy.ID != 0 {
		resp.PrescribedBy = &dto.UserResponse{
			ID:        med.PrescribedBy.ID,
			Email:     med.PrescribedBy.Email,
			Name:      med.PrescribedBy.Name,
			Role:      med.PrescribedBy.Role,
			CreatedAt: med.PrescribedBy.CreatedAt,
		}
	}

	return resp
}
