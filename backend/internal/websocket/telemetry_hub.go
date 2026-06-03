package websocket

import (
	"encoding/json"
	"log"
	"math"
	"math/rand"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type TelemetryClient struct {
	PatientID uint
	Hub       *TelemetryHub
	Conn      *websocket.Conn
	Send      chan []byte
}

type TelemetryHub struct {
	subscriptions map[uint]map[*TelemetryClient]bool
	register      chan *TelemetryClient
	unregister    chan *TelemetryClient
	broadcast     chan TelemetryMessage
	mu            sync.RWMutex
}

type TelemetryMessage struct {
	PatientID  uint      `json:"patient_id"`
	Type       string    `json:"type"` // e.g., heart_rate, systolic_bp, diastolic_bp, spo2
	Value      float64   `json:"value"`
	Unit       string    `json:"unit"`
	RecordedAt time.Time `json:"recorded_at"`
	IsAbnormal bool      `json:"is_abnormal"`
}

var (
	telemetryHubInstance *TelemetryHub
	telemetryOnce        sync.Once
)

func InitTelemetryHub() *TelemetryHub {
	telemetryOnce.Do(func() {
		telemetryHubInstance = &TelemetryHub{
			subscriptions: make(map[uint]map[*TelemetryClient]bool),
			register:      make(chan *TelemetryClient),
			unregister:    make(chan *TelemetryClient),
			broadcast:     make(chan TelemetryMessage, 100),
		}
		go telemetryHubInstance.Run()
	})
	return telemetryHubInstance
}

func GetTelemetryHub() *TelemetryHub {
	return telemetryHubInstance
}

func (h *TelemetryHub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			if _, ok := h.subscriptions[client.PatientID]; !ok {
				h.subscriptions[client.PatientID] = make(map[*TelemetryClient]bool)
			}
			h.subscriptions[client.PatientID][client] = true
			h.mu.Unlock()
			log.Printf("[WS Telemetry] Registered client for patient %d", client.PatientID)

		case client := <-h.unregister:
			h.mu.Lock()
			if clients, ok := h.subscriptions[client.PatientID]; ok {
				if _, exists := clients[client]; exists {
					delete(clients, client)
					close(client.Send)
					client.Conn.Close()
					log.Printf("[WS Telemetry] Unregistered client for patient %d", client.PatientID)
				}
				if len(clients) == 0 {
					delete(h.subscriptions, client.PatientID)
				}
			}
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.RLock()
			clients, ok := h.subscriptions[msg.PatientID]
			if ok {
				msgBytes, err := json.Marshal(msg)
				if err == nil {
					for client := range clients {
						select {
						case client.Send <- msgBytes:
						default:
							h.mu.RUnlock()
							h.mu.Lock()
							delete(clients, client)
							close(client.Send)
							client.Conn.Close()
							h.mu.Unlock()
							h.mu.RLock()
						}
					}
				}
			}
			h.mu.RUnlock()
		}
	}
}

// BroadcastVital publishes a vital measurement to all subscribed patient monitors
func (h *TelemetryHub) BroadcastVital(patientID uint, vitalType string, value float64, unit string, isAbnormal bool) {
	h.broadcast <- TelemetryMessage{
		PatientID:  patientID,
		Type:       vitalType,
		Value:      value,
		Unit:       unit,
		RecordedAt: time.Now(),
		IsAbnormal: isAbnormal,
	}
}

// StartDemoStream launches a goroutine that emits realistic physiological vital
// fluctuations for the given patient every 2 seconds.  It exits automatically
// when the patient loses all WebSocket subscribers.
func (h *TelemetryHub) StartDemoStream(patientID uint) {
	go func() {
		// Initial "baseline" values – clinically plausible at rest
		hr := 72.0 + rand.Float64()*6
		spo2 := 97.5 + rand.Float64()*1.5
		sbp := 118.0 + rand.Float64()*8
		dbp := 76.0 + rand.Float64()*6
		rr := 15.0 + rand.Float64()*2
		temp := 36.6 + rand.Float64()*0.4
		hrv := 62.0 + rand.Float64()*12

		ticker := time.NewTicker(2 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			// Stop streaming when no clients remain for this patient
			h.mu.RLock()
			clients := h.subscriptions[patientID]
			active := len(clients) > 0
			h.mu.RUnlock()
			if !active {
				log.Printf("[DemoStream] No clients left for patient %d — stopping stream", patientID)
				return
			}

			// ── Physiological random walk (bounded) ────────────────────
			hr += (rand.Float64()-0.5)*1.8 + 0.05*math.Sin(float64(time.Now().Unix())/40.0)
			hr = math.Max(52, math.Min(115, hr))

			spo2 += (rand.Float64() - 0.5) * 0.2
			spo2 = math.Max(94, math.Min(100, spo2))

			sbp += (rand.Float64() - 0.5) * 1.5
			sbp = math.Max(90, math.Min(170, sbp))

			dbp += (rand.Float64() - 0.5) * 1.0
			dbp = math.Max(55, math.Min(110, dbp))

			rr += (rand.Float64() - 0.5) * 0.4
			rr = math.Max(10, math.Min(24, rr))

			temp += (rand.Float64() - 0.5) * 0.05
			temp = math.Max(35.5, math.Min(39.5, temp))

			hrv += (rand.Float64() - 0.5) * 2.0
			hrv = math.Max(20, math.Min(120, hrv))

			// ── Abnormality thresholds ─────────────────────────────────
			hrAbn := hr > 100 || hr < 55
			spo2Abn := spo2 < 92
			sbpAbn := sbp > 160 || sbp < 85
			rrAbn := rr > 22 || rr < 10
			tempAbn := temp > 38.5 || temp < 36.0

			// ── Broadcast each vital ───────────────────────────────────
			type vital struct {
				vType string
				val   float64
				unit  string
				abn   bool
			}
			vitals := []vital{
				{"heart_rate", math.Round(hr), "bpm", hrAbn},
				{"spo2", math.Round(spo2*10) / 10, "%", spo2Abn},
				{"systolic_bp", math.Round(sbp), "mmHg", sbpAbn},
				{"diastolic_bp", math.Round(dbp), "mmHg", false},
				{"resp_rate", math.Round(rr), "br/min", rrAbn},
				{"temperature", math.Round(temp*10) / 10, "°C", tempAbn},
				{"hrv_sdnn", math.Round(hrv*10) / 10, "ms", hrv < 30},
			}

			for _, v := range vitals {
				h.broadcast <- TelemetryMessage{
					PatientID:  patientID,
					Type:       v.vType,
					Value:      v.val,
					Unit:       v.unit,
					RecordedAt: time.Now(),
					IsAbnormal: v.abn,
				}
			}
		}
	}()
}

func (c *TelemetryClient) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	// Clients only consume live data, but we keep readPump alive to listen for close signals
	c.Conn.SetReadLimit(512)
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, _, err := c.Conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (c *TelemetryClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case msg, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(msg)
			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// ServeTelemetryWS upgrades connections for live vitals monitoring
func ServeTelemetryWS(hub *TelemetryHub, c *gin.Context) {
	patientIDStr := c.Query("patient_id")
	if patientIDStr == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing patient_id in query"})
		return
	}

	patientID, err := strconv.ParseUint(patientIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid patient_id"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[WS Telemetry Upgrade] Upgrade failed: %v", err)
		return
	}

	client := &TelemetryClient{
		PatientID: uint(patientID),
		Hub:       hub,
		Conn:      conn,
		Send:      make(chan []byte, 256),
	}

	client.Hub.register <- client

	// Start physiological demo stream immediately so the monitor shows live data
	hub.StartDemoStream(uint(patientID))

	go client.writePump()
	go client.readPump()
}
