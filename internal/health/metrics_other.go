//go:build !linux && !darwin

package health

import "runtime"

type fallbackMetrics struct{}

func newPlatformMetrics() metricsProvider {
	return &fallbackMetrics{}
}

func (m *fallbackMetrics) CPUPercent(*Monitor) float64 {
	return 0
}

func (m *fallbackMetrics) MemoryUsage() (float64, uint64, uint64) {
	var mem runtime.MemStats
	runtime.ReadMemStats(&mem)
	usedMB := mem.Alloc / 1024 / 1024
	return 0, usedMB, 0
}

func (m *fallbackMetrics) Temperature() float64 {
	return 0
}
