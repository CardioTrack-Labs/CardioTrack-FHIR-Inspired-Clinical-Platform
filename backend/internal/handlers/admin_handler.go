package handlers

import (
	"net/http"

	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"github.com/gin-gonic/gin"
)

type AdminHandler struct{}

func NewAdminHandler() *AdminHandler {
	return &AdminHandler{}
}

func (h *AdminHandler) ListUsers(c *gin.Context) {
	var users []models.User
	if err := database.DB.Find(&users).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch users"})
		return
	}

	// Mask password hashes
	for i := range users {
		users[i].PasswordHash = ""
	}

	c.JSON(http.StatusOK, users)
}

func (h *AdminHandler) ChangeRole(c *gin.Context) {
	userID := c.Param("id")
	
	var req struct {
		Role string `json:"role" binding:"required,oneof=patient doctor cardiologist admin"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := database.DB.First(&user, userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	user.Role = req.Role
	if err := database.DB.Save(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update role"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Role updated successfully"})
}

func (h *AdminHandler) GetStats(c *gin.Context) {
	var userCount, patientCount, obsCount int64

	database.DB.Model(&models.User{}).Count(&userCount)
	database.DB.Model(&models.Patient{}).Count(&patientCount)
	database.DB.Model(&models.Observation{}).Count(&obsCount)

	c.JSON(http.StatusOK, gin.H{
		"total_users":        userCount,
		"total_patients":     patientCount,
		"total_observations": obsCount,
	})
}
