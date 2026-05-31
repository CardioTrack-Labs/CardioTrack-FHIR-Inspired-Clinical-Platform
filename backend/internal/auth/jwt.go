package auth

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"time"

	"github.com/AthanasiosChlr/cardiotrack/internal/config"
	"github.com/golang-jwt/jwt/v5"
)

type JWTClaim struct {
	UserID uint   `json:"user_id"`
	Role   string `json:"role"`
	jwt.RegisteredClaims
}

func GenerateTokens(userID uint, role string) (string, string, error) {
	cfg := config.Load()

	// Access Token
	expirationTime := time.Now().Add(15 * time.Minute)
	claims := &JWTClaim{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(expirationTime),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	accessToken, err := token.SignedString([]byte(cfg.JWTSecret))
	if err != nil {
		return "", "", err
	}

	// Refresh Token
	refreshExpirationTime := time.Now().Add(7 * 24 * time.Hour)
	refreshClaims := &JWTClaim{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExpirationTime),
		},
	}

	refreshTokenObj := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err := refreshTokenObj.SignedString([]byte(cfg.JWTRefreshSecret))
	if err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

func ValidateToken(signedToken string) (*JWTClaim, error) {
	cfg := config.Load()
	token, err := jwt.ParseWithClaims(
		signedToken,
		&JWTClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTSecret), nil
		},
	)

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaim)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token")
	}

	return claims, nil
}

func ValidateRefreshToken(signedToken string) (*JWTClaim, error) {
	cfg := config.Load()
	token, err := jwt.ParseWithClaims(
		signedToken,
		&JWTClaim{},
		func(token *jwt.Token) (interface{}, error) {
			return []byte(cfg.JWTRefreshSecret), nil
		},
	)

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*JWTClaim)
	if !ok || !token.Valid {
		return nil, errors.New("invalid refresh token")
	}

	return claims, nil
}

func HashToken(token string) string {
	hash := sha256.Sum256([]byte(token))
	return hex.EncodeToString(hash[:])
}
