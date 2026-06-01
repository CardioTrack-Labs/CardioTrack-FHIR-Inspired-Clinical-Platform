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

type ObservationHandler struct {
	repo *repository.ObservationRepository
}

func NewObservationHandler() *ObservationHandler {
	return &ObservationHandler{
		repo: repository.NewObservationRepository(),
	}
}

func (h *ObservationHandler) CreateObservation(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	var req dto.CreateObservationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	recordedAt, err := time.Parse(time.RFC3339, req.RecordedAt)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format, use RFC3339"})
		return
	}

	userID, _ := c.Get("user_id")

	obs := &models.Observation{
		PatientID:    uint(patientID),
		Type:         req.Type,
		Value:        req.Value,
		Unit:         req.Unit,
		RecordedByID: userID.(uint),
		RecordedAt:   recordedAt,
		Notes:        req.Notes,
	}

	detectAbnormal(obs)

	if err := h.repo.Create(obs); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create observation"})
		return
	}

	c.JSON(http.StatusCreated, mapObservationToResponse(obs))
}

func (h *ObservationHandler) ListObservations(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	observations, err := h.repo.FindByPatientID(uint(patientID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch observations"})
		return
	}

	var responses []dto.ObservationResponse
	for _, obs := range observations {
		responses = append(responses, mapObservationToResponse(&obs))
	}

	c.JSON(http.StatusOK, responses)
}

func (h *ObservationHandler) GetObservation(c *gin.Context) {
	idStr := c.Param("obs_id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid observation ID"})
		return
	}

	obs, err := h.repo.FindByID(uint(id))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Observation not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	// Make sure observation belongs to the requested patient
	patientIDStr := c.Param("id")
	patientID, _ := strconv.ParseUint(patientIDStr, 10, 32)
	if obs.PatientID != uint(patientID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Observation not found for this patient"})
		return
	}

	c.JSON(http.StatusOK, mapObservationToResponse(obs))
}

// Implement abnormal value detection for observations based on clinical reference ranges.
// Called from CreateObservation before DB save.
func detectAbnormal(obs *models.Observation) {
	switch obs.Type {
	case "systolic_bp":
		obs.IsAbnormal = obs.Value >= 140 || obs.Value < 90
	case "diastolic_bp":
		obs.IsAbnormal = obs.Value >= 90 || obs.Value < 60
	case "heart_rate":
		obs.IsAbnormal = obs.Value > 100 || obs.Value < 60
	case "spo2":
		obs.IsAbnormal = obs.Value < 95
	case "glucose":
		obs.IsAbnormal = obs.Value > 140 || obs.Value < 70
	case "cholesterol":
		obs.IsAbnormal = obs.Value >= 200
	default:
		obs.IsAbnormal = false
	}
}

func mapObservationToResponse(obs *models.Observation) dto.ObservationResponse {
	resp := dto.ObservationResponse{
		ID:         obs.ID,
		PatientID:  obs.PatientID,
		Type:       obs.Type,
		Value:      obs.Value,
		Unit:       obs.Unit,
		RecordedAt: obs.RecordedAt,
		IsAbnormal: obs.IsAbnormal,
		Notes:      obs.Notes,
		CreatedAt:  obs.CreatedAt,
	}

	if obs.RecordedBy.ID != 0 {
		resp.RecordedBy = &dto.UserResponse{
			ID:        obs.RecordedBy.ID,
			Email:     obs.RecordedBy.Email,
			Name:      obs.RecordedBy.Name,
			Role:      obs.RecordedBy.Role,
			CreatedAt: obs.RecordedBy.CreatedAt,
		}
	}

	return resp
}
