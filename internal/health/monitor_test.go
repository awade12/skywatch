package health

import (
	"testing"
	"time"

	"adsb-tracker/internal/config"
)

type mockMetrics struct {
	cpu       float64
	memPct    float64
	usedMB    uint64
	totalMB   uint64
	tempC     float64
	cpuCalls  int
	memCalls  int
	tempCalls int
}

func (m *mockMetrics) CPUPercent(*Monitor) float64 {
	m.cpuCalls++
	return m.cpu
}

func (m *mockMetrics) MemoryUsage() (float64, uint64, uint64) {
	m.memCalls++
	return m.memPct, m.usedMB, m.totalMB
}

func (m *mockMetrics) Temperature() float64 {
	m.tempCalls++
	return m.tempC
}

func TestMonitorCollectUsesMetricsProvider(t *testing.T) {
	mock := &mockMetrics{
		cpu:     42.5,
		memPct:  73.2,
		usedMB:  512,
		totalMB: 1024,
		tempC:   55.1,
	}
	prevProvider := provider
	setMetricsProvider(mock)
	t.Cleanup(func() {
		setMetricsProvider(prevProvider)
	})

	m := NewMonitor(config.HealthThresholdsConfig{}, nil)
	m.collect()

	stats := m.GetStats()
	if stats.CPUPercent != mock.cpu {
		t.Fatalf("expected cpu %v got %v", mock.cpu, stats.CPUPercent)
	}
	if stats.MemoryPercent != mock.memPct || stats.MemoryUsedMB != mock.usedMB || stats.MemoryTotalMB != mock.totalMB {
		t.Fatalf("unexpected memory stats %+v", stats)
	}
	if stats.TempCelsius != mock.tempC {
		t.Fatalf("expected temp %v got %v", mock.tempC, stats.TempCelsius)
	}
	if mock.cpuCalls == 0 || mock.memCalls == 0 || mock.tempCalls == 0 {
		t.Fatal("metrics provider not invoked")
	}
}

func TestMonitorGetStatsUpdatesUptime(t *testing.T) {
	mock := &mockMetrics{}
	prevProvider := provider
	setMetricsProvider(mock)
	t.Cleanup(func() {
		setMetricsProvider(prevProvider)
	})

	m := NewMonitor(config.HealthThresholdsConfig{}, nil)
	time.Sleep(10 * time.Millisecond)
	stats := m.GetStats()
	if stats.Uptime <= 0 {
		t.Fatal("expected uptime to increase")
	}
}
