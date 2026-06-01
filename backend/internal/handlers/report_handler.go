package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"github.com/AthanasiosChlr/cardiotrack/internal/dto"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"github.com/AthanasiosChlr/cardiotrack/internal/repository"
	"github.com/gin-gonic/gin"
)

type ReportHandler struct {
	repo     *repository.ReportRepository
	userRepo *repository.UserRepository
}

func NewReportHandler() *ReportHandler {
	return &ReportHandler{
		repo:     repository.NewReportRepository(),
		userRepo: repository.NewUserRepository(),
	}
}

func (h *ReportHandler) UploadReport(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	title := c.PostForm("title")
	reportType := c.PostForm("report_type")
	if title == "" || reportType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "title and report_type are required"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file payload is required"})
		return
	}

	// Ensure the uploads directory exists
	uploadsDir := "./uploads"
	if err := os.MkdirAll(uploadsDir, os.ModePerm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify uploads directory"})
		return
	}

	// Form unique filename
	filename := fmt.Sprintf("%d_%s", time.Now().UnixNano(), filepath.Base(file.Filename))
	dst := filepath.Join(uploadsDir, filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save diagnostic file"})
		return
	}

	userIDVal, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}
	userID := userIDVal.(uint)

	report := &models.Report{
		PatientID:    uint(patientID),
		Title:        title,
		ReportType:   reportType,
		FileURL:      fmt.Sprintf("/uploads/%s", filename),
		UploadedByID: userID,
		ReportDate:   time.Now(),
	}

	if err := h.repo.Create(report); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to record clinical report registry entry"})
		return
	}

	// Fetch uploading user details to populate response
	user, err := h.userRepo.FindByID(userID)
	if err == nil && user != nil {
		report.UploadedBy = *user
	}

	c.JSON(http.StatusCreated, mapReportToResponse(report))
}

func (h *ReportHandler) ListReports(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	reports, err := h.repo.FindByPatientID(uint(patientID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch reports roster"})
		return
	}

	var responses []dto.ReportResponse
	for _, report := range reports {
		responses = append(responses, mapReportToResponse(&report))
	}

	c.JSON(http.StatusOK, responses)
}

func mapReportToResponse(r *models.Report) dto.ReportResponse {
	resp := dto.ReportResponse{
		ID:         r.ID,
		PatientID:  r.PatientID,
		Title:      r.Title,
		ReportType: r.ReportType,
		FileURL:    r.FileURL,
		ReportDate: r.ReportDate,
		CreatedAt:  r.CreatedAt,
	}

	if r.UploadedBy.ID != 0 {
		resp.UploadedBy = &dto.UserResponse{
			ID:        r.UploadedBy.ID,
			Email:     r.UploadedBy.Email,
			Name:      r.UploadedBy.Name,
			Role:      r.UploadedBy.Role,
			CreatedAt: r.UploadedBy.CreatedAt,
		}
	}

	return resp
}
