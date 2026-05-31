package routes

import (
	"github.com/AthanasiosChlr/cardiotrack/internal/handlers"
	"github.com/AthanasiosChlr/cardiotrack/internal/middleware"
	"github.com/gin-gonic/gin"
)

func RegisterRoutes(r *gin.Engine) {
	authHandler := handlers.NewAuthHandler()

	api := r.Group("/api/v1")
	{
		auth := api.Group("/auth")
		{
			auth.POST("/register", authHandler.Register)
			auth.POST("/login", authHandler.Login)
			auth.POST("/refresh", authHandler.RefreshToken)
			auth.POST("/logout", authHandler.Logout)
		}

		protected := api.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			patients := protected.Group("/patients")
			patientHandler := handlers.NewPatientHandler()

			// Admin/Cardiologist can create patients
			patients.POST("/", middleware.RequireRole("admin", "cardiologist"), patientHandler.CreatePatient)
			
			// Admin/Cardiologist see all, Doctor sees assigned, Patient sees self (handled in handler)
			patients.GET("/", middleware.RequireRole("admin", "cardiologist", "doctor"), middleware.EnsureDoctorPatientAccess(), patientHandler.ListPatients)
			
			// Get specific patient (RBAC handled inside middleware + handler)
			patients.GET("/:id", middleware.RequirePatientAccess(), patientHandler.GetPatient)
		}
	}
}
