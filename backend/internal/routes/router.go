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
			obsHandler := handlers.NewObservationHandler()
			condHandler := handlers.NewConditionHandler()
			medHandler := handlers.NewMedicationHandler()

			// Admin/Cardiologist can create patients
			patients.POST("/", middleware.RequireRole("admin", "cardiologist"), patientHandler.CreatePatient)
			
			// Admin/Cardiologist see all, Doctor sees assigned, Patient sees self (handled in handler)
			patients.GET("/", middleware.RequireRole("admin", "cardiologist", "doctor"), middleware.EnsureDoctorPatientAccess(), patientHandler.ListPatients)
			
			// Get specific patient (RBAC handled inside middleware + handler)
			patients.GET("/:id", middleware.RequirePatientAccess(), patientHandler.GetPatient)

			// Sub-routes for clinical data (nested under specific patient)
			patientData := patients.Group("/:id", middleware.RequirePatientAccess())
			{
				patientData.POST("/observations", middleware.RequireRole("doctor", "cardiologist", "admin"), obsHandler.CreateObservation)
				patientData.GET("/observations", obsHandler.ListObservations)
				patientData.GET("/observations/:obs_id", obsHandler.GetObservation)

				patientData.POST("/conditions", middleware.RequireRole("doctor", "cardiologist", "admin"), condHandler.CreateCondition)
				patientData.GET("/conditions", condHandler.ListConditions)
				patientData.GET("/conditions/:cond_id", condHandler.GetCondition)

				patientData.POST("/medications", middleware.RequireRole("doctor", "cardiologist", "admin"), medHandler.CreateMedication)
				patientData.GET("/medications", medHandler.ListMedications)
				patientData.GET("/medications/:med_id", medHandler.GetMedication)
			}
		}
	}
}
