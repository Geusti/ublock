package collector

import (
	"net"
	"os"
	"runtime"
)

// CPUInfo represents processor hardware details.
type CPUInfo struct {
	Model        string   `json:"model"`
	Cores        int      `json:"cores"`
	UsagePercent *float64 `json:"usage_percent,omitempty"`
}

// MemoryInfo represents physical RAM metrics.
type MemoryInfo struct {
	TotalBytes     uint64   `json:"total_bytes"`
	AvailableBytes uint64   `json:"available_bytes"`
	UsagePercent   *float64 `json:"usage_percent,omitempty"`
}

// StorageDrive represents a mounted logical drive or volume.
type StorageDrive struct {
	Drive      string `json:"drive"`
	TotalBytes uint64 `json:"total_bytes"`
	FreeBytes  uint64 `json:"free_bytes"`
	FsType     string `json:"fs_type,omitempty"`
}

// NetworkInterface represents a local active network adapter.
type NetworkInterface struct {
	InterfaceName string `json:"interface_name"`
	IpAddress     string `json:"ip_address,omitempty"`
	MacAddress    string `json:"mac_address,omitempty"`
}

// OSDetails represents operating system identification.
type OSDetails struct {
	Name    string `json:"name"`
	Version string `json:"version,omitempty"`
	Build   string `json:"build,omitempty"`
	Arch    string `json:"arch"`
}

// SystemInfo is the full payload sent during periodic inventory collections.
type SystemInfo struct {
	Hostname     string             `json:"hostname"`
	Manufacturer string             `json:"manufacturer,omitempty"`
	Model        string             `json:"model,omitempty"`
	SerialNumber string             `json:"serial_number,omitempty"`
	OS           OSDetails          `json:"os_details"`
	CPU          CPUInfo            `json:"cpu"`
	Memory       MemoryInfo         `json:"memory"`
	Storage      []StorageDrive     `json:"storage"`
	Network      []NetworkInterface `json:"network"`
	UptimeSec    uint64             `json:"uptime_seconds"`
}

// GetHostname returns local machine hostname.
func GetHostname() string {
	h, err := os.Hostname()
	if err != nil {
		return "unknown-host"
	}
	return h
}

// CollectNetworkInterfaces gathers active IP and MAC addresses.
func CollectNetworkInterfaces() []NetworkInterface {
	var results []NetworkInterface

	ifaces, err := net.Interfaces()
	if err != nil {
		return results
	}

	for _, iface := range ifaces {
		// Skip loopback and down interfaces
		if iface.Flags&net.FlagLoopback != 0 || iface.Flags&net.FlagUp == 0 {
			continue
		}

		addrs, err := iface.Addrs()
		if err != nil {
			continue
		}

		mac := iface.HardwareAddr.String()
		for _, addr := range addrs {
			var ip net.IP
			switch v := addr.(type) {
			case *net.IPNet:
				ip = v.IP
			case *net.IPAddr:
				ip = v.IP
			}

			// Focus on IPv4 non-loopback
			if ip != nil && ip.To4() != nil && !ip.IsLoopback() {
				results = append(results, NetworkInterface{
					InterfaceName: iface.Name,
					IpAddress:     ip.String(),
					MacAddress:    mac,
				})
			}
		}
	}

	return results
}

// GetDefaultOSDetails returns baseline architecture details.
func GetDefaultOSDetails() OSDetails {
	return OSDetails{
		Name: runtime.GOOS,
		Arch: runtime.GOARCH,
	}
}
