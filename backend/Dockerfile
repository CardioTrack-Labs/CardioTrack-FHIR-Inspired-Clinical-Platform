FROM golang:1.21-alpine AS builder

WORKDIR /app

# Download dependencies first (cached layer)
COPY go.mod go.sum ./
RUN go mod download

# Copy source and build
COPY . .
RUN go build -o server ./cmd/server

# ─── Runtime image ────────────────────────────────────────────────────────────
FROM alpine:3.19

WORKDIR /app

# ca-certificates needed for TLS connections (Supabase)
RUN apk --no-cache add ca-certificates

COPY --from=builder /app/server .

# uploads directory for file storage
RUN mkdir -p uploads

EXPOSE 8080

CMD ["./server"]
