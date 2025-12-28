package health

import (
	"context"
	"log"
	"runtime"
	"strconv"
	"sync"
	"time"

	"adsb-tracker/internal/config"
	"adsb-tracker/internal/webhook"
)

type Stats struct {
	CPUPercent    float64       `json:"cpu_percent"`
	MemoryPercent float64       `json:"memory_percent"`
	MemoryUsedMB  uint64        `json:"memory_used_mb"`
	MemoryTotalMB uint64        `json:"memory_total_mb"`
	TempCelsius   float64       `json:"temp_celsius"`
	Uptime        time.Duration `json:"uptime"`
	UptimeString  string        `json:"uptime_string"`
	GoRoutines    int           `json:"goroutines"`
	Platform      string        `json:"platform"`
}

type Monitor struct {
	startTime  time.Time
	mu         sync.RWMutex
	lastStats  Stats
	thresholds config.HealthThresholdsConfig
	dispatcher *webhook.Dispatcher

	prevIdleTime  uint64
	prevTotalTime uint64
}

type metricsProvider interface {
	CPUPercent(*Monitor) float64
	MemoryUsage() (float64, uint64, uint64)
	Temperature() float64
}

var provider metricsProvider = newPlatformMetrics()

func setMetricsProvider(p metricsProvider) {
	provider = p
}

func NewMonitor(thresholds config.HealthThresholdsConfig, dispatcher *webhook.Dispatcher) *Monitor {
	return &Monitor{
		startTime:  time.Now(),
		thresholds: thresholds,
		dispatcher: dispatcher,
	}
}

func (m *Monitor) Run(ctx context.Context) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			m.collect()
		}
	}
}

func (m *Monitor) GetStats() Stats {
	m.mu.RLock()
	defer m.mu.RUnlock()

	stats := m.lastStats
	stats.Uptime = time.Since(m.startTime)
	stats.UptimeString = stats.Uptime.Round(time.Second).String()
	stats.GoRoutines = runtime.NumGoroutine()

	return stats
}

func (m *Monitor) collect() {
	stats := Stats{
		Uptime:       time.Since(m.startTime),
		UptimeString: time.Since(m.startTime).Round(time.Second).String(),
		GoRoutines:   runtime.NumGoroutine(),
		Platform:     runtime.GOOS + "/" + runtime.GOARCH,
	}

	stats.CPUPercent = provider.CPUPercent(m)
	stats.MemoryPercent, stats.MemoryUsedMB, stats.MemoryTotalMB = provider.MemoryUsage()
	stats.TempCelsius = provider.Temperature()

	m.mu.Lock()
	m.lastStats = stats
	m.mu.Unlock()

	m.checkThresholds(stats)
}

func (m *Monitor) checkThresholds(stats Stats) {
	if m.dispatcher == nil {
		return
	}

	healthData := &webhook.HealthData{
		CPUPercent:    stats.CPUPercent,
		MemoryPercent: stats.MemoryPercent,
		TempCelsius:   stats.TempCelsius,
		Uptime:        stats.Uptime,
	}

	if m.thresholds.CPUPercent > 0 && stats.CPUPercent > float64(m.thresholds.CPUPercent) {
		m.dispatcher.SendHealthAlert(healthData, "High CPU usage: "+strconv.FormatFloat(stats.CPUPercent, 'f', 1, 64)+"%")
	}

	if m.thresholds.MemoryPercent > 0 && stats.MemoryPercent > float64(m.thresholds.MemoryPercent) {
		m.dispatcher.SendHealthAlert(healthData, "High memory usage: "+strconv.FormatFloat(stats.MemoryPercent, 'f', 1, 64)+"%")
	}

	if m.thresholds.TempCelsius > 0 && stats.TempCelsius > float64(m.thresholds.TempCelsius) {
		m.dispatcher.SendHealthAlert(healthData, "High temperature: "+strconv.FormatFloat(stats.TempCelsius, 'f', 1, 64)+"°C")
	}
}

func (m *Monitor) GetUptime() time.Duration {
	return time.Since(m.startTime)
}

func (m *Monitor) LogStats() {
	stats := m.GetStats()
	log.Printf("[HEALTH] CPU: %.1f%%, Memory: %.1f%% (%dMB/%dMB), Temp: %.1f°C, Uptime: %s, Goroutines: %d",
		stats.CPUPercent, stats.MemoryPercent, stats.MemoryUsedMB, stats.MemoryTotalMB,
		stats.TempCelsius, stats.UptimeString, stats.GoRoutines)
}
