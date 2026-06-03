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
