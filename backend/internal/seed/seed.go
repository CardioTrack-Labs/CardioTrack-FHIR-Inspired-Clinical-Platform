package seed

import (
	"log"
	"time"

	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/models"
	"golang.org/x/crypto/bcrypt"
)

// Run populates the database with initial demo data if it's empty.
func Run() {
	var count int64
	database.DB.Model(&models.User{}).Count(&count)
	if count > 0 {
		log.Println("Database already seeded, skipping...")
		return
	}

	log.Println("Seeding database...")

	hashPassword := func(password string) string {
		hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		return string(hash)
	}

	// 1. Create Users
	admin := models.User{Email: "admin@cardiotrack.dev", PasswordHash: hashPassword("admin123"), Name: "System Admin", Role: "admin"}
	drSmith := models.User{Email: "dr.smith@cardiotrack.dev", PasswordHash: hashPassword("doctor123"), Name: "Dr. Smith", Role: "doctor"}
	drJones := models.User{Email: "dr.jones@cardiotrack.dev", PasswordHash: hashPassword("doctor123"), Name: "Dr. Jones", Role: "doctor"}
	drCardio := models.User{Email: "dr.cardio@cardiotrack.dev", PasswordHash: hashPassword("doctor123"), Name: "Dr. Cardio", Role: "cardiologist"}
	
	patient1User := models.User{Email: "patient1@cardiotrack.dev", PasswordHash: hashPassword("patient123"), Name: "John Doe", Role: "patient"}
	patient2User := models.User{Email: "patient2@cardiotrack.dev", PasswordHash: hashPassword("patient123"), Name: "Jane Smith", Role: "patient"}

	users := []models.User{admin, drSmith, drJones, drCardio, patient1User, patient2User}
	database.DB.Create(&users)

	// 2. Create Patients
	dob, _ := time.Parse("2006-01-02", "1980-05-15")
	patient1 := models.Patient{
		UserID: users[4].ID, DateOfBirth: dob, Gender: "Male", MedicalRecordNumber: "MRN-001",
		BloodType: "O+", AssignedDoctorID: &users[1].ID, // Assigned to Dr. Smith
	}

	dob2, _ := time.Parse("2006-01-02", "1992-08-22")
	patient2 := models.Patient{
		UserID: users[5].ID, DateOfBirth: dob2, Gender: "Female", MedicalRecordNumber: "MRN-002",
		BloodType: "A-", AssignedDoctorID: &users[2].ID, // Assigned to Dr. Jones
	}

	database.DB.Create(&patient1)
	database.DB.Create(&patient2)

	// 3. Create Clinical Data
	obs := models.Observation{
		PatientID: patient1.ID, Type: "Blood Pressure", Value: 120.5, Unit: "mmHg",
		RecordedByID: users[1].ID, RecordedAt: time.Now(), IsAbnormal: false, Notes: "Normal reading",
	}
	database.DB.Create(&obs)

	cond := models.Condition{
		PatientID: patient1.ID, ICD10Code: "I10", Description: "Essential (primary) hypertension",
		OnsetDate: time.Now().AddDate(-1, 0, 0), Status: "active", DiagnosedByID: users[1].ID,
	}
	database.DB.Create(&cond)

	log.Println("Database seeding completed.")
}
