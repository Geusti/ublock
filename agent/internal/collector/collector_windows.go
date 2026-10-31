//go:build windows
// +build windows

package collector

import (
	"fmt"
	"runtime"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
	"golang.org/x/sys/windows/registry"
)

var (
	kernel32              = windows.NewLazySystemDLL("kernel32.dll")
	procGlobalMemoryStatus = kernel32.NewProc("GlobalMemoryStatusEx")
	procGetDiskFreeSpaceEx = kernel32.NewProc("GetDiskFreeSpaceExW")
	procGetTickCount64     = kernel32.NewProc("GetTickCount64")
	procGetLogicalDrives   = kernel32.NewProc("GetLogicalDrives")
)

type memoryStatusEx struct {
	cbSize                  uint32
	dwMemoryLoad            uint32
	ullTotalPhys            uint64
	ullAvailPhys            uint64
	ullTotalPageFile        uint64
	ullAvailPageFile        uint64
	ullTotalVirtual         uint64
	ullAvailVirtual         uint64
	ullAvailExtendedVirtual uint64
}

// CollectFullInventory gathers real technical specs from the Windows OS.
func CollectFullInventory() (*SystemInfo, error) {
	hostname := GetHostname()
	osDetails := collectWindowsOSDetails()
	cpuInfo := collectWindowsCPUInfo()
	memInfo := collectWindowsMemory()
	storage := collectWindowsDrives()
	network := CollectNetworkInterfaces()
	uptime := GetUptimeSeconds()

	mfg, model, sn := collectWindowsHardwareIdentity()

	return &SystemInfo{
		Hostname:     hostname,
		Manufacturer: mfg,
		Model:        model,
		SerialNumber: sn,
		OS:           osDetails,
		CPU:          cpuInfo,
		Memory:       memInfo,
		Storage:      storage,
		Network:      network,
		UptimeSec:    uptime,
	}, nil
}

// GetUptimeSeconds returns system uptime in seconds using GetTickCount64.
func GetUptimeSeconds() uint64 {
	r, _, _ := procGetTickCount64.Call()
	return uint64(r / 1000)
}

func collectWindowsMemory() MemoryInfo {
	var ms memoryStatusEx
	ms.cbSize = uint32(unsafe.Sizeof(ms))

	r, _, _ := procGlobalMemoryStatus.Call(uintptr(unsafe.Pointer(&ms)))
	if r == 0 {
		return MemoryInfo{
			TotalBytes:     0,
			AvailableBytes: 0,
		}
	}

	used := ms.ullTotalPhys - ms.ullAvailPhys
	usagePct := 0.0
	if ms.ullTotalPhys > 0 {
		usagePct = (float64(used) / float64(ms.ullTotalPhys)) * 100.0
	}

	return MemoryInfo{
		TotalBytes:     ms.ullTotalPhys,
		AvailableBytes: ms.ullAvailPhys,
		UsagePercent:   &usagePct,
	}
}

func collectWindowsDrives() []StorageDrive {
	var drives []StorageDrive

	r, _, _ := procGetLogicalDrives.Call()
	mask := uint32(r)

	for i := 0; i < 26; i++ {
		if (mask & (1 << i)) != 0 {
			letter := string(rune('A' + i))
			rootPath := letter + ":\\"

			var freeBytes, totalBytes, totalFreeBytes uint64
			pRoot, _ := syscall.UTF16PtrFromString(rootPath)

			res, _, _ := procGetDiskFreeSpaceEx.Call(
				uintptr(unsafe.Pointer(pRoot)),
				uintptr(unsafe.Pointer(&freeBytes)),
				uintptr(unsafe.Pointer(&totalBytes)),
				uintptr(unsafe.Pointer(&totalFreeBytes)),
			)

			if res != 0 && totalBytes > 0 {
				drives = append(drives, StorageDrive{
					Drive:      letter + ":",
					TotalBytes: totalBytes,
					FreeBytes:  freeBytes,
					FsType:     "NTFS",
				})
			}
		}
	}

	return drives
}

func collectWindowsCPUInfo() CPUInfo {
	model := "Unknown Processor"
	cores := runtime.NumCPU()

	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `HARDWARE\DESCRIPTION\System\CentralProcessor\0`, registry.QUERY_VALUE)
	if err == nil {
		defer k.Close()
		name, _, err := k.GetStringValue("ProcessorNameString")
		if err == nil && name != "" {
			model = name
		}
	}

	return CPUInfo{
		Model: model,
		Cores: cores,
	}
}

func collectWindowsOSDetails() OSDetails {
	details := OSDetails{
		Name: "Windows",
		Arch: runtime.GOARCH,
	}

	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows NT\CurrentVersion`, registry.QUERY_VALUE)
	if err == nil {
		defer k.Close()
		productName, _, err1 := k.GetStringValue("ProductName")
		displayVer, _, err2 := k.GetStringValue("DisplayVersion")
		build, _, err3 := k.GetStringValue("CurrentBuild")

		if err1 == nil && productName != "" {
			details.Name = productName
		}
		if err2 == nil && displayVer != "" {
			details.Version = displayVer
		}
		if err3 == nil && build != "" {
			details.Build = build
		}
	}

	return details
}

func collectWindowsHardwareIdentity() (manufacturer, model, serial string) {
	// Attempt reading BIOS info from registry
	k, err := registry.OpenKey(registry.LOCAL_MACHINE, `HARDWARE\DESCRIPTION\System\BIOS`, registry.QUERY_VALUE)
	if err == nil {
		defer k.Close()
		mfg, _, _ := k.GetStringValue("SystemManufacturer")
		mdl, _, _ := k.GetStringValue("SystemProductName")
		sn, _, _ := k.GetStringValue("SystemSerialNumber")

		return mfg, mdl, sn
	}
	return "Generic Manufacturer", "PC Model", ""
}
