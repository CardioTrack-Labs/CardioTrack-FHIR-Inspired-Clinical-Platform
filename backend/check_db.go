package main

import (
	"fmt"
	"os"

	"github.com/AthanasiosChlr/cardiotrack/internal/config"
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
)

func main() {
	os.Setenv("PORT", "8080")
	cfg := config.Load()
	database.Connect(cfg.DatabaseURL)

	pIDs := []uint{33, 34}
	uIDs := []uint{37, 38}

	// Delete dependent records
	database.DB.Exec("DELETE FROM ecg_analyses WHERE ecg_record_id IN (SELECT id FROM ecg_records WHERE patient_id IN ?)", pIDs)
	database.DB.Exec("DELETE FROM ecg_records WHERE patient_id IN ?", pIDs)
	database.DB.Exec("DELETE FROM observations WHERE patient_id IN ?", pIDs)
	database.DB.Exec("DELETE FROM conditions WHERE patient_id IN ?", pIDs)
	database.DB.Exec("DELETE FROM medications WHERE patient_id IN ?", pIDs)
	database.DB.Exec("DELETE FROM reports WHERE patient_id IN ?", pIDs)
	database.DB.Exec("DELETE FROM risk_assessments WHERE patient_id IN ?", pIDs)

	// Delete patients
	database.DB.Exec("DELETE FROM patients WHERE id IN ?", pIDs)

	// Delete users
	database.DB.Exec("DELETE FROM users WHERE id IN ?", uIDs)

	fmt.Println("Cleanup completed successfully.")
}
