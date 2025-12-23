package webhook

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"adsb-tracker/internal/config"
	"adsb-tracker/pkg/models"
)

type Dispatcher struct {
	config     config.WebhookConfig
	events     chan Event
	client     *http.Client
	mu         sync.RWMutex
	recentSent map[string]time.Time
}

func NewDispatcher(cfg config.WebhookConfig) *Dispatcher {
	return &Dispatcher{
		config: cfg,
		events: make(chan Event, 100),
		client: &http.Client{
			Timeout: 10 * time.Second,
		},
		recentSent: make(map[string]time.Time),
	}
}

func (d *Dispatcher) Run(ctx context.Context) {
	ticker := time.NewTicker(time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case event := <-d.events:
			d.processEvent(event)
		case <-ticker.C:
			d.cleanupRecent()
		}
	}
}

func (d *Dispatcher) Send(event Event) {
	if d.config.DiscordURL == "" {
		return
	}

	select {
	case d.events <- event:
	default:
		log.Printf("[WEBHOOK] Event queue full, dropping event")
	}
}

func (d *Dispatcher) SendEmergency(ac *models.Aircraft) {
	if !d.config.Events.EmergencySquawk {
		return
	}
	if !d.shouldSend("emergency:" + ac.ICAO) {
		return
	}
	d.Send(NewEmergencyEvent(ac, ac.Squawk))
}

func (d *Dispatcher) SendWatchlistMatch(ac *models.Aircraft, pattern string) {
	if len(d.config.Events.AircraftWatchlist) == 0 {
		return
	}
	if !d.shouldSend("watchlist:" + ac.ICAO) {
		return
	}
	d.Send(NewWatchlistEvent(ac, pattern))
}

func (d *Dispatcher) SendNewAircraft(ac *models.Aircraft) {
	if !d.config.Events.NewAircraft {
		return
	}
	d.Send(NewAircraftEvent(ac))
}

func (d *Dispatcher) SendHealthAlert(health *HealthData, alertType string) {
	if !d.config.Events.HealthAlerts {
		return
	}
	if !d.shouldSend("health:" + alertType) {
		return
	}
	d.Send(NewHealthAlertEvent(health, alertType))
}

func (d *Dispatcher) CheckWatchlist(ac *models.Aircraft) (bool, string) {
	if len(d.config.Events.AircraftWatchlist) == 0 {
		return false, ""
	}

	for _, pattern := range d.config.Events.AircraftWatchlist {
		pattern = strings.ToUpper(pattern)

		if strings.HasSuffix(pattern, "*") {
			prefix := strings.TrimSuffix(pattern, "*")
			if strings.HasPrefix(strings.ToUpper(ac.ICAO), prefix) ||
				strings.HasPrefix(strings.ToUpper(ac.Registration), prefix) ||
				strings.HasPrefix(strings.ToUpper(ac.Callsign), prefix) {
				return true, pattern
			}
		} else {
			if strings.EqualFold(ac.ICAO, pattern) ||
				strings.EqualFold(ac.Registration, pattern) ||
				strings.EqualFold(ac.Callsign, pattern) {
				return true, pattern
			}
		}
	}

	return false, ""
}

func (d *Dispatcher) IsEmergencySquawk(squawk string) bool {
	return squawk == "7500" || squawk == "7600" || squawk == "7700"
}

func (d *Dispatcher) processEvent(event Event) {
	msg := FormatDiscordMessage(event)

	body, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[WEBHOOK] Failed to marshal message: %v", err)
		return
	}

	resp, err := d.client.Post(d.config.DiscordURL, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[WEBHOOK] Failed to send: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		log.Printf("[WEBHOOK] Discord returned status %d", resp.StatusCode)
		return
	}

	log.Printf("[WEBHOOK] Sent %s event", event.Type)
}

func (d *Dispatcher) shouldSend(key string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()

	if lastSent, ok := d.recentSent[key]; ok {
		if time.Since(lastSent) < 5*time.Minute {
			return false
		}
	}

	d.recentSent[key] = time.Now()
	return true
}

func (d *Dispatcher) cleanupRecent() {
	d.mu.Lock()
	defer d.mu.Unlock()

	now := time.Now()
	for key, t := range d.recentSent {
		if now.Sub(t) > 10*time.Minute {
			delete(d.recentSent, key)
		}
	}
}

func (d *Dispatcher) SendTestWebhook() error {
	if d.config.DiscordURL == "" {
		return nil
	}

	msg := DiscordMessage{
		Username: "Skywatch",
		Embeds: []DiscordEmbed{
			{
				Title:       "🧪 Test Webhook",
				Description: "Webhook is configured correctly!",
				Color:       ColorNew,
				Timestamp:   time.Now().Format(time.RFC3339),
				Footer:      &DiscordFooter{Text: "Skywatch ADS-B Tracker"},
			},
		},
	}

	body, err := json.Marshal(msg)
	if err != nil {
		return err
	}

	resp, err := d.client.Post(d.config.DiscordURL, "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	return nil
}

