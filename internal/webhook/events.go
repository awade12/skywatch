package webhook

import (
	"time"

	"adsb-tracker/pkg/models"
)

type EventType string

const (
	EventEmergencySquawk EventType = "emergency_squawk"
	EventWatchlistMatch  EventType = "watchlist_match"
	EventNewAircraft     EventType = "new_aircraft"
	EventHealthAlert     EventType = "health_alert"
)

type Event struct {
	Type      EventType
	Timestamp time.Time
	Aircraft  *models.Aircraft
	Health    *HealthData
	Message   string
}

type HealthData struct {
	CPUPercent    float64
	MemoryPercent float64
	TempCelsius   float64
	Uptime        time.Duration
	AlertType     string
}

func NewEmergencyEvent(ac *models.Aircraft, squawk string) Event {
	msg := "Unknown emergency"
	switch squawk {
	case "7500":
		msg = "HIJACK - Aircraft is being hijacked"
	case "7600":
		msg = "RADIO FAILURE - Lost communications"
	case "7700":
		msg = "EMERGENCY - General emergency declared"
	}

	return Event{
		Type:      EventEmergencySquawk,
		Timestamp: time.Now(),
		Aircraft:  ac,
		Message:   msg,
	}
}

func NewWatchlistEvent(ac *models.Aircraft, matchedPattern string) Event {
	return Event{
		Type:      EventWatchlistMatch,
		Timestamp: time.Now(),
		Aircraft:  ac,
		Message:   "Matched watchlist pattern: " + matchedPattern,
	}
}

func NewAircraftEvent(ac *models.Aircraft) Event {
	return Event{
		Type:      EventNewAircraft,
		Timestamp: time.Now(),
		Aircraft:  ac,
		Message:   "New aircraft detected",
	}
}

func NewHealthAlertEvent(health *HealthData, alertType string) Event {
	return Event{
		Type:      EventHealthAlert,
		Timestamp: time.Now(),
		Health:    health,
		Message:   alertType,
	}
}

