package collector

import (
	"testing"
)

func TestCollectNetworkInterfaces(t *testing.T) {
	ifaces := CollectNetworkInterfaces()
	// Should not panic, returns slice
	if ifaces == nil {
		t.Log("No network interfaces found or loopback only")
	}
}

func TestGetHostname(t *testing.T) {
	h := GetHostname()
	if h == "" {
		t.Error("Hostname should not be empty")
	}
}

func TestGetDefaultOSDetails(t *testing.T) {
	d := GetDefaultOSDetails()
	if d.Name == "" || d.Arch == "" {
		t.Errorf("Expected OS details to have Name and Arch, got %+v", d)
	}
}

func TestCollectFullInventory(t *testing.T) {
	info, err := CollectFullInventory()
	if err != nil {
		t.Fatalf("CollectFullInventory returned error: %v", err)
	}
	if info.Hostname == "" {
		t.Error("Expected non-empty hostname")
	}
	if info.CPU.Cores <= 0 {
		t.Errorf("Expected positive core count, got %d", info.CPU.Cores)
	}
}
