// +build ignore

// Run with: go run scratch/clean_synthea_patients.go
// This script deletes the Synthea-imported patients (identified by email prefix "imported.")
// so that SeedSyntheaPatients() can re-seed them with the correct observation types.
package main

import (
	"fmt"
	"log"
	"os"

	"github.com/AthanasiosChlr/cardiotrack/internal/config"
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"gorm.io/gorm"
)

func main() {
	cfg := config.Load()
	database.Connect(cfg.DatabaseURL)
	db := database.DB

	// Find all imported (Synthea) users
	var users []models.User
	if err := db.Where("email LIKE ?", "imported.%@cardiotrack.dev").Find(&users).Error; err != nil {
		log.Fatalf("Failed to query imported users: %v", err)
	}

	if len(users) == 0 {
		fmt.Println("No imported (Synthea) patients found in DB — nothing to clean.")
		os.Exit(0)
	}

	fmt.Printf("Found %d imported user(s) to delete:\n", len(users))
	for _, u := range users {
		fmt.Printf("  User ID=%d  Email=%s  Name=%s\n", u.ID, u.Email, u.Name)
	}

	userIDs := make([]uint, len(users))
	for i, u := range users {
		userIDs[i] = u.ID
	}

	// Find patients for these users
	var patients []models.Patient
	db.Where("user_id IN ?", userIDs).Find(&patients)

	patientIDs := make([]uint, len(patients))
	for i, p := range patients {
		patientIDs[i] = p.ID
		fmt.Printf("  Patient ID=%d  MRN=%s\n", p.ID, p.MedicalRecordNumber)
	}

	if len(patientIDs) > 0 {
		// Delete all cascade clinical data
		deleteClinical(db, patientIDs)
	}

	// Delete patients
	if len(patients) > 0 {
		if err := db.Delete(&models.Patient{}, "id IN ?", patientIDs).Error; err != nil {
			log.Printf("Error deleting patients: %v", err)
		} else {
			fmt.Printf("Deleted %d patient record(s).\n", len(patients))
		}
	}

	// Delete users
	if err := db.Delete(&models.User{}, "id IN ?", userIDs).Error; err != nil {
		log.Printf("Error deleting users: %v", err)
	} else {
		fmt.Printf("Deleted %d user record(s).\n", len(users))
	}

	fmt.Println("\nDone. You can now restart the backend to re-seed Synthea patients correctly.")
}

func deleteClinical(db *gorm.DB, patientIDs []uint) {
	tables := []struct {
		model interface{}
		name  string
	}{
		{&models.Observation{}, "observations"},
		{&models.Condition{}, "conditions"},
		{&models.Medication{}, "medications"},
		{&models.RiskAssessment{}, "risk_assessments"},
	}

	// Handle ECG analyses separately (need ECG record IDs first)
	var ecgRecords []models.ECGRecord
	db.Where("patient_id IN ?", patientIDs).Find(&ecgRecords)
	if len(ecgRecords) > 0 {
		ecgIDs := make([]uint, len(ecgRecords))
		for i, e := range ecgRecords {
			ecgIDs[i] = e.ID
		}
		n := db.Delete(&models.ECGAnalysis{}, "ecg_record_id IN ?", ecgIDs).RowsAffected
		fmt.Printf("  Deleted %d ECG analysis record(s).\n", n)
		n = db.Delete(&models.ECGRecord{}, "id IN ?", ecgIDs).RowsAffected
		fmt.Printf("  Deleted %d ECG record(s).\n", n)
	}

	for _, t := range tables {
		result := db.Where("patient_id IN ?", patientIDs).Delete(t.model)
		if result.Error != nil {
			log.Printf("  Error deleting %s: %v", t.name, result.Error)
		} else {
			fmt.Printf("  Deleted %d %s record(s).\n", result.RowsAffected, t.name)
		}
	}
}
