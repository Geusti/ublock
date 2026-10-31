//go:build windows
// +build windows

package service

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/mgr"

	"ublock/agent/internal/config"
	"ublock/agent/internal/logger"
)

type windowsService struct {
	cfg *config.Config
}

// Execute is called by Windows Service Control Manager.
func (ws *windowsService) Execute(args []string, r <-chan svc.ChangeRequest, changes chan<- svc.Status) (bool, uint32) {
	const cmdsAccepted = svc.AcceptStop | svc.AcceptShutdown
	changes <- svc.Status{State: svc.StartPending}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	changes <- svc.Status{State: svc.Running, Accepts: cmdsAccepted}
	logger.Info("Windows Service running successfully.")

	errChan := make(chan error, 1)
	go func() {
		errChan <- RunAgentLoop(ctx, ws.cfg)
	}()

	for {
		select {
		case err := <-errChan:
			if err != nil {
				logger.Error("Agent routine ended with error: %v", err)
			}
			changes <- svc.Status{State: svc.StopPending}
			return false, 0

		case c := <-r:
			switch c.Cmd {
			case svc.Interrogate:
				changes <- c.CurrentStatus
			case svc.Stop, svc.Shutdown:
				logger.Info("Received stop request from Service Control Manager.")
				changes <- svc.Status{State: svc.StopPending}
				cancel()
				// Wait briefly for graceful shutdown
				select {
				case <-errChan:
				case <-time.After(3 * time.Second):
				}
				changes <- svc.Status{State: svc.Stopped}
				return false, 0
			default:
				logger.Warn("Unexpected service control request #%d", c)
			}
		}
	}
}

// RunService runs the agent as a Windows Service.
func RunService(cfg *config.Config) error {
	isService, err := svc.IsWindowsService()
	if err != nil {
		return fmt.Errorf("failed to determine if running as Windows Service: %w", err)
	}

	if isService {
		return svc.Run(config.ServiceName, &windowsService{cfg: cfg})
	}

	// Running in interactive console mode
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	return RunAgentLoop(ctx, cfg)
}

// InstallService registers the executable as a Windows Service with automatic boot startup.
func InstallService() error {
	exePath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}
	exePath, err = filepath.Abs(exePath)
	if err != nil {
		return err
	}

	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("failed to connect to Service Manager (requires Administrator): %w", err)
	}
	defer m.Disconnect()

	s, err := m.OpenService(config.ServiceName)
	if err == nil {
		s.Close()
		return fmt.Errorf("service %s already exists", config.ServiceName)
	}

	s, err = m.CreateService(
		config.ServiceName,
		exePath,
		mgr.Config{
			DisplayName: config.ServiceDisplayName,
			Description: config.ServiceDescription,
			StartType:   mgr.StartAutomatic,
		},
		"-service",
	)
	if err != nil {
		return fmt.Errorf("failed to create service: %w", err)
	}
	defer s.Close()

	return nil
}

// UninstallService removes the Windows Service.
func UninstallService() error {
	m, err := mgr.Connect()
	if err != nil {
		return fmt.Errorf("failed to connect to Service Manager: %w", err)
	}
	defer m.Disconnect()

	s, err := m.OpenService(config.ServiceName)
	if err != nil {
		return fmt.Errorf("service %s is not installed", config.ServiceName)
	}
	defer s.Close()

	// Stop service if running
	status, err := s.Control(svc.Stop)
	if err == nil {
		time.Sleep(1 * time.Second)
	}
	_ = status

	if err := s.Delete(); err != nil {
		return fmt.Errorf("failed to delete service: %w", err)
	}

	return nil
}

// StartService starts the registered Windows service.
func StartService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	s, err := m.OpenService(config.ServiceName)
	if err != nil {
		return err
	}
	defer s.Close()

	return s.Start()
}

// StopService stops the running Windows service.
func StopService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect()

	s, err := m.OpenService(config.ServiceName)
	if err != nil {
		return err
	}
	defer s.Close()

	_, err = s.Control(svc.Stop)
	return err
}
