//go:build !windows
// +build !windows

package collector

import (
	"runtime"
	"time"
)

var startTime = time.Now()

// CollectFullInventory provides a fallback baseline implementation for non-windows builds.
func CollectFullInventory() (*SystemInfo, error) {
	return &SystemInfo{
		Hostname:     GetHostname(),
		Manufacturer: "Cross-Platform Workstation",
		Model:        "Standard Hardware",
		SerialNumber: "SIM-DEV-001",
		OS: OSDetails{
			Name:    runtime.GOOS,
			Version: "1.0",
			Arch:    runtime.GOARCH,
		},
		CPU: CPUInfo{
			Model: "Generic Multi-Core CPU",
			Cores: runtime.NumCPU(),
		},
		Memory: MemoryInfo{
			TotalBytes:     17179869184, // 16GB
			AvailableBytes: 8589934592,  // 8GB
		},
		Storage: []StorageDrive{
			{
				Drive:      "/",
				TotalBytes: 512000000000,
				FreeBytes:  256000000000,
				FsType:     "ext4",
			},
		},
		Network:   CollectNetworkInterfaces(),
		UptimeSec: GetUptimeSeconds(),
	}, nil
}

// GetUptimeSeconds returns uptime since process start on non-windows systems.
func GetUptimeSeconds() uint64 {
	return uint64(time.Since(startTime).Seconds())
}
