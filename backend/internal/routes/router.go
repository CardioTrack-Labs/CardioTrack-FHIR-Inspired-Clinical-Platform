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

		// Internal webhook for processing microservices
		api.POST("/internal/ecg/:id/notify", handlers.NewECGHandler().NotifyComplete)

		protected := api.Group("/")
		protected.Use(middleware.AuthMiddleware())
		{
			patients := protected.Group("/patients")
			patientHandler := handlers.NewPatientHandler()
			obsHandler := handlers.NewObservationHandler()
			condHandler := handlers.NewConditionHandler()
			medHandler := handlers.NewMedicationHandler()
			riskHandler := handlers.NewRiskAssessmentHandler()
			reportHandler := handlers.NewReportHandler()
			ecgHandler := handlers.NewECGHandler()

			// Patient (self) profile — accessible to all authenticated roles
			patients.GET("/me", patientHandler.GetMyProfile)

			// Admin/Cardiologist can create patients
			patients.POST("", middleware.RequireRole("admin", "cardiologist"), patientHandler.CreatePatient)
			
			// Admin/Cardiologist see all, Doctor sees assigned, Patient sees self (handled in handler)
			patients.GET("", middleware.RequireRole("admin", "cardiologist", "doctor"), middleware.EnsureDoctorPatientAccess(), patientHandler.ListPatients)
			
			// Import Patient & ECG from HAPI FHIR Sandbox
			patients.POST("/import-fhir", middleware.RequireRole("doctor", "cardiologist", "admin"), ecgHandler.ImportFHIRPatientAndECG)
			
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

				patientData.POST("/reports", middleware.RequireRole("doctor", "cardiologist", "admin"), reportHandler.UploadReport)
				patientData.GET("/reports", reportHandler.ListReports)

				patientData.POST("/risk-assessments", middleware.RequireRole("doctor", "cardiologist", "admin"), riskHandler.CreateRiskAssessment)
				patientData.GET("/risk-assessments", riskHandler.ListRiskAssessments)

				// ECG Waveform & HRV analysis endpoints
				patientData.POST("/ecg", middleware.RequireRole("doctor", "cardiologist", "admin"), ecgHandler.UploadAndProcess)
				patientData.GET("/ecg", ecgHandler.ListECGRecords)
				patientData.GET("/ecg/:record_id", ecgHandler.GetECGAnalysis)
			}
			
			adminGroup := protected.Group("/admin", middleware.RequireRole("admin"))
			{
				adminHandler := handlers.NewAdminHandler()
				adminGroup.GET("/users", adminHandler.ListUsers)
				adminGroup.PATCH("/users/:id/role", adminHandler.ChangeRole)
				adminGroup.GET("/stats", adminHandler.GetStats)
			}
		}

		// TODO(author): Reports (file upload) endpoints go here. Example:
		// reports := protected.Group("/patients/:id/reports", middleware.RequireRole("doctor", "cardiologist", "admin"))
		// reports.POST("/", reportHandler.UploadReport)
		// reports.GET("/", reportHandler.ListReports)
		
		// TODO(author): Risk assessment (HEART score, Framingham) endpoints go here. Example:
		// risks := protected.Group("/patients/:id/risk-assessments", middleware.RequireRole("doctor", "cardiologist"))
		// risks.POST("/heart", riskHandler.CalculateHeartScore)
		// risks.POST("/framingham", riskHandler.CalculateFramingham)
		
		// TODO(author): ECG & WebSocket endpoints go here. Example:
		// api.GET("/ws", wsHandler.Connect)
		// api.POST("/patients/:id/ecg", ecgHandler.UploadAndProcess)
	}
}
