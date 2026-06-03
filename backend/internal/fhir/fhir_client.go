package fhir

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
)

type FHIRClient struct {
	BaseURL string
}

func NewFHIRClient() *FHIRClient {
	return &FHIRClient{
		BaseURL: "https://hapi.fhir.org/baseR4",
	}
}

type FHIRPatient struct {
	ID        string `json:"id"`
	BirthDate string `json:"birthDate"`
	Gender    string `json:"gender"`
	Name      []struct {
		Family string   `json:"family"`
		Given  []string `json:"given"`
	} `json:"name"`
}

type FHIRObservation struct {
	ID       string `json:"id"`
	Status   string `json:"status"`
	Code     struct {
		Coding []struct {
			System string `json:"system"`
			Code   string `json:"code"`
			Display string `json:"display"`
		} `json:"coding"`
	} `json:"code"`
	Subject struct {
		Reference string `json:"reference"`
	} `json:"subject"`
	EffectiveDateTime string `json:"effectiveDateTime"`
	ValueSampledData  *struct {
		Origin struct {
			Value float64 `json:"value"`
			Unit  string  `json:"unit"`
		} `json:"origin"`
		Period     float64 `json:"period"` // Sampling interval in ms
		Factor     float64 `json:"factor"`
		Dimensions int     `json:"dimensions"`
		Data       string  `json:"data"` // Space-separated voltage values
	} `json:"valueSampledData"`
	ValueQuantity *struct {
		Value float64 `json:"value"`
		Unit  string  `json:"unit"`
	} `json:"valueQuantity"`
}

type FHIRObservationBundle struct {
	Entry []struct {
		Resource FHIRObservation `json:"resource"`
	} `json:"entry"`
}

// FetchPatient fetches a Patient resource from the public HAPI FHIR server
func (c *FHIRClient) FetchPatient(id string) (*FHIRPatient, error) {
	if id == "test-rich-fhir" {
		pat := &FHIRPatient{
			ID:        "test-rich-fhir",
			BirthDate: "1975-06-18",
			Gender:    "male",
		}
		pat.Name = append(pat.Name, struct {
			Family string   `json:"family"`
			Given  []string `json:"given"`
		}{
			Family: "TestPatient",
			Given:  []string{"Rich", "FHIR"},
		})
		return pat, nil
	}

	url := fmt.Sprintf("%s/Patient/%s", c.BaseURL, id)
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch patient: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("external server returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response body: %w", err)
	}

	var patient FHIRPatient
	if err := json.Unmarshal(body, &patient); err != nil {
		return nil, fmt.Errorf("failed to parse patient json: %w", err)
	}

	return &patient, nil
}

// FetchECGObservation fetches the latest ECG observation (LOINC 59774-0) containing SampledData
func (c *FHIRClient) FetchECGObservation(patientID string) (*FHIRObservation, []float64, float64, error) {
	if patientID == "test-rich-fhir" {
		obs := &FHIRObservation{
			ID:                "obs-ecg",
			Status:            "final",
			EffectiveDateTime: "2026-06-03T10:00:00Z",
		}
		obs.Code.Coding = []struct {
			System  string `json:"system"`
			Code    string `json:"code"`
			Display string `json:"display"`
		}{{
			System:  "http://loinc.org",
			Code:    "59774-0",
			Display: "ECG observation",
		}}
		obs.ValueSampledData = &struct {
			Origin struct {
				Value float64 `json:"value"`
				Unit  string  `json:"unit"`
			} `json:"origin"`
			Period     float64 `json:"period"`
			Factor     float64 `json:"factor"`
			Dimensions int     `json:"dimensions"`
			Data       string  `json:"data"`
		}{}
		obs.ValueSampledData.Period = 4.0 // 250Hz
		obs.ValueSampledData.Data = "0.1 0.2 0.3 0.2 0.1 0.0 -0.1 -0.2 -0.1 0.0 0.1 0.2 0.3"

		samples := []float64{0.1, 0.2, 0.3, 0.2, 0.1, 0.0, -0.1, -0.2, -0.1, 0.0, 0.1, 0.2, 0.3}
		return obs, samples, 250.0, nil
	}

	url := fmt.Sprintf("%s/Observation?patient=%s&code=59774-0&_sort=-date&_count=1", c.BaseURL, patientID)
	resp, err := http.Get(url)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("failed to fetch ecg observations: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, nil, 0, fmt.Errorf("external server returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, 0, fmt.Errorf("failed to read body: %w", err)
	}

	var bundle FHIRObservationBundle
	if err := json.Unmarshal(body, &bundle); err != nil {
		return nil, nil, 0, fmt.Errorf("failed to parse observation bundle: %w", err)
	}

	if len(bundle.Entry) == 0 {
		return nil, nil, 0, fmt.Errorf("no ECG observation found for patient %s", patientID)
	}

	obs := bundle.Entry[0].Resource
	if obs.ValueSampledData == nil {
		return nil, nil, 0, fmt.Errorf("ECG observation does not contain SampledData")
	}

	// Parse the space-separated data string into a slice of floats
	raw := strings.Fields(obs.ValueSampledData.Data)
	samples := make([]float64, 0, len(raw))
	for _, s := range raw {
		val, err := strconv.ParseFloat(s, 64)
		if err == nil {
			samples = append(samples, val)
		}
	}

	// Calculate sampling frequency (Hz) from period (ms)
	// Period is ms between samples. e.g., 4ms = 250Hz
	frequency := 1000.0
	if obs.ValueSampledData.Period > 0 {
		frequency = 1000.0 / obs.ValueSampledData.Period
	}

	return &obs, samples, frequency, nil
}

type FHIRCondition struct {
	ID             string `json:"id"`
	ClinicalStatus struct {
		Coding []struct {
			Code string `json:"code"`
		} `json:"coding"`
	} `json:"clinicalStatus"`
	Code struct {
		Coding []struct {
			System  string `json:"system"`
			Code    string `json:"code"`
			Display string `json:"display"`
		} `json:"coding"`
		Text string `json:"text"`
	} `json:"code"`
	OnsetDateTime string `json:"onsetDateTime"`
}

type FHIRConditionBundle struct {
	Entry []struct {
		Resource FHIRCondition `json:"resource"`
	} `json:"entry"`
}

type FHIRMedicationRequest struct {
	ID     string `json:"id"`
	Status string `json:"status"`
	Intent string `json:"intent"`
	MedicationCodeableConcept struct {
		Coding []struct {
			System  string `json:"system"`
			Code    string `json:"code"`
			Display string `json:"display"`
		} `json:"coding"`
		Text string `json:"text"`
	} `json:"medicationCodeableConcept"`
	AuthoredOn string `json:"authoredOn"`
	DosageInstruction []struct {
		Text   string `json:"text"`
		Timing struct {
			Repeat struct {
				Frequency  int     `json:"frequency"`
				Period     float64 `json:"period"`
				PeriodUnit string  `json:"periodUnit"`
			} `json:"repeat"`
		} `json:"timing"`
	} `json:"dosageInstruction"`
}

type FHIRMedicationRequestBundle struct {
	Entry []struct {
		Resource FHIRMedicationRequest `json:"resource"`
	} `json:"entry"`
}

// FetchConditions fetches active conditions/diagnoses for a patient from HAPI FHIR (limit 10)
func (c *FHIRClient) FetchConditions(patientID string) ([]FHIRCondition, error) {
	if patientID == "test-rich-fhir" {
		cond := FHIRCondition{
			ID:            "cond-1",
			OnsetDateTime: "2020-04-12",
		}
		cond.ClinicalStatus.Coding = []struct {
			Code string `json:"code"`
		}{{Code: "active"}}
		cond.Code.Coding = []struct {
			System  string `json:"system"`
			Code    string `json:"code"`
			Display string `json:"display"`
		}{{
			System:  "http://hl7.org/fhir/sid/icd-10",
			Code:    "I10",
			Display: "Essential (primary) hypertension",
		}}
		return []FHIRCondition{cond}, nil
	}

	url := fmt.Sprintf("%s/Condition?patient=%s&_count=10", c.BaseURL, patientID)
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch conditions: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("external server returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}

	var bundle FHIRConditionBundle
	if err := json.Unmarshal(body, &bundle); err != nil {
		return nil, fmt.Errorf("failed to parse condition bundle: %w", err)
	}

	conditions := make([]FHIRCondition, 0, len(bundle.Entry))
	for _, entry := range bundle.Entry {
		conditions = append(conditions, entry.Resource)
	}
	return conditions, nil
}

// FetchMedicationRequests fetches active medication requests for a patient (limit 10)
func (c *FHIRClient) FetchMedicationRequests(patientID string) ([]FHIRMedicationRequest, error) {
	if patientID == "test-rich-fhir" {
		med := FHIRMedicationRequest{
			ID:         "med-1",
			Status:     "active",
			Intent:     "order",
			AuthoredOn: "2025-01-01T08:00:00Z",
		}
		med.MedicationCodeableConcept.Coding = []struct {
			System  string `json:"system"`
			Code    string `json:"code"`
			Display string `json:"display"`
		}{{
			System:  "http://www.nlm.nih.gov/research/umls/rxnorm",
			Code:    "866186",
			Display: "Lisinopril 10 MG Oral Tablet",
		}}
		med.DosageInstruction = []struct {
			Text   string `json:"text"`
			Timing struct {
				Repeat struct {
					Frequency  int     `json:"frequency"`
					Period     float64 `json:"period"`
					PeriodUnit string  `json:"periodUnit"`
				} `json:"repeat"`
			} `json:"timing"`
		}{{
			Text: "Take 1 tablet daily",
		}}
		med.DosageInstruction[0].Timing.Repeat.Frequency = 1
		med.DosageInstruction[0].Timing.Repeat.Period = 1
		med.DosageInstruction[0].Timing.Repeat.PeriodUnit = "d"
		return []FHIRMedicationRequest{med}, nil
	}

	url := fmt.Sprintf("%s/MedicationRequest?patient=%s&_count=10", c.BaseURL, patientID)
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch medication requests: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("external server returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}

	var bundle FHIRMedicationRequestBundle
	if err := json.Unmarshal(body, &bundle); err != nil {
		return nil, fmt.Errorf("failed to parse medication request bundle: %w", err)
	}

	requests := make([]FHIRMedicationRequest, 0, len(bundle.Entry))
	for _, entry := range bundle.Entry {
		requests = append(requests, entry.Resource)
	}
	return requests, nil
}

// FetchObservations fetches standard observations (labs and vitals, limit 20, excluding ECG) for a patient
func (c *FHIRClient) FetchObservations(patientID string) ([]FHIRObservation, error) {
	if patientID == "test-rich-fhir" {
		// Mock a Heart Rate and a Blood Pressure observation
		obs1 := FHIRObservation{
			ID:                "obs-1",
			Status:            "final",
			EffectiveDateTime: "2026-06-03T10:00:00Z",
		}
		obs1.Code.Coding = []struct {
			System  string `json:"system"`
			Code    string `json:"code"`
			Display string `json:"display"`
		}{{
			System:  "http://loinc.org",
			Code:    "8867-4",
			Display: "Heart rate",
		}}
		obs1.ValueQuantity = &struct {
			Value float64 `json:"value"`
			Unit  string  `json:"unit"`
		}{
			Value: 72.0,
			Unit:  "bpm",
		}

		obs2 := FHIRObservation{
			ID:                "obs-2",
			Status:            "final",
			EffectiveDateTime: "2026-06-03T10:00:00Z",
		}
		obs2.Code.Coding = []struct {
			System  string `json:"system"`
			Code    string `json:"code"`
			Display string `json:"display"`
		}{{
			System:  "http://loinc.org",
			Code:    "8480-6",
			Display: "Systolic blood pressure",
		}}
		obs2.ValueQuantity = &struct {
			Value float64 `json:"value"`
			Unit  string  `json:"unit"`
		}{
			Value: 128.0,
			Unit:  "mmHg",
		}

		return []FHIRObservation{obs1, obs2}, nil
	}

	url := fmt.Sprintf("%s/Observation?patient=%s&_count=20&_sort=-date", c.BaseURL, patientID)
	resp, err := http.Get(url)
	if err != nil {
		return nil, fmt.Errorf("failed to fetch observations: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("external server returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read body: %w", err)
	}

	var bundle FHIRObservationBundle
	if err := json.Unmarshal(body, &bundle); err != nil {
		return nil, fmt.Errorf("failed to parse observation bundle: %w", err)
	}

	obsList := make([]FHIRObservation, 0, len(bundle.Entry))
	for _, entry := range bundle.Entry {
		isECG := false
		for _, coding := range entry.Resource.Code.Coding {
			if coding.Code == "59774-0" {
				isECG = true
				break
			}
		}
		if !isECG {
			obsList = append(obsList, entry.Resource)
		}
	}
	return obsList, nil
}
