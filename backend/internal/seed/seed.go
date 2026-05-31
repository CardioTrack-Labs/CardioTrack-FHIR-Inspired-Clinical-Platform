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

// PatchClinicalData inserts rich demo clinical data (observations + medications) for patient1
// using the correct observation type strings that the frontend expects.
// Safe to call on an already-seeded DB — it checks for existing records before inserting.
func PatchClinicalData() {
	// Find patient1 by MRN
	var patient models.Patient
	if err := database.DB.Where("medical_record_number = ?", "MRN-001").First(&patient).Error; err != nil {
		log.Println("[PatchClinicalData] patient MRN-001 not found, skipping:", err)
		return
	}

	// Find the assigned doctor (Dr. Smith)
	var doctor models.User
	if err := database.DB.Where("email = ?", "dr.smith@cardiotrack.dev").First(&doctor).Error; err != nil {
		log.Println("[PatchClinicalData] Dr. Smith not found, skipping:", err)
		return
	}

	// ── Observations ─────────────────────────────────────────────────────────
	// Only insert if there are no systolic_bp observations yet (idempotent)
	var existingObsCount int64
	database.DB.Model(&models.Observation{}).
		Where("patient_id = ? AND type = ?", patient.ID, "systolic_bp").
		Count(&existingObsCount)

	if existingObsCount == 0 {
		log.Println("[PatchClinicalData] Inserting demo observations for patient MRN-001...")

		now := time.Now()
		observations := []models.Observation{
			// 14 days of systolic BP (realistic hypertension patient: 138–150)
			{PatientID: patient.ID, Type: "systolic_bp", Value: 148, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -13), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 145, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -12), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 142, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -11), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 150, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -10), IsAbnormal: true, Notes: "High reading"},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 138, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -9), IsAbnormal: false, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 144, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -8), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 147, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -7), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 142, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -6), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 145, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -5), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 148, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -4), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 143, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -3), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 147, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -2), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 144, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -1), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "systolic_bp", Value: 142, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now, IsAbnormal: true, Notes: "Today"},

			// 14 days of diastolic BP
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 94, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -13), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 91, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -12), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 90, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -11), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 96, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -10), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 87, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -9), IsAbnormal: false, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 92, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -8), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 93, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -7), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 89, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -6), IsAbnormal: false, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 91, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -5), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 94, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -4), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 90, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -3), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 93, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -2), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 91, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now.AddDate(0, 0, -1), IsAbnormal: true, Notes: ""},
			{PatientID: patient.ID, Type: "diastolic_bp", Value: 90, Unit: "mmHg", RecordedByID: doctor.ID, RecordedAt: now, IsAbnormal: true, Notes: "Today"},

			// Latest single-reading vitals
			{PatientID: patient.ID, Type: "heart_rate", Value: 88, Unit: "bpm", RecordedByID: doctor.ID, RecordedAt: now, IsAbnormal: false, Notes: ""},
			{PatientID: patient.ID, Type: "spo2", Value: 97, Unit: "%", RecordedByID: doctor.ID, RecordedAt: now, IsAbnormal: false, Notes: ""},
			{PatientID: patient.ID, Type: "glucose", Value: 115, Unit: "mg/dL", RecordedByID: doctor.ID, RecordedAt: now, IsAbnormal: false, Notes: "Fasting"},
		}
		database.DB.Create(&observations)
		log.Printf("[PatchClinicalData] Inserted %d observations.", len(observations))
	} else {
		log.Println("[PatchClinicalData] Observations already present, skipping.")
	}

	// ── Medications ───────────────────────────────────────────────────────────
	var existingMedCount int64
	database.DB.Model(&models.Medication{}).
		Where("patient_id = ?", patient.ID).
		Count(&existingMedCount)

	if existingMedCount == 0 {
		log.Println("[PatchClinicalData] Inserting demo medications for patient MRN-001...")

		startDate := time.Now().AddDate(-1, 0, 0)
		medications := []models.Medication{
			{PatientID: patient.ID, Name: "Aspirin", Dosage: "100 mg", Frequency: "morning", StartDate: startDate, PrescribedByID: doctor.ID, Status: "active"},
			{PatientID: patient.ID, Name: "Bisoprolol", Dosage: "5 mg", Frequency: "morning", StartDate: startDate, PrescribedByID: doctor.ID, Status: "active"},
			{PatientID: patient.ID, Name: "Lisinopril", Dosage: "10 mg", Frequency: "morning", StartDate: startDate, PrescribedByID: doctor.ID, Status: "active"},
			{PatientID: patient.ID, Name: "Bisoprolol", Dosage: "5 mg", Frequency: "evening", StartDate: startDate, PrescribedByID: doctor.ID, Status: "active"},
			{PatientID: patient.ID, Name: "Atorvastatin", Dosage: "40 mg", Frequency: "evening", StartDate: startDate, PrescribedByID: doctor.ID, Status: "active"},
			{PatientID: patient.ID, Name: "Metformin", Dosage: "500 mg", Frequency: "evening", StartDate: startDate, PrescribedByID: doctor.ID, Status: "active"},
		}
		database.DB.Create(&medications)
		log.Printf("[PatchClinicalData] Inserted %d medications.", len(medications))
	} else {
		log.Println("[PatchClinicalData] Medications already present, skipping.")
	}
}
