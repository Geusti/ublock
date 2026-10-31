package service

import (
	"context"
	"time"

	"ublock/agent/internal/client"
	"ublock/agent/internal/collector"
	"ublock/agent/internal/config"
	"ublock/agent/internal/logger"
)

// RunAgentLoop is the main monitoring routine executed by both service and console modes.
func RunAgentLoop(ctx context.Context, cfg *config.Config) error {
	c := client.New(cfg)

	logger.Info("Starting NEXUS Asset Agent loop (API: %s, Device UUID: %s)...", cfg.ApiUrl, cfg.AgentUuid)

	// Send initial technical inventory upon startup
	info, err := collector.CollectFullInventory()
	if err != nil {
		logger.Error("Failed initial inventory collection: %v", err)
	} else {
		if err := c.SendInventory(info); err != nil {
			logger.Error("Failed to send initial inventory to server: %v", err)
		} else {
			logger.Info("Initial technical inventory dispatched successfully to server.")
		}
	}

	heartbeatTicker := time.NewTicker(time.Duration(cfg.HeartbeatIntervalSec) * time.Second)
	inventoryTicker := time.NewTicker(time.Duration(cfg.InventoryIntervalSec) * time.Second)
	defer heartbeatTicker.Stop()
	defer inventoryTicker.Stop()

	var lastErrorMsg string

	for {
		select {
		case <-ctx.Done():
			logger.Info("Stopping NEXUS Asset Agent loop cleanly...")
			return nil

		case <-heartbeatTicker.C:
			uptime := collector.GetUptimeSeconds()
			if err := c.SendHeartbeat(uptime, lastErrorMsg); err != nil {
				if err == client.ErrRevoked {
					logger.Error("AGENT REVOKED: Server responded that this agent has been revoked. Terminating...")
					return err
				}
				lastErrorMsg = err.Error()
				logger.Warn("Heartbeat communication error: %v", err)
			} else {
				lastErrorMsg = ""
				logger.Info("Heartbeat reported (uptime: %ds).", uptime)
			}

		case <-inventoryTicker.C:
			info, err := collector.CollectFullInventory()
			if err != nil {
				lastErrorMsg = err.Error()
				logger.Error("Inventory collection error: %v", err)
				continue
			}

			if err := c.SendInventory(info); err != nil {
				if err == client.ErrRevoked {
					logger.Error("AGENT REVOKED: Server responded that this agent has been revoked. Terminating...")
					return err
				}
				lastErrorMsg = err.Error()
				logger.Warn("Inventory dispatch error: %v", err)
			} else {
				lastErrorMsg = ""
				logger.Info("Periodic hardware inventory updated successfully.")
			}
		}
	}
}
