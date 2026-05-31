package database

import (
	"log"

	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(databaseURL string) {
	var err error

	// Connect to Postgres
	DB, err = gorm.Open(postgres.Open(databaseURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Successfully connected to database")

	// Auto migrate models
	log.Println("Running auto migration...")
	err = DB.AutoMigrate(
		&models.User{},
		&models.Patient{},
		&models.Observation{},
		&models.Condition{},
		&models.Medication{},
		&models.Report{},
		&models.RiskAssessment{},
		&models.RefreshToken{},
	)
	if err != nil {
		log.Fatalf("Failed to run auto migration: %v", err)
	}
	log.Println("Auto migration completed")
}
