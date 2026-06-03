package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL        string
	JWTSecret          string
	JWTRefreshSecret   string
	Port               string
	GinMode            string
	AllowedOrigins     string
	RabbitMQURL        string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}

	return &Config{
		DatabaseURL:      requireEnv("DATABASE_URL"),
		JWTSecret:        requireEnv("JWT_SECRET"),
		JWTRefreshSecret: requireEnv("JWT_REFRESH_SECRET"),
		Port:             getEnv("PORT", "8080"),
		GinMode:          getEnv("GIN_MODE", "debug"),
		AllowedOrigins:   getEnv("ALLOWED_ORIGINS", "http://localhost:5173"),
		RabbitMQURL:      getEnv("RABBITMQ_URL", "amqp://guest:guest@localhost:5672/"),
	}
}

func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("Required environment variable %s is not set", key)
	}
	return v
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
