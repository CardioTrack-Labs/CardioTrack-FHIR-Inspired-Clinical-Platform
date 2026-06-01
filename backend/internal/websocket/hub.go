package websocket

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

// Message represents the chat data structure exchanged over WebSocket.
type Message struct {
	SenderID   uint   `json:"sender_id"`
	ReceiverID uint   `json:"receiver_id"`
	Text       string `json:"text"`
	Time       string `json:"time"`
}

// Client represents an active, connected user socket in the clinical system.
type Client struct {
	UserID uint
	Role   string
	Hub    *Hub
	Conn   *websocket.Conn
	Send   chan []byte
}

// Hub orchestrates the registration, unregistration, and message routing.
type Hub struct {
	clients    map[*Client]bool
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run listens on channels to coordinate client pool access safely.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			// Evict any stale connection for the same user-id to prevent leaks
			for c := range h.clients {
				if c.UserID == client.UserID {
					close(c.Send)
					c.Conn.Close()
					delete(h.clients, c)
				}
			}
			h.clients[client] = true
			h.mu.Unlock()
			log.Printf("[WS Hub] Registered user %d (role: %s)", client.UserID, client.Role)

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				log.Printf("[WS Hub] Unregistered user %d", client.UserID)
			}
			h.mu.Unlock()
		}
	}
}

// RouteMessage delivers a payload directly to a specific connected recipient.
func (h *Hub) RouteMessage(msgBytes []byte) {
	var msg Message
	if err := json.Unmarshal(msgBytes, &msg); err != nil {
		log.Printf("[WS Hub] Error unmarshaling message: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	// Forward message directly to the recipient client
	routed := false
	for client := range h.clients {
		if client.UserID == msg.ReceiverID {
			select {
			case client.Send <- msgBytes:
				routed = true
			default:
				close(client.Send)
				delete(h.clients, client)
			}
		}
	}

	if routed {
		log.Printf("[WS Hub] Routed message from %d to %d", msg.SenderID, msg.ReceiverID)
	} else {
		log.Printf("[WS Hub] Recipient user %d not online. Storing locally...", msg.ReceiverID)
	}
}

// readPump pumps messages from the websocket connection to the hub routing engine.
func (c *Client) readPump() {
	defer func() {
		c.Hub.unregister <- c
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(512 * 1024) // 512 KB limit
	c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[WS Client] unexpected close error: %v", err)
			}
			break
		}
		
		// Deliver the JSON payload
		c.Hub.RouteMessage(message)
	}
}

// writePump pumps messages from the send channel out to the WebSocket.
func (c *Client) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.Conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

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

// Upgrader upgrades HTTP connection to WebSocket protocol.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Relax origin checks for localized multi-origin dev settings (Vercel & Render mounts)
		return true
	},
}

// ServeWS handles WebSocket upgrading requests.
func ServeWS(hub *Hub, c *gin.Context) {
	userIDStr := c.Query("user_id")
	role := c.Query("role")

	if userIDStr == "" || role == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing user_id or role in query"})
		return
	}

	userID, err := strconv.ParseUint(userIDStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user_id"})
		return
	}

	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[WS Upgrade] Upgrade failed: %v", err)
		return
	}

	client := &Client{
		UserID: uint(userID),
		Role:   role,
		Hub:    hub,
		Conn:   conn,
		Send:   make(chan []byte, 256),
	}

	client.Hub.register <- client

	// Start read/write pumps in separate goroutines
	go client.writePump()
	go client.readPump()
}
