//go:build darwin

package health

import (
	"os"
	"os/exec"
	"strconv"
	"strings"
)

type darwinMetrics struct {
	pageSize uint64
}

func newPlatformMetrics() metricsProvider {
	pageSize := uint64(4096)
	if size, err := runSysctlUint64("hw.pagesize"); err == nil && size > 0 {
		pageSize = size
	}
	return &darwinMetrics{pageSize: pageSize}
}

func (m *darwinMetrics) CPUPercent(*Monitor) float64 {
	pid := os.Getpid()
	out, err := exec.Command("ps", "-p", strconv.Itoa(pid), "-o", "%cpu=").Output()
	if err != nil {
		return 0
	}
	val, err := strconv.ParseFloat(strings.TrimSpace(string(out)), 64)
	if err != nil {
		return 0
	}
	return val
}

func (m *darwinMetrics) MemoryUsage() (float64, uint64, uint64) {
	totalBytes, err := runSysctlUint64("hw.memsize")
	if err != nil || totalBytes == 0 {
		return 0, 0, 0
	}

	vmOut, err := exec.Command("vm_stat").Output()
	if err != nil {
		return 0, 0, 0
	}

	freePages := parseVMStatValue(string(vmOut), "Pages free")
	speculative := parseVMStatValue(string(vmOut), "Pages speculative")
	freeBytes := (freePages + speculative) * m.pageSize
	if freeBytes > totalBytes {
		freeBytes = totalBytes
	}
	usedBytes := totalBytes - freeBytes
	percent := float64(usedBytes) / float64(totalBytes) * 100
	return percent, usedBytes / 1024 / 1024, totalBytes / 1024 / 1024
}

func (m *darwinMetrics) Temperature() float64 {
	return 0
}

func runSysctlUint64(name string) (uint64, error) {
	out, err := exec.Command("sysctl", "-n", name).Output()
	if err != nil {
		return 0, err
	}
	return strconv.ParseUint(strings.TrimSpace(string(out)), 10, 64)
}

func parseVMStatValue(out, key string) uint64 {
	lines := strings.Split(out, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, key) {
			fields := strings.Fields(line)
			if len(fields) == 0 {
				continue
			}
			valStr := fields[len(fields)-1]
			valStr = strings.TrimSuffix(valStr, ".")
			if v, err := strconv.ParseUint(valStr, 10, 64); err == nil {
				return v
			}
		}
	}
	return 0
}
