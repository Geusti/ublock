//go:build !windows
// +build !windows

package service

import (
	"context"
	"errors"
	"os"
	"os/signal"
	"syscall"

	"ublock/agent/internal/config"
	"ublock/agent/internal/logger"
)

// RunService runs in interactive process mode on non-windows platforms.
func RunService(cfg *config.Config) error {
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		logger.Info("Received signal %s, stopping...", sig)
		cancel()
	}()

	return RunAgentLoop(ctx, cfg)
}

func InstallService() error {
	return errors.New("installing as a Windows Service is only supported on Windows")
}

func UninstallService() error {
	return errors.New("uninstalling a Windows Service is only supported on Windows")
}

func StartService() error {
	return errors.New("starting a Windows Service is only supported on Windows")
}

func StopService() error {
	return errors.New("stopping a Windows Service is only supported on Windows")
}
