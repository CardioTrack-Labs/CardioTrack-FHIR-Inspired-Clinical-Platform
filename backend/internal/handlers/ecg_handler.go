package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/AthanasiosChlr/cardiotrack/internal/fhir"
	"github.com/AthanasiosChlr/cardiotrack/internal/messaging"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"github.com/AthanasiosChlr/cardiotrack/internal/repository"
	"github.com/AthanasiosChlr/cardiotrack/internal/websocket"
	"github.com/gin-gonic/gin"
)

type ECGHandler struct {
	ecgRepo     *repository.ECGRepository
	patientRepo *repository.PatientRepository
	userRepo    *repository.UserRepository
	fhirClient  *fhir.FHIRClient
}

func NewECGHandler() *ECGHandler {
	return &ECGHandler{
		ecgRepo:     repository.NewECGRepository(),
		patientRepo: repository.NewPatientRepository(),
		userRepo:    repository.NewUserRepository(),
		fhirClient:  fhir.NewFHIRClient(),
	}
}

// UploadAndProcess uploads a raw ECG file, creates a record, and publishes it to RabbitMQ
func (h *ECGHandler) UploadAndProcess(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	// Verify patient exists
	patient, err := h.patientRepo.FindByID(uint(patientID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}

	// Retrieve uploaded file
	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Failed to read file from request"})
		return
	}

	// Create directory if not exists
	uploadDir := "./uploads/ecg"
	if err := os.MkdirAll(uploadDir, os.ModePerm); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create upload folder"})
		return
	}

	// Save file locally
	filename := fmt.Sprintf("patient_%d_%d%s", patient.ID, time.Now().Unix(), filepath.Ext(file.Filename))
	filePath := filepath.Join(uploadDir, filename)
	if err := c.SaveUploadedFile(file, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save file"})
		return
	}

	// Extract recorded_at from form parameter or default to now
	recordedAt := time.Now()
	if recordedAtStr := c.PostForm("recorded_at"); recordedAtStr != "" {
		if t, err := time.Parse(time.RFC3339, recordedAtStr); err == nil {
			recordedAt = t
		}
	}

	// Resolve clinician ID from auth context
	userIDVal, exists := c.Get("user_id")
	var userID uint = 1 // Fallback System User
	if exists {
		userID = userIDVal.(uint)
	}

	// Create ECG Record
	record := &models.ECGRecord{
		PatientID:        patient.ID,
		FileURL:          filePath,
		UploadedByID:     userID,
		RecordedAt:       recordedAt,
		ProcessingStatus: "pending",
	}

	if err := h.ecgRepo.Create(record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store record in database"})
		return
	}

	// Publish message to RabbitMQ
	payload := map[string]interface{}{
		"ecg_record_id": record.ID,
		"file_path":     filePath,
	}

	payloadBytes, err := json.Marshal(payload)
	if err == nil {
		mq := messaging.GetRabbitMQ()
		if mq != nil {
			_ = mq.Publish(payloadBytes)
		}
	}

	c.JSON(http.StatusAccepted, record)
}

// ListECGRecords returns all ECG uploads and analyses for a patient
func (h *ECGHandler) ListECGRecords(c *gin.Context) {
	patientIDStr := c.Param("id")
	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient ID"})
		return
	}

	records, err := h.ecgRepo.FindByPatientID(uint(patientID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to retrieve records"})
		return
	}

	c.JSON(http.StatusOK, records)
}

// GetECGAnalysis returns a specific record and its calculated HRV values
func (h *ECGHandler) GetECGAnalysis(c *gin.Context) {
	recordIDStr := c.Param("record_id")
	recordID, err := strconv.ParseUint(recordIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid record ID"})
		return
	}

	record, err := h.ecgRepo.FindByID(uint(recordID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "ECG record not found"})
		return
	}

	c.JSON(http.StatusOK, record)
}

// ImportFHIRPatientAndECG imports demographics and the latest ECG observation from HAPI FHIR
func (h *ECGHandler) ImportFHIRPatientAndECG(c *gin.Context) {
	fhirID := c.Query("fhir_id")
	if fhirID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing fhir_id query parameter"})
		return
	}

	// 1. Fetch patient demographics from HAPI FHIR
	fhirPat, err := h.fhirClient.FetchPatient(fhirID)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": fmt.Sprintf("Failed to fetch from FHIR Sandbox: %v", err)})
		return
	}

	// Extract details
	fullName := "FHIR Imported Patient"
	if len(fhirPat.Name) > 0 {
		given := strings.Join(fhirPat.Name[0].Given, " ")
		fullName = strings.TrimSpace(fmt.Sprintf("%s %s", given, fhirPat.Name[0].Family))
	}

	dob, err := time.Parse("2006-01-02", fhirPat.BirthDate)
	if err != nil {
		dob = time.Now().AddDate(-40, 0, 0) // Default to 40 years ago
	}

	gender := strings.ToLower(fhirPat.Gender)
	if gender != "male" && gender != "female" {
		gender = "other"
	}

	mrn := fmt.Sprintf("FHIR-%s", fhirPat.ID)

	// Check if already exists
	var patient *models.Patient
	existingUser, err := h.userRepo.FindByEmail(fmt.Sprintf("imported.%s@cardiotrack.dev", fhirPat.ID))
	if err == nil && existingUser != nil {
		patient, _ = h.patientRepo.FindByUserID(existingUser.ID)
	}

	if patient == nil {
		// Create User
		newUser := &models.User{
			Email:        fmt.Sprintf("imported.%s@cardiotrack.dev", fhirPat.ID),
			PasswordHash: "$2a$10$tZ2cR5G78mKq...", // Placeholder password hash
			Name:         fullName,
			Role:         "patient",
		}
		if err := h.userRepo.Create(newUser); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create patient user profile"})
			return
		}

		// Create Patient
		patient = &models.Patient{
			UserID:              newUser.ID,
			DateOfBirth:         dob,
			Gender:              gender,
			MedicalRecordNumber: mrn,
			BloodType:           "O+",
		}
		if err := h.patientRepo.Create(patient); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create patient record"})
			return
		}
	}

	// 2. Fetch latest ECG Observation with SampledData
	obs, samples, freq, err := h.fhirClient.FetchECGObservation(fhirPat.ID)
	if err != nil {
		// If no ECG is available on sandbox, return the created patient details
		c.JSON(http.StatusCreated, gin.H{
			"message": "Patient imported successfully. No ECG wave data available on Sandbox.",
			"patient": patient,
		})
		return
	}

	// Save ECG samples as a space-separated string file
	uploadDir := "./uploads/ecg"
	_ = os.MkdirAll(uploadDir, os.ModePerm)
	filename := fmt.Sprintf("fhir_%s_%d.txt", fhirPat.ID, time.Now().Unix())
	filePath := filepath.Join(uploadDir, filename)

	var sb strings.Builder
	for i, val := range samples {
		sb.WriteString(strconv.FormatFloat(val, 'f', 6, 64))
		if i < len(samples)-1 {
			sb.WriteString(" ")
		}
	}

	if err := os.WriteFile(filePath, []byte(sb.String()), 0644); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to write signal data locally"})
		return
	}

	// Resolve clinician ID
	userIDVal, exists := c.Get("user_id")
	var userID uint = 1
	if exists {
		userID = userIDVal.(uint)
	}

	recordedAt := time.Now()
	if obs.EffectiveDateTime != "" {
		if t, err := time.Parse(time.RFC3339, obs.EffectiveDateTime); err == nil {
			recordedAt = t
		}
	}

	// Create ECG Record
	record := &models.ECGRecord{
		PatientID:        patient.ID,
		FileURL:          filePath,
		UploadedByID:     userID,
		RecordedAt:       recordedAt,
		ProcessingStatus: "pending",
	}
	if err := h.ecgRepo.Create(record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save imported ECG record"})
		return
	}

	// Publish to RabbitMQ queue
	payload := map[string]interface{}{
		"ecg_record_id": record.ID,
		"file_path":     filePath,
		"sampling_rate": int(freq),
	}

	payloadBytes, err := json.Marshal(payload)
	if err == nil {
		mq := messaging.GetRabbitMQ()
		if mq != nil {
			_ = mq.Publish(payloadBytes)
		}
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "Patient and raw ECG data imported from HAPI FHIR Sandbox successfully.",
		"patient":    patient,
		"ecg_record": record,
	})
}

// NotifyComplete handles analysis completion notifications from the Python engine
func (h *ECGHandler) NotifyComplete(c *gin.Context) {
	recordIDStr := c.Param("id")
	recordID, err := strconv.ParseUint(recordIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid record ID"})
		return
	}

	record, err := h.ecgRepo.FindByID(uint(recordID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Record not found"})
		return
	}

	// If analysis is done and has analysis data, broadcast vital metrics
	if record.ProcessingStatus == "done" && record.Analysis != nil {
		if hub := websocket.GetTelemetryHub(); hub != nil {
			// Broadcast heart rate
			hub.BroadcastVital(record.PatientID, "heart_rate", record.Analysis.HeartRateMean, "bpm", false)
			// Broadcast HRV SDNN vital
			isAbnormal := record.Analysis.HRVInterpretation == "poor"
			hub.BroadcastVital(record.PatientID, "hrv_sdnn", record.Analysis.SDNN, "ms", isAbnormal)
			
			log.Printf("[ECG Handler] Broadcasted telemetry vitals for patient %d after ECG record %d analysis", record.PatientID, record.ID)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Notification broadcasted"})
}

