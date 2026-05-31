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

type ConditionHandler struct {
	repo *repository.ConditionRepository
}

func NewConditionHandler() *ConditionHandler {
	return &ConditionHandler{
		repo: repository.NewConditionRepository(),
	}
}

func (h *ConditionHandler) CreateCondition(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	var req dto.CreateConditionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	onsetDate, err := time.Parse("2006-01-02", req.OnsetDate)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid date format, use YYYY-MM-DD"})
		return
	}

	userID, _ := c.Get("user_id")

	condition := &models.Condition{
		PatientID:     uint(patientID),
		ICD10Code:     req.ICD10Code,
		Description:   req.Description,
		OnsetDate:     onsetDate,
		Status:        req.Status,
		DiagnosedByID: userID.(uint),
	}

	if err := h.repo.Create(condition); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create condition"})
		return
	}

	c.JSON(http.StatusCreated, mapConditionToResponse(condition))
}

func (h *ConditionHandler) ListConditions(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	conditions, err := h.repo.FindByPatientID(uint(patientID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch conditions"})
		return
	}

	var responses []dto.ConditionResponse
	for _, cond := range conditions {
		responses = append(responses, mapConditionToResponse(&cond))
	}

	c.JSON(http.StatusOK, responses)
}

func (h *ConditionHandler) GetCondition(c *gin.Context) {
	idStr := c.Param("cond_id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid condition ID"})
		return
	}

	cond, err := h.repo.FindByID(uint(id))
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "Condition not found"})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Database error"})
		}
		return
	}

	patientIDStr := c.Param("id")
	patientID, _ := strconv.ParseUint(patientIDStr, 10, 32)
	if cond.PatientID != uint(patientID) {
		c.JSON(http.StatusNotFound, gin.H{"error": "Condition not found for this patient"})
		return
	}

	c.JSON(http.StatusOK, mapConditionToResponse(cond))
}

func mapConditionToResponse(cond *models.Condition) dto.ConditionResponse {
	resp := dto.ConditionResponse{
		ID:          cond.ID,
		PatientID:   cond.PatientID,
		ICD10Code:   cond.ICD10Code,
		Description: cond.Description,
		OnsetDate:   cond.OnsetDate.Format("2006-01-02"),
		Status:      cond.Status,
		CreatedAt:   cond.CreatedAt,
	}

	if cond.DiagnosedBy.ID != 0 {
		resp.DiagnosedBy = &dto.UserResponse{
			ID:        cond.DiagnosedBy.ID,
			Email:     cond.DiagnosedBy.Email,
			Name:      cond.DiagnosedBy.Name,
			Role:      cond.DiagnosedBy.Role,
			CreatedAt: cond.DiagnosedBy.CreatedAt,
		}
	}

	return resp
}
