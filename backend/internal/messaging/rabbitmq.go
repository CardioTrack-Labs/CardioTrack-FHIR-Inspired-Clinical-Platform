package messaging

import (
	"context"
	"log"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

type RabbitMQClient struct {
	conn    *amqp.Connection
	channel *amqp.Channel
	queueName string
	mu      sync.RWMutex
}

var (
	instance *RabbitMQClient
	once     sync.Once
)

func InitRabbitMQ(url string) {
	once.Do(func() {
		client := &RabbitMQClient{
			queueName: "ecg_processing",
		}
		
		log.Printf("[RabbitMQ] Connecting to broker at %s", url)
		conn, err := amqp.Dial(url)
		if err != nil {
			log.Printf("[RabbitMQ] WARNING: Failed to connect to RabbitMQ broker: %v. Running in localized fallback mode (offline).", err)
			instance = client
			return
		}

		ch, err := conn.Channel()
		if err != nil {
			log.Printf("[RabbitMQ] WARNING: Failed to open channel: %v", err)
			conn.Close()
			instance = client
			return
		}

		_, err = ch.QueueDeclare(
			client.queueName, // name
			true,             // durable
			false,            // delete when unused
			false,            // exclusive
			false,            // no-wait
			nil,              // arguments
		)
		if err != nil {
			log.Printf("[RabbitMQ] WARNING: Failed to declare queue: %v", err)
			ch.Close()
			conn.Close()
			instance = client
			return
		}

		client.conn = conn
		client.channel = ch
		instance = client
		log.Println("[RabbitMQ] Connected and queue 'ecg_processing' declared successfully.")
	})
}

func GetRabbitMQ() *RabbitMQClient {
	return instance
}

func (r *RabbitMQClient) IsConnected() bool {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.conn != nil && !r.conn.IsClosed()
}

func (r *RabbitMQClient) Publish(body []byte) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.conn == nil || r.conn.IsClosed() || r.channel == nil {
		log.Println("[RabbitMQ] Broker is offline. Falling back to local log processing...")
		return nil
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	err := r.channel.PublishWithContext(ctx,
		"",          // exchange
		r.queueName, // routing key
		false,       // mandatory
		false,       // immediate
		amqp.Publishing{
			ContentType:  "application/json",
			DeliveryMode: amqp.Persistent,
			Body:         body,
			Timestamp:    time.Now(),
		},
	)
	if err != nil {
		log.Printf("[RabbitMQ] Error publishing message: %v", err)
		return err
	}

	log.Printf("[RabbitMQ] Message published successfully (%d bytes)", len(body))
	return nil
}

func (r *RabbitMQClient) Close() {
	r.mu.Lock()
	defer r.mu.Unlock()

	if r.channel != nil {
		r.channel.Close()
	}
	if r.conn != nil {
		r.conn.Close()
	}
}
