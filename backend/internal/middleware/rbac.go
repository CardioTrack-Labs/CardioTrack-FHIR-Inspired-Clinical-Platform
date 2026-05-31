package middleware

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func RequireRole(roles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		roleStr := userRole.(string)
		for _, role := range roles {
			if roleStr == role {
				c.Next()
				return
			}
		}

		c.JSON(http.StatusForbidden, gin.H{"error": "Insufficient permissions"})
		c.Abort()
	}
}

// RequirePatientAccess ensures a user can only access their own patient profile
// unless they are a doctor, cardiologist, or admin.
func RequirePatientAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
			c.Abort()
			return
		}

		roleStr := userRole.(string)
		// Elevated roles bypass this check
		if roleStr == "doctor" || roleStr == "cardiologist" || roleStr == "admin" {
			c.Next()
			return
		}

		// It must be a patient, they can only access their own user ID mapping
		userID, _ := c.Get("user_id")
		requestedIDStr := c.Param("id")
		
		// Typically, the ID in the URL is the Patient ID, not User ID.
		// So we pass the context forward and the handler or repository must enforce 
		// that the patient being accessed belongs to the user_id in the context.
		// Alternatively, if the route uses user_id, we can compare directly:
		if requestedIDStr != "" && roleStr == "patient" {
			// To strictly enforce it at middleware level, we'd need to query the DB 
			// here to see if Patient.UserID == userID. 
			// To keep it simple and performant, we'll store a flag in context to let
			// the handler/repo enforce it.
			c.Set("enforce_patient_user_id", userID)
		}
		
		c.Next()
	}
}

// EnsureDoctorPatientAccess ensures a doctor can only access patients assigned to them.
func EnsureDoctorPatientAccess() gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, _ := c.Get("user_role")
		if userRole == "doctor" {
			userID, _ := c.Get("user_id")
			c.Set("enforce_doctor_id", userID)
		}
		c.Next()
	}
}
