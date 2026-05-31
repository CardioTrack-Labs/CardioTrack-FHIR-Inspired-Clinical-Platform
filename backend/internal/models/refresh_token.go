package models

import (
	"time"
)

type RefreshToken struct {
	ID        uint       `gorm:"primaryKey"`
	UserID    uint       `gorm:"not null;index"`
	User      User       `gorm:"foreignKey:UserID"`
	TokenHash string     `gorm:"not null;uniqueIndex"`
	ExpiresAt time.Time  `gorm:"not null"`
	RevokedAt *time.Time `gorm:"index"`
	CreatedAt time.Time
}
