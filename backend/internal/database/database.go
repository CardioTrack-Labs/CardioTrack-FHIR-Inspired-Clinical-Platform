package database

import (
	"log"
	"time"

	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(databaseURL string) {
	var err error

	// Connect to Postgres with PgBouncer compatibility
	DB, err = gorm.Open(postgres.New(postgres.Config{
		DSN:                  databaseURL,
		PreferSimpleProtocol: true, // Disables implicit prepared statements for Supabase Pooler
	}), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})

	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	log.Println("Successfully connected to database")

	// Limit connection pool to be friendly to Supabase free tier connection limit (max 60)
	sqlDB, err := DB.DB()
	if err == nil {
		sqlDB.SetMaxIdleConns(10)
		sqlDB.SetMaxOpenConns(30)
		sqlDB.SetConnMaxLifetime(time.Hour)
	}

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
		&models.ECGRecord{},
		&models.ECGAnalysis{},
	)
	if err != nil {
		log.Fatalf("Failed to run auto migration: %v", err)
	}
	log.Println("Auto migration completed")
}
