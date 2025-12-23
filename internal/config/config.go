package config

import (
	"encoding/json"
	"os"
	"time"
)

type DatabaseConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	User     string `json:"user"`
	Password string `json:"password"`
	DBName   string `json:"dbname"`
	SSLMode  string `json:"sslmode"`
}

type WebhookEventsConfig struct {
	EmergencySquawk   bool     `json:"emergency_squawk"`
	AircraftWatchlist []string `json:"aircraft_watchlist"`
	NewAircraft       bool     `json:"new_aircraft"`
	HealthAlerts      bool     `json:"health_alerts"`
}

type HealthThresholdsConfig struct {
	CPUPercent    int `json:"cpu_percent"`
	MemoryPercent int `json:"memory_percent"`
	TempCelsius   int `json:"temp_celsius"`
}

type WebhookConfig struct {
	DiscordURL       string                 `json:"discord_url"`
	Events           WebhookEventsConfig    `json:"events"`
	HealthThresholds HealthThresholdsConfig `json:"health_thresholds"`
}

type AutoGainConfig struct {
	Enabled              bool          `json:"enabled"`
	TargetMessagesPerSec int           `json:"target_messages_per_sec"`
	AdjustmentInterval   time.Duration `json:"adjustment_interval"`
}

type Config struct {
	SBSHost      string         `json:"sbs_host"`
	SBSPort      int            `json:"sbs_port"`
	FeedFormat   string         `json:"feed_format"`
	HTTPAddr     string         `json:"http_addr"`
	RxLat        float64        `json:"rx_lat"`
	RxLon        float64        `json:"rx_lon"`
	StaleTimeout time.Duration  `json:"stale_timeout"`
	DeviceIndex  int            `json:"device_index"`
	Database     DatabaseConfig `json:"database"`
	TrailLength  int            `json:"trail_length"`
	Webhooks     WebhookConfig  `json:"webhooks"`
	AutoGain     AutoGainConfig `json:"auto_gain"`
}

func Default() *Config {
	return &Config{
		SBSHost:      "127.0.0.1",
		SBSPort:      30003,
		FeedFormat:   "sbs",
		HTTPAddr:     ":8080",
		StaleTimeout: 60 * time.Second,
		DeviceIndex:  0,
		TrailLength:  50,
		Database: DatabaseConfig{
			Host:    "localhost",
			Port:    5432,
			User:    "postgres",
			DBName:  "adsb",
			SSLMode: "disable",
		},
		Webhooks: WebhookConfig{
			Events: WebhookEventsConfig{
				EmergencySquawk: true,
				HealthAlerts:    true,
			},
			HealthThresholds: HealthThresholdsConfig{
				CPUPercent:    90,
				MemoryPercent: 90,
				TempCelsius:   80,
			},
		},
		AutoGain: AutoGainConfig{
			Enabled:              false,
			TargetMessagesPerSec: 100,
			AdjustmentInterval:   5 * time.Minute,
		},
	}
}

func Load(path string) (*Config, error) {
	cfg := Default()

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return cfg, nil
		}
		return nil, err
	}

	var fileCfg struct {
		SBSHost      string  `json:"sbs_host"`
		SBSPort      int     `json:"sbs_port"`
		FeedFormat   string  `json:"feed_format"`
		HTTPAddr     string  `json:"http_addr"`
		RxLat        float64 `json:"rx_lat"`
		RxLon        float64 `json:"rx_lon"`
		StaleTimeout string  `json:"stale_timeout"`
		DeviceIndex  int     `json:"device_index"`
		TrailLength  int     `json:"trail_length"`
		Database     struct {
			Host     string `json:"host"`
			Port     int    `json:"port"`
			User     string `json:"user"`
			Password string `json:"password"`
			DBName   string `json:"dbname"`
			SSLMode  string `json:"sslmode"`
		} `json:"database"`
		Webhooks struct {
			DiscordURL string `json:"discord_url"`
			Events     struct {
				EmergencySquawk   bool     `json:"emergency_squawk"`
				AircraftWatchlist []string `json:"aircraft_watchlist"`
				NewAircraft       bool     `json:"new_aircraft"`
				HealthAlerts      bool     `json:"health_alerts"`
			} `json:"events"`
			HealthThresholds struct {
				CPUPercent    int `json:"cpu_percent"`
				MemoryPercent int `json:"memory_percent"`
				TempCelsius   int `json:"temp_celsius"`
			} `json:"health_thresholds"`
		} `json:"webhooks"`
		AutoGain struct {
			Enabled              bool   `json:"enabled"`
			TargetMessagesPerSec int    `json:"target_messages_per_sec"`
			AdjustmentInterval   string `json:"adjustment_interval"`
		} `json:"auto_gain"`
	}

	if err := json.Unmarshal(data, &fileCfg); err != nil {
		return nil, err
	}

	if fileCfg.SBSHost != "" {
		cfg.SBSHost = fileCfg.SBSHost
	}
	if fileCfg.SBSPort != 0 {
		cfg.SBSPort = fileCfg.SBSPort
	}
	if fileCfg.FeedFormat != "" {
		cfg.FeedFormat = fileCfg.FeedFormat
	}
	if fileCfg.HTTPAddr != "" {
		cfg.HTTPAddr = fileCfg.HTTPAddr
	}
	if fileCfg.RxLat != 0 {
		cfg.RxLat = fileCfg.RxLat
	}
	if fileCfg.RxLon != 0 {
		cfg.RxLon = fileCfg.RxLon
	}
	if fileCfg.StaleTimeout != "" {
		if d, err := time.ParseDuration(fileCfg.StaleTimeout); err == nil {
			cfg.StaleTimeout = d
		}
	}
	if fileCfg.DeviceIndex != 0 {
		cfg.DeviceIndex = fileCfg.DeviceIndex
	}
	if fileCfg.TrailLength != 0 {
		cfg.TrailLength = fileCfg.TrailLength
	}

	if fileCfg.Database.Host != "" {
		cfg.Database.Host = fileCfg.Database.Host
	}
	if fileCfg.Database.Port != 0 {
		cfg.Database.Port = fileCfg.Database.Port
	}
	if fileCfg.Database.User != "" {
		cfg.Database.User = fileCfg.Database.User
	}
	if fileCfg.Database.Password != "" {
		cfg.Database.Password = fileCfg.Database.Password
	}
	if fileCfg.Database.DBName != "" {
		cfg.Database.DBName = fileCfg.Database.DBName
	}
	if fileCfg.Database.SSLMode != "" {
		cfg.Database.SSLMode = fileCfg.Database.SSLMode
	}

	if fileCfg.Webhooks.DiscordURL != "" {
		cfg.Webhooks.DiscordURL = fileCfg.Webhooks.DiscordURL
	}
	cfg.Webhooks.Events.EmergencySquawk = fileCfg.Webhooks.Events.EmergencySquawk
	cfg.Webhooks.Events.AircraftWatchlist = fileCfg.Webhooks.Events.AircraftWatchlist
	cfg.Webhooks.Events.NewAircraft = fileCfg.Webhooks.Events.NewAircraft
	cfg.Webhooks.Events.HealthAlerts = fileCfg.Webhooks.Events.HealthAlerts
	if fileCfg.Webhooks.HealthThresholds.CPUPercent != 0 {
		cfg.Webhooks.HealthThresholds.CPUPercent = fileCfg.Webhooks.HealthThresholds.CPUPercent
	}
	if fileCfg.Webhooks.HealthThresholds.MemoryPercent != 0 {
		cfg.Webhooks.HealthThresholds.MemoryPercent = fileCfg.Webhooks.HealthThresholds.MemoryPercent
	}
	if fileCfg.Webhooks.HealthThresholds.TempCelsius != 0 {
		cfg.Webhooks.HealthThresholds.TempCelsius = fileCfg.Webhooks.HealthThresholds.TempCelsius
	}

	cfg.AutoGain.Enabled = fileCfg.AutoGain.Enabled
	if fileCfg.AutoGain.TargetMessagesPerSec != 0 {
		cfg.AutoGain.TargetMessagesPerSec = fileCfg.AutoGain.TargetMessagesPerSec
	}
	if fileCfg.AutoGain.AdjustmentInterval != "" {
		if d, err := time.ParseDuration(fileCfg.AutoGain.AdjustmentInterval); err == nil {
			cfg.AutoGain.AdjustmentInterval = d
		}
	}

	return cfg, nil
}
