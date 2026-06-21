package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/AthanasiosChlr/cardiotrack/internal/config"
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
)

func main() {
	cfg := config.Load()
	database.Connect(cfg.DatabaseURL)
	db := database.DB

	var patients []models.Patient
	if err := db.Preload("User").Find(&patients).Error; err != nil {
		log.Fatalf("Failed to query patients: %v", err)
	}

	fmt.Printf("Total patients in database: %d\n\n", len(patients))
	for _, p := range patients {
		fmt.Printf("Patient ID: %d | Name: %s | MRN: %s | DOB: %s | Gender: %s\n",
			p.ID, p.User.Name, p.MedicalRecordNumber, p.DateOfBirth.Format("2006-01-02"), p.Gender)
		fmt.Printf("  Emergency Contact: Name=%s, Phone=%s\n", p.EmergencyContactName, p.EmergencyContactPhone)

		// Get latest HEART risk assessment
		var risk models.RiskAssessment
		err := db.Where("patient_id = ? AND score_type = 'HEART'", p.ID).Order("calculated_at desc").First(&risk).Error
		if err == nil {
			fmt.Printf("  HEART Assessment: Score=%d, Category=%s, Recommendation=%s\n",
				risk.ScoreValue, risk.RiskCategory, risk.Recommendation)
		} else {
			fmt.Printf("  HEART Assessment: None found (%v)\n", err)
		}

		// Count observations and get range
		type ObsStats struct {
			Type  string
			Count int64
			Min   string
			Max   string
		}
		var stats []ObsStats
		db.Model(&models.Observation{}).
			Select("type, count(*) as count, min(recorded_at) as min, max(recorded_at) as max").
			Where("patient_id = ?", p.ID).
			Group("type").
			Scan(&stats)

		fmt.Println("  Observations Stats:")
		for _, s := range stats {
			fmt.Printf("    - Type: %-15s | Count: %-3d | Min: %s | Max: %s\n",
				s.Type, s.Count, s.Min[:19], s.Max[:19])
		}
		fmt.Println(strings.Repeat("-", 80))
	}
}
