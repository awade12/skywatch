package feed

import (
	"bufio"
	"context"
	"fmt"
	"io"
	"log"
	"net"
	"time"

	"adsb-tracker/internal/beast"
	"adsb-tracker/internal/sbs"
	"adsb-tracker/internal/tracker"
)

type Client struct {
	host       string
	port       int
	feedFormat string
	tracker    *tracker.Tracker
	rxLat      float64
	rxLon      float64
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

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}

		if err := c.connect(ctx, addr); err != nil {
			log.Printf("[FEED] Connection error: %v, reconnecting in %v", err, backoff)
			select {
			case <-ctx.Done():
				return
			case <-time.After(backoff):
			}
			backoff = min(backoff*2, 30*time.Second)
		} else {
			backoff = time.Second
		}
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
		if ac := sbs.ParseMessage(line); ac != nil {
			c.tracker.Update(ac)
		}
	}

	if err := scanner.Err(); err != nil {
		return fmt.Errorf("read error: %w", err)
	}

	log.Printf("[FEED] Connection closed")
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
