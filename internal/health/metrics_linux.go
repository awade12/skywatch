//go:build linux

package health

import (
	"bufio"
	"os"
	"strconv"
	"strings"
)

type linuxMetrics struct{}

func newPlatformMetrics() metricsProvider {
	return &linuxMetrics{}
}

func (m *linuxMetrics) CPUPercent(mon *Monitor) float64 {
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

			if mon.prevTotalTime == 0 {
				mon.prevTotalTime = total
				mon.prevIdleTime = idle
				return 0
			}

			totalDelta := total - mon.prevTotalTime
			idleDelta := idle - mon.prevIdleTime

			mon.prevTotalTime = total
			mon.prevIdleTime = idle

			if totalDelta == 0 {
				return 0
			}

			return (1 - float64(idleDelta)/float64(totalDelta)) * 100
		}
	}

	return 0
}

func (m *linuxMetrics) MemoryUsage() (percent float64, usedMB, totalMB uint64) {
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

func (m *linuxMetrics) Temperature() float64 {
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
