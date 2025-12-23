package health

import (
	"bufio"
	"context"
	"log"
	"os"
	"runtime"
	"strconv"
	"strings"
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

	stats.CPUPercent = m.readCPU()
	stats.MemoryPercent, stats.MemoryUsedMB, stats.MemoryTotalMB = m.readMemory()
	stats.TempCelsius = m.readTemperature()

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

func (m *Monitor) readCPU() float64 {
	if runtime.GOOS != "linux" {
		return 0
	}

	file, err := os.Open("/proc/stat")
	if err != nil {
		return 0
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "cpu ") {
			fields := strings.Fields(line)
			if len(fields) < 5 {
				return 0
			}

			var total, idle uint64
			for i, v := range fields[1:] {
				val, _ := strconv.ParseUint(v, 10, 64)
				total += val
				if i == 3 {
					idle = val
				}
			}

			if m.prevTotalTime == 0 {
				m.prevTotalTime = total
				m.prevIdleTime = idle
				return 0
			}

			totalDelta := total - m.prevTotalTime
			idleDelta := idle - m.prevIdleTime

			m.prevTotalTime = total
			m.prevIdleTime = idle

			if totalDelta == 0 {
				return 0
			}

			return (1 - float64(idleDelta)/float64(totalDelta)) * 100
		}
	}

	return 0
}

func (m *Monitor) readMemory() (percent float64, usedMB, totalMB uint64) {
	if runtime.GOOS != "linux" {
		var mem runtime.MemStats
		runtime.ReadMemStats(&mem)
		return 0, mem.Alloc / 1024 / 1024, 0
	}

	file, err := os.Open("/proc/meminfo")
	if err != nil {
		return 0, 0, 0
	}
	defer file.Close()

	var memTotal, memAvailable uint64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 2 {
			continue
		}

		val, _ := strconv.ParseUint(fields[1], 10, 64)

		switch fields[0] {
		case "MemTotal:":
			memTotal = val
		case "MemAvailable:":
			memAvailable = val
		}
	}

	if memTotal == 0 {
		return 0, 0, 0
	}

	memUsed := memTotal - memAvailable
	percent = float64(memUsed) / float64(memTotal) * 100
	usedMB = memUsed / 1024
	totalMB = memTotal / 1024

	return percent, usedMB, totalMB
}

func (m *Monitor) readTemperature() float64 {
	if runtime.GOOS != "linux" {
		return 0
	}

	paths := []string{
		"/sys/class/thermal/thermal_zone0/temp",
		"/sys/class/hwmon/hwmon0/temp1_input",
	}

	for _, path := range paths {
		data, err := os.ReadFile(path)
		if err != nil {
			continue
		}

		temp, err := strconv.ParseFloat(strings.TrimSpace(string(data)), 64)
		if err != nil {
			continue
		}

		if temp > 1000 {
			temp = temp / 1000
		}

		return temp
	}

	return 0
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

