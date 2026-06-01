package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/AthanasiosChlr/cardiotrack/internal/dto"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"github.com/AthanasiosChlr/cardiotrack/internal/repository"
	"github.com/gin-gonic/gin"
)

type RiskAssessmentHandler struct {
	repo     *repository.RiskAssessmentRepository
	userRepo *repository.UserRepository
}

func NewRiskAssessmentHandler() *RiskAssessmentHandler {
	return &RiskAssessmentHandler{
		repo:     repository.NewRiskAssessmentRepository(),
		userRepo: repository.NewUserRepository(),
	}
}

func (h *RiskAssessmentHandler) CreateRiskAssessment(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	var req dto.CreateRiskAssessmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := userIDVal.(uint)

	assessment := &models.RiskAssessment{
		PatientID:      uint(patientID),
		ScoreType:      req.ScoreType,
		ScoreValue:     req.ScoreValue,
		RiskCategory:   req.RiskCategory,
		Recommendation: req.Recommendation,
		CalculatedByID: userID,
		CalculatedAt:   time.Now(),
	}

	if err := h.repo.Create(assessment); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create risk assessment"})
		return
	}

	// Fetch calculated by user info to populate response
	user, err := h.userRepo.FindByID(userID)
	if err == nil && user != nil {
		assessment.CalculatedBy = *user
	}

	c.JSON(http.StatusCreated, mapRiskAssessmentToResponse(assessment))
}

func (h *RiskAssessmentHandler) ListRiskAssessments(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	assessments, err := h.repo.FindByPatientID(uint(patientID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch risk assessments"})
		return
	}

	var responses []dto.RiskAssessmentResponse
	for _, assessment := range assessments {
		responses = append(responses, mapRiskAssessmentToResponse(&assessment))
	}

	c.JSON(http.StatusOK, responses)
}

func mapRiskAssessmentToResponse(ra *models.RiskAssessment) dto.RiskAssessmentResponse {
	resp := dto.RiskAssessmentResponse{
		ID:             ra.ID,
		PatientID:      ra.PatientID,
		ScoreType:      ra.ScoreType,
		ScoreValue:     ra.ScoreValue,
		RiskCategory:   ra.RiskCategory,
		Recommendation: ra.Recommendation,
		CalculatedAt:   ra.CalculatedAt,
	}

	if ra.CalculatedBy.ID != 0 {
		resp.CalculatedBy = &dto.UserResponse{
			ID:        ra.CalculatedBy.ID,
			Email:     ra.CalculatedBy.Email,
			Name:      ra.CalculatedBy.Name,
			Role:      ra.CalculatedBy.Role,
			CreatedAt: ra.CalculatedBy.CreatedAt,
		}
	}

	return resp
}
