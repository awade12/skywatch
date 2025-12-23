package webhook

import (
	"fmt"
	"time"
)

const (
	ColorEmergency = 0xFF0000
	ColorWatchlist = 0xFFAA00
	ColorNew       = 0x00D4FF
	ColorHealth    = 0xFF6B6B
)

type DiscordEmbed struct {
	Title       string         `json:"title"`
	Description string         `json:"description"`
	Color       int            `json:"color"`
	Fields      []DiscordField `json:"fields,omitempty"`
	Timestamp   string         `json:"timestamp,omitempty"`
	Footer      *DiscordFooter `json:"footer,omitempty"`
}

type DiscordField struct {
	Name   string `json:"name"`
	Value  string `json:"value"`
	Inline bool   `json:"inline"`
}

type DiscordFooter struct {
	Text string `json:"text"`
}

type DiscordMessage struct {
	Username  string         `json:"username,omitempty"`
	AvatarURL string         `json:"avatar_url,omitempty"`
	Content   string         `json:"content,omitempty"`
	Embeds    []DiscordEmbed `json:"embeds"`
}

func FormatDiscordMessage(event Event) DiscordMessage {
	var embed DiscordEmbed

	switch event.Type {
	case EventEmergencySquawk:
		embed = formatEmergencyEmbed(event)
	case EventWatchlistMatch:
		embed = formatWatchlistEmbed(event)
	case EventNewAircraft:
		embed = formatNewAircraftEmbed(event)
	case EventHealthAlert:
		embed = formatHealthEmbed(event)
	default:
		embed = DiscordEmbed{
			Title:       "Skywatch Event",
			Description: event.Message,
			Color:       ColorNew,
			Timestamp:   event.Timestamp.Format(time.RFC3339),
		}
	}

	return DiscordMessage{
		Username: "Skywatch",
		Embeds:   []DiscordEmbed{embed},
	}
}

func formatEmergencyEmbed(event Event) DiscordEmbed {
	ac := event.Aircraft
	fields := []DiscordField{}

	if ac.Callsign != "" {
		fields = append(fields, DiscordField{Name: "Callsign", Value: ac.Callsign, Inline: true})
	}
	fields = append(fields, DiscordField{Name: "ICAO", Value: ac.ICAO, Inline: true})
	fields = append(fields, DiscordField{Name: "Squawk", Value: ac.Squawk, Inline: true})

	if ac.Registration != "" {
		fields = append(fields, DiscordField{Name: "Registration", Value: ac.Registration, Inline: true})
	}
	if ac.AircraftType != "" {
		fields = append(fields, DiscordField{Name: "Type", Value: ac.AircraftType, Inline: true})
	}
	if ac.Operator != "" {
		fields = append(fields, DiscordField{Name: "Operator", Value: ac.Operator, Inline: true})
	}

	if ac.AltitudeFt != nil {
		fields = append(fields, DiscordField{Name: "Altitude", Value: fmt.Sprintf("%d ft", *ac.AltitudeFt), Inline: true})
	}
	if ac.SpeedKt != nil {
		fields = append(fields, DiscordField{Name: "Speed", Value: fmt.Sprintf("%.0f kt", *ac.SpeedKt), Inline: true})
	}
	if ac.Lat != nil && ac.Lon != nil {
		fields = append(fields, DiscordField{
			Name:   "Position",
			Value:  fmt.Sprintf("[%.4f, %.4f](https://www.google.com/maps?q=%.4f,%.4f)", *ac.Lat, *ac.Lon, *ac.Lat, *ac.Lon),
			Inline: true,
		})
	}

	title := "🚨 EMERGENCY SQUAWK"
	switch ac.Squawk {
	case "7500":
		title = "🚨 HIJACK SQUAWK 7500"
	case "7600":
		title = "📻 RADIO FAILURE SQUAWK 7600"
	case "7700":
		title = "⚠️ EMERGENCY SQUAWK 7700"
	}

	return DiscordEmbed{
		Title:       title,
		Description: event.Message,
		Color:       ColorEmergency,
		Fields:      fields,
		Timestamp:   event.Timestamp.Format(time.RFC3339),
		Footer:      &DiscordFooter{Text: "Skywatch ADS-B Tracker"},
	}
}

func formatWatchlistEmbed(event Event) DiscordEmbed {
	ac := event.Aircraft
	fields := []DiscordField{}

	if ac.Callsign != "" {
		fields = append(fields, DiscordField{Name: "Callsign", Value: ac.Callsign, Inline: true})
	}
	fields = append(fields, DiscordField{Name: "ICAO", Value: ac.ICAO, Inline: true})

	if ac.Registration != "" {
		fields = append(fields, DiscordField{Name: "Registration", Value: ac.Registration, Inline: true})
	}
	if ac.AircraftType != "" {
		fields = append(fields, DiscordField{Name: "Type", Value: ac.AircraftType, Inline: true})
	}
	if ac.Operator != "" {
		fields = append(fields, DiscordField{Name: "Operator", Value: ac.Operator, Inline: true})
	}

	if ac.AltitudeFt != nil {
		fields = append(fields, DiscordField{Name: "Altitude", Value: fmt.Sprintf("%d ft", *ac.AltitudeFt), Inline: true})
	}
	if ac.Lat != nil && ac.Lon != nil {
		fields = append(fields, DiscordField{
			Name:   "Position",
			Value:  fmt.Sprintf("[%.4f, %.4f](https://www.google.com/maps?q=%.4f,%.4f)", *ac.Lat, *ac.Lon, *ac.Lat, *ac.Lon),
			Inline: true,
		})
	}

	return DiscordEmbed{
		Title:       "✈️ Watchlist Aircraft Detected",
		Description: event.Message,
		Color:       ColorWatchlist,
		Fields:      fields,
		Timestamp:   event.Timestamp.Format(time.RFC3339),
		Footer:      &DiscordFooter{Text: "Skywatch ADS-B Tracker"},
	}
}

func formatNewAircraftEmbed(event Event) DiscordEmbed {
	ac := event.Aircraft
	fields := []DiscordField{}

	if ac.Callsign != "" {
		fields = append(fields, DiscordField{Name: "Callsign", Value: ac.Callsign, Inline: true})
	}
	fields = append(fields, DiscordField{Name: "ICAO", Value: ac.ICAO, Inline: true})

	if ac.Registration != "" {
		fields = append(fields, DiscordField{Name: "Registration", Value: ac.Registration, Inline: true})
	}
	if ac.AircraftType != "" {
		fields = append(fields, DiscordField{Name: "Type", Value: ac.AircraftType, Inline: true})
	}

	return DiscordEmbed{
		Title:       "✈️ New Aircraft",
		Description: event.Message,
		Color:       ColorNew,
		Fields:      fields,
		Timestamp:   event.Timestamp.Format(time.RFC3339),
		Footer:      &DiscordFooter{Text: "Skywatch ADS-B Tracker"},
	}
}

func formatHealthEmbed(event Event) DiscordEmbed {
	h := event.Health
	fields := []DiscordField{
		{Name: "CPU", Value: fmt.Sprintf("%.1f%%", h.CPUPercent), Inline: true},
		{Name: "Memory", Value: fmt.Sprintf("%.1f%%", h.MemoryPercent), Inline: true},
		{Name: "Temperature", Value: fmt.Sprintf("%.1f°C", h.TempCelsius), Inline: true},
		{Name: "Uptime", Value: h.Uptime.Round(time.Second).String(), Inline: true},
	}

	return DiscordEmbed{
		Title:       "⚠️ Health Alert",
		Description: event.Message,
		Color:       ColorHealth,
		Fields:      fields,
		Timestamp:   event.Timestamp.Format(time.RFC3339),
		Footer:      &DiscordFooter{Text: "Skywatch ADS-B Tracker"},
	}
}

