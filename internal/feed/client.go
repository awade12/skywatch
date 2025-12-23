package feed

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"sync"
	"sync/atomic"
	"time"

	"adsb-tracker/internal/beast"
	"adsb-tracker/internal/sbs"
	"adsb-tracker/internal/tracker"
)

type FeedStats struct {
	Connected       bool      `json:"connected"`
	LastMessage     time.Time `json:"last_message"`
	MessagesTotal   uint64    `json:"messages_total"`
	MessagesPerSec  float64   `json:"messages_per_sec"`
	ConnectionTime  time.Time `json:"connection_time"`
	Reconnects      int       `json:"reconnects"`
	Host            string    `json:"host"`
	Port            int       `json:"port"`
	Format          string    `json:"format"`
}

type Client struct {
	host       string
	port       int
	feedFormat string
	tracker    *tracker.Tracker
	rxLat      float64
	rxLon      float64

	mu              sync.RWMutex
	connected       bool
	connectionTime  time.Time
	lastMessage     time.Time
	messagesTotal   uint64
	messageCount    uint64
	messagesPerSec  float64
	reconnects      int
}

func NewClient(host string, port int, feedFormat string, rxLat, rxLon float64, t *tracker.Tracker) *Client {
	if feedFormat == "" {
		feedFormat = "sbs"
	}
	return &Client{
		host:       host,
		port:       port,
		feedFormat: feedFormat,
		tracker:    t,
		rxLat:      rxLat,
		rxLon:      rxLon,
	}
}

func (c *Client) Run(ctx context.Context) {
	addr := fmt.Sprintf("%s:%d", c.host, c.port)
	backoff := time.Second

	go c.calculateMessageRate(ctx)

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		if err := c.connect(ctx, addr); err != nil {
			c.setConnected(false)
			log.Printf("[FEED] Connection error: %v, reconnecting in %v", err, backoff)
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
			}
			backoff = min(backoff*2, 30*time.Second)
			c.mu.Lock()
			c.reconnects++
			c.mu.Unlock()
		} else {
			backoff = time.Second
		}
	}
}

func (c *Client) calculateMessageRate(ctx context.Context) {
	ticker := time.NewTicker(time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			count := atomic.SwapUint64(&c.messageCount, 0)
			c.mu.Lock()
			c.messagesPerSec = float64(count)
			c.mu.Unlock()
		}
	}
}

func (c *Client) recordMessage() {
	atomic.AddUint64(&c.messageCount, 1)
	atomic.AddUint64(&c.messagesTotal, 1)
	c.mu.Lock()
	c.lastMessage = time.Now()
	c.mu.Unlock()
}

func (c *Client) setConnected(connected bool) {
	c.mu.Lock()
	c.connected = connected
	if connected {
		c.connectionTime = time.Now()
	}
	c.mu.Unlock()
}

func (c *Client) GetStats() FeedStats {
	c.mu.RLock()
	defer c.mu.RUnlock()

	return FeedStats{
		Connected:       c.connected,
		LastMessage:     c.lastMessage,
		MessagesTotal:   atomic.LoadUint64(&c.messagesTotal),
		MessagesPerSec:  c.messagesPerSec,
		ConnectionTime:  c.connectionTime,
		Reconnects:      c.reconnects,
		Host:            c.host,
		Port:            c.port,
		Format:          c.feedFormat,
	}
}

func (c *Client) connect(ctx context.Context, addr string) error {
	log.Printf("[FEED] Connecting to %s (format: %s)", addr, c.feedFormat)

	dialer := net.Dialer{Timeout: 10 * time.Second}
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return fmt.Errorf("dial failed: %w", err)
	}
	defer conn.Close()

	log.Printf("[FEED] Connected to %s", addr)
	c.setConnected(true)

	done := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			conn.Close()
		case <-done:
		}
	}()
	defer close(done)

	if c.feedFormat == "beast" {
		return c.readBeast(conn)
	}
	return c.readSBS(conn)
}

func (c *Client) readSBS(conn net.Conn) error {
	scanner := bufio.NewScanner(conn)
	for scanner.Scan() {
		line := scanner.Text()
		c.recordMessage()
		if ac := sbs.ParseMessage(line); ac != nil {
			c.tracker.Update(ac)
		}
	}

	if err := scanner.Err(); err != nil {
		c.setConnected(false)
		return fmt.Errorf("read error: %w", err)
	}

	log.Printf("[FEED] Connection closed")
	c.setConnected(false)
	return nil
}

func (c *Client) readBeast(conn net.Conn) error {
	buf := make([]byte, 4096)
	data := make([]byte, 0, 8192)
	parser := beast.NewParser()
	if c.rxLat != 0 || c.rxLon != 0 {
		parser.SetReceiverLocation(c.rxLat, c.rxLon)
	}

	for {
		n, err := conn.Read(buf)
		if err != nil {
			c.setConnected(false)
			if err == io.EOF {
				log.Printf("[FEED] Connection closed")
				return nil
			}
			return fmt.Errorf("read error: %w", err)
		}

		data = append(data, buf[:n]...)

		for {
			msg, consumed := beast.ParseFrame(data)
			if consumed == 0 {
				break
			}
			data = data[consumed:]

			if msg != nil {
				c.recordMessage()
				if ac := parser.Decode(msg); ac != nil {
					c.tracker.Update(ac)
				}
			}
		}

		if len(data) > 16384 {
			data = data[len(data)-8192:]
		}
	}
}
