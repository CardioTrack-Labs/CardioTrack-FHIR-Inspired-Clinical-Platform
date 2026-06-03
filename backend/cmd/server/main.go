package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/AthanasiosChlr/cardiotrack/internal/config"
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/messaging"
	"github.com/AthanasiosChlr/cardiotrack/internal/middleware"
	"github.com/AthanasiosChlr/cardiotrack/internal/routes"
	"github.com/AthanasiosChlr/cardiotrack/internal/seed"
	"github.com/AthanasiosChlr/cardiotrack/internal/websocket"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	gin.SetMode(cfg.GinMode)

	// Initialize global WebSocket Hub for real-time clinical communication
	hub := websocket.NewHub()
	go hub.Run()

	r := gin.Default()

	// Apply CORS middleware
	r.Use(middleware.CORSMiddleware(cfg.AllowedOrigins))

	// Serve uploaded clinical files statically
	r.Static("/uploads", "./uploads")

	// Health check — used by Render and Docker to verify the service is up
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// WebSocket connection upgrading endpoint
	r.GET("/ws", func(c *gin.Context) {
		websocket.ServeWS(hub, c)
	})

	// Initialize global Live Telemetry Hub for real-time vitals streaming
	telemetryHub := websocket.InitTelemetryHub()

	// Live telemetry WebSocket connection upgrading endpoint
	r.GET("/ws/live-monitor", func(c *gin.Context) {
		websocket.ServeTelemetryWS(telemetryHub, c)
	})

	// Initialize Database and run auto migration
	database.Connect(cfg.DatabaseURL)

	// Seed database with demo data if empty
	seed.Run()
	// Patch rich clinical demo data (observations + medications with correct types)
	seed.PatchClinicalData()

	// Register all API routes
	routes.RegisterRoutes(r)

	// Initialize RabbitMQ connection + ECG queue publisher
	messaging.InitRabbitMQ(cfg.RabbitMQURL)
	defer func() {
		if mq := messaging.GetRabbitMQ(); mq != nil {
			mq.Close()
		}
	}()

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Server starting on %s (mode: %s)", addr, cfg.GinMode)

	if err := r.Run(addr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
