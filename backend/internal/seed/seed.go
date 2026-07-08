package seed

import (
	"fmt"
	"log"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/fhir"
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

// SeedSyntheaPatients parses Synthea FHIR bundles from backend/data/synthea/ and seeds them.
func SeedSyntheaPatients() {
	rand.Seed(time.Now().UnixNano())
	var fhirClient = fhir.NewFHIRClient()

	// Per-patient metadata keyed by FHIR Patient ID
	type patientMeta struct {
		EmergencyName  string
		EmergencyPhone string
		HeartScore     int
		HeartCategory  string
		HeartRec       string
	}
	patientMetadata := map[string]patientMeta{
		"131288052": { // Robert Williams — stroke, AF, hypertension
			EmergencyName:  "Susan Williams",
			EmergencyPhone: "+1 617-555-0183",
			HeartScore:     8,
			HeartCategory:  "high",
			HeartRec:       "High-risk ACS profile. Immediate cardiology consultation recommended. Consider early invasive strategy (PCI/CABG). Anticoagulation review required given concurrent AF.",
		},
		"131288089": { // Aisha Patel — Crohn's, anemia
			EmergencyName:  "Raj Patel",
			EmergencyPhone: "+1 415-555-0247",
			HeartScore:     4,
			HeartCategory:  "moderate",
			HeartRec:       "Moderate ACS risk. Observation and serial troponin testing recommended. Optimize IBD-related anemia management as it may exacerbate cardiac stress.",
		},
		"131288111": { // Dimitris Georgiou — CAD, diabetes
			EmergencyName:  "Eleni Georgiou",
			EmergencyPhone: "+30 691-234-5678",
			HeartScore:     7,
			HeartCategory:  "high",
			HeartRec:       "High risk of adverse cardiac events. Cardiology referral and coronary angiogram review indicated. Optimize glycemic control.",
		},
		"131288222": { // Helena Papadopoulou — CHF, osteoarthritis
			EmergencyName:  "Georgios Papadopoulos",
			EmergencyPhone: "+30 692-345-6789",
			HeartScore:     5,
			HeartCategory:  "moderate",
			HeartRec:       "Moderate cardiac risk. Schedule outpatient stress echocardiogram. Monitor daily weights for heart failure management.",
		},
	}

	entries, err := os.ReadDir("data/synthea")
	if err != nil {
		log.Printf("[SeedSynthea] Failed to read directory data/synthea: %v", err)
		return
	}

	var files []string
	for _, entry := range entries {
		if !entry.IsDir() && strings.HasSuffix(strings.ToLower(entry.Name()), ".json") {
			files = append(files, filepath.Join("data/synthea", entry.Name()))
		}
	}

	log.Printf("[SeedSynthea] Found %d JSON files to process under data/synthea/", len(files))

	for _, file := range files {
		content, err := os.ReadFile(file)
		if err != nil {
			log.Printf("[SeedSynthea] Failed to read file %s: %v", file, err)
			continue
		}

		fhirPat, fhirConds, fhirMeds, fhirObsList, err := fhirClient.ParseFHIRBundle(content)
		if err != nil {
			log.Printf("[SeedSynthea] Failed to parse bundle %s: %v", file, err)
			continue
		}
		if fhirPat == nil {
			continue
		}

		// 1. Check if patient user already exists in DB
		email := fmt.Sprintf("imported.%s@cardiotrack.dev", fhirPat.ID)
		var user models.User
		err = database.DB.Where("email = ?", email).First(&user).Error
		if err == nil {
			// Already seeded, skip this patient
			log.Printf("[SeedSynthea] Patient %s already exists, skipping.", fhirPat.ID)
			continue
		}

		// 2. Create User
		user = models.User{
			Email:        email,
			PasswordHash: "$2a$10$tZ2cR5G78mKq...", // Placeholder password hash
			Name:         "FHIR Imported Patient",
			Role:         "patient",
		}
		if len(fhirPat.Name) > 0 {
			given := strings.Join(fhirPat.Name[0].Given, " ")
			user.Name = strings.TrimSpace(fmt.Sprintf("%s %s", given, fhirPat.Name[0].Family))
		}
		if err := database.DB.Create(&user).Error; err != nil {
			log.Printf("[SeedSynthea] Failed to create user: %v", err)
			continue
		}

		// 3. Create Patient
		dob, err := time.Parse("2006-01-02", fhirPat.BirthDate)
		if err != nil {
			dob = time.Now().AddDate(-40, 0, 0)
		}
		gender := strings.ToLower(fhirPat.Gender)
		if gender != "male" && gender != "female" {
			gender = "other"
		}

		// Find a doctor (Dr. Smith, User ID 2) to assign
		var doctorID uint = 2

		meta, hasMeta := patientMetadata[fhirPat.ID]
		var emergencyName, emergencyPhone string
		var heartScore int
		var heartCategory, heartRec string

		if hasMeta {
			emergencyName = meta.EmergencyName
			emergencyPhone = meta.EmergencyPhone
			heartScore = meta.HeartScore
			heartCategory = meta.HeartCategory
			heartRec = meta.HeartRec
		} else {
			// Dynamic fallback emergency contact name and phone
			family := ""
			if len(fhirPat.Name) > 0 {
				family = fhirPat.Name[0].Family
			}
			if family == "" {
				family = "Smith"
			}

			// Decide language/ethnicity from family name
			isGreek := false
			greekSurnames := []string{"pou", "ou", "is", "as", "os", "id"}
			lowerFamily := strings.ToLower(family)
			for _, suffix := range greekSurnames {
				if strings.HasSuffix(lowerFamily, suffix) {
					isGreek = true
					break
				}
			}

			if isGreek {
				greekFirstNames := []string{"Γιώργος", "Μαρία", "Γιάννης", "Ελένη", "Δημήτρης", "Κατερίνα", "Νίκος", "Βασιλική", "Γεωργία", "Ανδρέας"}
				randomName := greekFirstNames[rand.Intn(len(greekFirstNames))]
				emergencyName = fmt.Sprintf("%s %s", randomName, family)
				emergencyPhone = fmt.Sprintf("+30 69%d", 70000000+rand.Int63n(20000000))
			} else {
				englishFirstNames := []string{"John", "Mary", "Robert", "Patricia", "Michael", "Linda", "William", "Elizabeth", "David", "Barbara"}
				randomName := englishFirstNames[rand.Intn(len(englishFirstNames))]
				emergencyName = fmt.Sprintf("%s %s", randomName, family)
				emergencyPhone = fmt.Sprintf("+1 %d-555-%04d", 200+rand.Intn(700), rand.Intn(10000))
			}

			// Dynamic fallback HEART score calculation
			historyPoints := 0
			riskPoints := 0
			for _, fhirCond := range fhirConds {
				desc := ""
				if len(fhirCond.Code.Coding) > 0 {
					desc = strings.ToLower(fhirCond.Code.Coding[0].Display)
				}
				if strings.Contains(desc, "coronary") || strings.Contains(desc, "myocardial") || strings.Contains(desc, "stroke") || strings.Contains(desc, "atrial fibrillation") || strings.Contains(desc, "heart failure") {
					historyPoints = 2
				}
				if strings.Contains(desc, "hypertension") {
					if historyPoints < 2 {
						historyPoints = 1
					}
					riskPoints++
				}
				if strings.Contains(desc, "diabetes") {
					riskPoints++
				}
				if strings.Contains(desc, "hyperlipidemia") || strings.Contains(desc, "cholesterol") {
					riskPoints++
				}
				if strings.Contains(desc, "obesity") || strings.Contains(desc, "overweight") {
					riskPoints++
				}
			}
			if riskPoints > 2 {
				riskPoints = 2
			}

			// Age points
			agePoints := 0
			age := time.Since(dob).Hours() / 24 / 365
			if age > 65 {
				agePoints = 2
			} else if age >= 45 {
				agePoints = 1
			}

			ecgPoints := rand.Intn(2)
			tropPoints := rand.Intn(2)

			computedScore := historyPoints + agePoints + riskPoints + ecgPoints + tropPoints
			if computedScore > 10 {
				computedScore = 10
			}
			if computedScore < 1 {
				computedScore = rand.Intn(3) + 1
			}

			heartScore = computedScore
			if heartScore <= 3 {
				heartCategory = "low"
				heartRec = "Low risk of adverse cardiac events. Discharge from ED/clinic is reasonable. Outpatient follow-up as needed."
			} else if heartScore <= 6 {
				heartCategory = "moderate"
				heartRec = "Moderate cardiac risk. Observation and serial ECG/troponin monitoring recommended. Schedule outpatient stress test or imaging."
			} else {
				heartCategory = "high"
				heartRec = "High risk of adverse cardiac events. Early invasive strategy (coronary angiogram, cardiology admission) is recommended. Optimize medical therapy."
			}
		}

		patient := models.Patient{
			UserID:                user.ID,
			DateOfBirth:           dob,
			Gender:                gender,
			MedicalRecordNumber:   fmt.Sprintf("FHIR-%s", fhirPat.ID),
			BloodType:             "O+",
			AssignedDoctorID:      &doctorID,
			EmergencyContactName:  emergencyName,
			EmergencyContactPhone: emergencyPhone,
		}
		if err := database.DB.Create(&patient).Error; err != nil {
			log.Printf("[SeedSynthea] Failed to create patient: %v", err)
			continue
		}

		log.Printf("[SeedSynthea] Seeded patient: %s (Local Patient ID: %d)", user.Name, patient.ID)

		// 4. Seed Conditions
		for _, fhirCond := range fhirConds {
			onset := time.Now()
			if fhirCond.OnsetDateTime != "" {
				if t, err := time.Parse("2006-01-02", fhirCond.OnsetDateTime[:10]); err == nil {
					onset = t
				}
			}
			icd10 := "U07.1"
			desc := "Unknown condition"
			if len(fhirCond.Code.Coding) > 0 {
				if fhirCond.Code.Coding[0].Code != "" {
					icd10 = fhirCond.Code.Coding[0].Code
				}
				if fhirCond.Code.Coding[0].Display != "" {
					desc = fhirCond.Code.Coding[0].Display
				}
			}
			status := "active"
			if len(fhirCond.ClinicalStatus.Coding) > 0 && fhirCond.ClinicalStatus.Coding[0].Code != "" {
				status = fhirCond.ClinicalStatus.Coding[0].Code
			}

			cond := models.Condition{
				PatientID:     patient.ID,
				ICD10Code:     icd10,
				Description:   desc,
				OnsetDate:     onset,
				Status:        status,
				DiagnosedByID: doctorID,
			}
			database.DB.Create(&cond)
		}

		// 5. Seed Medications
		for _, fhirMed := range fhirMeds {
			name := "Unknown Medication"
			if len(fhirMed.MedicationCodeableConcept.Coding) > 0 && fhirMed.MedicationCodeableConcept.Coding[0].Display != "" {
				name = fhirMed.MedicationCodeableConcept.Coding[0].Display
			} else if fhirMed.MedicationCodeableConcept.Text != "" {
				name = fhirMed.MedicationCodeableConcept.Text
			}
			dosage := "As directed"
			freq := "Once daily"
			if len(fhirMed.DosageInstruction) > 0 {
				if fhirMed.DosageInstruction[0].Text != "" {
					dosage = fhirMed.DosageInstruction[0].Text
				}
				if fhirMed.DosageInstruction[0].Timing.Repeat.Frequency > 0 {
					freq = fmt.Sprintf("%d times per %.1f %s",
						fhirMed.DosageInstruction[0].Timing.Repeat.Frequency,
						fhirMed.DosageInstruction[0].Timing.Repeat.Period,
						fhirMed.DosageInstruction[0].Timing.Repeat.PeriodUnit,
					)
				}
			}
			start := time.Now()
			if fhirMed.AuthoredOn != "" {
				if t, err := time.Parse(time.RFC3339, fhirMed.AuthoredOn); err == nil {
					start = t
				} else if t, err := time.Parse("2006-01-02", fhirMed.AuthoredOn[:10]); err == nil {
					start = t
				}
			}
			med := models.Medication{
				PatientID:      patient.ID,
				Name:           name,
				Dosage:         dosage,
				Frequency:      freq,
				StartDate:      start,
				PrescribedByID: doctorID,
				Status:         fhirMed.Status,
			}
			database.DB.Create(&med)
		}

		// 6. Seed Observations
		type parsedObs struct {
			fhirType string
			val      float64
			unit     string
			recorded time.Time
			notes    string
		}
		var pObsList []parsedObs
		var maxRecorded time.Time

		for _, fhirObs := range fhirObsList {
			val := 0.0
			unit := ""
			if fhirObs.ValueQuantity != nil {
				val = fhirObs.ValueQuantity.Value
				unit = fhirObs.ValueQuantity.Unit
			}
			obsType := "vital"
			notes := ""
			if len(fhirObs.Code.Coding) > 0 {
				if fhirObs.Code.Coding[0].Display != "" {
					obsType = fhirObs.Code.Coding[0].Display
					notes = fmt.Sprintf("Code: %s (%s)", fhirObs.Code.Coding[0].Code, fhirObs.Code.Coding[0].System)
				} else if fhirObs.Code.Coding[0].Code != "" {
					obsType = fhirObs.Code.Coding[0].Code
				}
			}
			recorded := time.Now()
			if fhirObs.EffectiveDateTime != "" {
				if t, err := time.Parse(time.RFC3339, fhirObs.EffectiveDateTime); err == nil {
					recorded = t
				} else if t, err := time.Parse("2006-01-02", fhirObs.EffectiveDateTime[:10]); err == nil {
					recorded = t
				}
			}
			mappedType := strings.ToLower(obsType)
			if strings.Contains(mappedType, "heart rate") || strings.Contains(mappedType, "pulse rate") {
				mappedType = "heart_rate"
			} else if strings.Contains(mappedType, "systolic") {
				mappedType = "systolic_bp"
			} else if strings.Contains(mappedType, "diastolic") {
				mappedType = "diastolic_bp"
			} else if strings.Contains(mappedType, "oxygen saturation") || strings.Contains(mappedType, "spo2") {
				mappedType = "spo2"
			} else if strings.Contains(mappedType, "respiratory rate") || strings.Contains(mappedType, "resp rate") {
				mappedType = "resp_rate"
			} else if strings.Contains(mappedType, "body temperature") || strings.Contains(mappedType, "temp") {
				mappedType = "temperature"
			}

			pObsList = append(pObsList, parsedObs{
				fhirType: mappedType,
				val:      val,
				unit:     unit,
				recorded: recorded,
				notes:    notes,
			})
			if !recorded.IsZero() && recorded.After(maxRecorded) {
				maxRecorded = recorded
			}
		}

		// Calculate shifting offset to make observations relative to time.Now()
		var timeOffset time.Duration
		if !maxRecorded.IsZero() {
			timeOffset = time.Now().Sub(maxRecorded)
		}

		// Group parsed observations by type
		obsByType := make(map[string][]parsedObs)
		for _, po := range pObsList {
			obsByType[po.fhirType] = append(obsByType[po.fhirType], po)
		}

		// Core vitals to expand into historical sequences if they lack data
		coreVitals := []string{"heart_rate", "systolic_bp", "diastolic_bp", "spo2"}

		for _, vt := range coreVitals {
			list, exists := obsByType[vt]
			if !exists || len(list) == 0 {
				continue
			}

			if len(list) == 1 {
				// Generate 10-14 historical readings to build a nice trend chart
				baseVal := list[0].val
				unit := list[0].unit
				notes := list[0].notes
				numReadings := rand.Intn(5) + 10 // 10 to 14 readings

				for i := 0; i < numReadings; i++ {
					// Time is shifted to the past: i days ago, plus a random jitter of hours/minutes
					t := time.Now().AddDate(0, 0, -i).Add(time.Duration(rand.Intn(1440)-720) * time.Minute)

					// Random fluctuation: +/- 5% for heart_rate, spo2; +/- 8 units for BP
					var fl float64
					if vt == "systolic_bp" || vt == "diastolic_bp" {
						fl = float64(rand.Intn(17) - 8) // +/- 8 mmHg
					} else if vt == "spo2" {
						fl = float64(rand.Intn(3) - 2) // +/- 1-2 %
					} else { // heart_rate
						fl = float64(rand.Intn(15) - 7) // +/- 7 bpm
					}

					newVal := baseVal + fl
					if vt == "spo2" {
						if newVal > 100 {
							newVal = 100
						}
						if newVal < 90 {
							newVal = 90
						}
					}
					if newVal < 30 {
						newVal = 30
					}

					obs := models.Observation{
						PatientID:    patient.ID,
						Type:         vt,
						Value:        newVal,
						Unit:         unit,
						RecordedByID: doctorID,
						RecordedAt:   t,
						IsAbnormal:   (vt == "systolic_bp" && newVal > 140) || (vt == "diastolic_bp" && newVal > 90) || (vt == "spo2" && newVal < 95) || (vt == "heart_rate" && newVal > 100),
						Notes:        notes,
					}
					database.DB.Create(&obs)
				}
			} else {
				// Multiple readings already exist: shift them relative to time.Now() and add randomized jitter
				for _, po := range list {
					t := po.recorded.Add(timeOffset)
					// Add randomized jitter of +/- 60 minutes so readings aren't exactly on the hour
					t = t.Add(time.Duration(rand.Intn(120)-60) * time.Minute)

					newVal := po.val + float64(rand.Intn(5)-2) // slight fluctuation (+/- 2 units)
					if vt == "spo2" {
						if newVal > 100 {
							newVal = 100
						}
					}
					if newVal < 1 {
						newVal = po.val
					}

					obs := models.Observation{
						PatientID:    patient.ID,
						Type:         vt,
						Value:        newVal,
						Unit:         po.unit,
						RecordedByID: doctorID,
						RecordedAt:   t,
						IsAbnormal:   (vt == "systolic_bp" && newVal > 140) || (vt == "diastolic_bp" && newVal > 90) || (vt == "spo2" && newVal < 95) || (vt == "heart_rate" && newVal > 100),
						Notes:        po.notes,
					}
					database.DB.Create(&obs)
				}
			}
		}

		// Also handle other non-core vitals (like resp_rate, temperature)
		for vt, list := range obsByType {
			isCore := false
			for _, cv := range coreVitals {
				if cv == vt {
					isCore = true
					break
				}
			}
			if isCore {
				continue
			}

			// Just shift and save non-core vitals with minor jitter
			for _, po := range list {
				t := po.recorded.Add(timeOffset).Add(time.Duration(rand.Intn(120)-60) * time.Minute)
				obs := models.Observation{
					PatientID:    patient.ID,
					Type:         vt,
					Value:        po.val,
					Unit:         po.unit,
					RecordedByID: doctorID,
					RecordedAt:   t,
					IsAbnormal:   false,
					Notes:        po.notes,
				}
				database.DB.Create(&obs)
			}
		}

		// 7. Seed local ECG Waveform Record
		os.MkdirAll("./uploads/ecg", os.ModePerm)
		filename := fmt.Sprintf("synthea_%s_ecg.txt", fhirPat.ID)
		filePath := filepath.Join("./uploads/ecg", filename)

		var sb strings.Builder
		for i := 0; i < 500; i++ {
			val := 0.1
			if i%100 == 0 {
				val = 1.2
			}
			sb.WriteString(strconv.FormatFloat(val, 'f', 4, 64))
			if i < 499 {
				sb.WriteString(" ")
			}
		}
		os.WriteFile(filePath, []byte(sb.String()), 0644)

		record := models.ECGRecord{
			PatientID:        patient.ID,
			FileURL:          filePath,
			UploadedByID:     doctorID,
			RecordedAt:       time.Now(),
			ProcessingStatus: "done",
		}
		database.DB.Create(&record)

		analysis := models.ECGAnalysis{
			ECGRecordID:       record.ID,
			HeartRateMean:     75.0,
			HeartRateMin:      60.0,
			HeartRateMax:      95.0,
			SDNN:              110.0,
			RMSSD:             45.0,
			PNN50:             12.0,
			RPeaksCount:       5,
			HRVInterpretation: "normal",
			AnalyzedAt:        time.Now(),
		}
		database.DB.Create(&analysis)

		// 8. Seed HEART Risk Assessment
		if heartScore > 0 {
			riskAssessment := models.RiskAssessment{
				PatientID:      patient.ID,
				ScoreType:      "HEART",
				ScoreValue:     heartScore,
				RiskCategory:   heartCategory,
				Recommendation: heartRec,
				CalculatedByID: doctorID,
				CalculatedAt:   time.Now(),
			}
			database.DB.Create(&riskAssessment)
			log.Printf("[SeedSynthea] Seeded HEART assessment (score=%d, category=%s) for patient %s",
				heartScore, heartCategory, user.Name)
		}
	}
}
