package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/AthanasiosChlr/cardiotrack/internal/config"
	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	gin.SetMode(cfg.GinMode)

	r := gin.Default()

	// Health check — used by Render and Docker to verify the service is up
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// TODO(author): Routes are registered in internal/routes/router.go (added in Commit 3)
	// TODO(author): Add RabbitMQ connection + ECG queue publisher (future phase)
	// TODO(author): Add WebSocket hub initialization for live vitals (future phase)
	// TODO(author): Add Prometheus metrics endpoint /metrics (future phase)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("Server starting on %s (mode: %s)", addr, cfg.GinMode)

	if err := r.Run(addr); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
