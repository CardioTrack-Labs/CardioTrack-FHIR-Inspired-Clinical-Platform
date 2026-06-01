package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/AthanasiosChlr/cardiotrack/internal/config"
	"github.com/AthanasiosChlr/cardiotrack/internal/database"
	"github.com/AthanasiosChlr/cardiotrack/internal/middleware"
	"github.com/AthanasiosChlr/cardiotrack/internal/routes"
	"github.com/AthanasiosChlr/cardiotrack/internal/seed"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	gin.SetMode(cfg.GinMode)

	r := gin.Default()

	// Apply CORS middleware
	r.Use(middleware.CORSMiddleware(cfg.AllowedOrigins))

	// Serve uploaded clinical files statically
	r.Static("/uploads", "./uploads")

	// Health check — used by Render and Docker to verify the service is up
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// Initialize Database and run auto migration
	database.Connect(cfg.DatabaseURL)

	// Seed database with demo data if empty
	seed.Run()
	// Patch rich clinical demo data (observations + medications with correct types)
	seed.PatchClinicalData()

	// Register all API routes
	routes.RegisterRoutes(r)

	// TODO(author): Add RabbitMQ connection + ECG queue publisher (future phase)
	// TODO(author): Add WebSocket hub initialization for live vitals (future phase)
	// TODO(author): Add Prometheus metrics endpoint /metrics (future phase)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Server starting on %s (mode: %s)", addr, cfg.GinMode)

	if err := r.Run(addr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
