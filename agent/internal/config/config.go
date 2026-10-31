package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
)

// Config represents the agent's persistent configuration.
type Config struct {
	ApiUrl               string `json:"api_url"`
	AgentUuid            string `json:"agent_uuid"`
	AgentKey             string `json:"agent_key"`
	HeartbeatIntervalSec int    `json:"heartbeat_interval_sec"`
	InventoryIntervalSec int    `json:"inventory_interval_sec"`
	LogFile              string `json:"log_file"`
	Version              string `json:"version"`
}

const (
	DefaultVersion              = "1.0.0"
	DefaultHeartbeatIntervalSec = 60
	DefaultInventoryIntervalSec = 3600
	ServiceName                 = "NexusAssetAgent"
	ServiceDisplayName         = "NEXUS IT Asset Monitor Agent"
	ServiceDescription         = "Serviço de inventário e monitoramento de ativos Ublock para endpoints corporativos."
)

// GetDefaultConfigDir returns the default directory to store agent data.
func GetDefaultConfigDir() string {
	if runtime.GOOS == "windows" {
		programData := os.Getenv("ProgramData")
		if programData == "" {
			programData = "C:\\ProgramData"
		}
		return filepath.Join(programData, "NexusAgent")
	}
	return "/var/lib/nexus-agent"
}

// GetConfigPath returns the absolute path to config.json.
func GetConfigPath() string {
	return filepath.Join(GetDefaultConfigDir(), "config.json")
}

// Load reads and parses config.json, or returns default config.
func Load() (*Config, error) {
	configPath := GetConfigPath()
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		// Return default configuration
		return &Config{
			ApiUrl:               "http://localhost:8000/api/v1",
			HeartbeatIntervalSec: DefaultHeartbeatIntervalSec,
			InventoryIntervalSec: DefaultInventoryIntervalSec,
			LogFile:              filepath.Join(GetDefaultConfigDir(), "agent.log"),
			Version:              DefaultVersion,
		}, nil
	}

	data, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config JSON: %w", err)
	}

	if cfg.HeartbeatIntervalSec <= 0 {
		cfg.HeartbeatIntervalSec = DefaultHeartbeatIntervalSec
	}
	if cfg.InventoryIntervalSec <= 0 {
		cfg.InventoryIntervalSec = DefaultInventoryIntervalSec
	}
	if cfg.Version == "" {
		cfg.Version = DefaultVersion
	}

	return &cfg, nil
}

// Save writes config to config.json with appropriate file permissions.
func (c *Config) Save() error {
	dir := GetDefaultConfigDir()
	if err := os.MkdirAll(dir, 0750); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to encode config: %w", err)
	}

	configPath := GetConfigPath()
	if err := os.WriteFile(configPath, data, 0600); err != nil {
		return fmt.Errorf("failed to write config file: %w", err)
	}

	return nil
}

// IsEnrolled checks whether the agent has received an authentication key from the server.
func (c *Config) IsEnrolled() bool {
	return c.AgentKey != "" && c.AgentUuid != ""
}
