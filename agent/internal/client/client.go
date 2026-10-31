package client

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/rand"
	"net/http"
	"time"

	"ublock/agent/internal/collector"
	"ublock/agent/internal/config"
	"ublock/agent/internal/logger"
)

var (
	ErrRevoked    = errors.New("agent has been revoked by administrator")
	ErrUnauthorized = errors.New("agent authentication key rejected")
)

type Client struct {
	cfg        *config.Config
	httpClient *http.Client
}

func New(cfg *config.Config) *Client {
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			Timeout: 15 * time.Second,
		},
	}
}

type EnrollRequest struct {
	EnrollmentToken string `json:"enrollment_token"`
	AgentUuid       string `json:"agent_uuid"`
	AgentVersion    string `json:"agent_version"`
	Hostname        string `json:"hostname"`
	OsFamily        string `json:"os_family"`
	OsVersion       string `json:"os_version"`
	Architecture    string `json:"architecture"`
}

type EnrollResponse struct {
	AgentId                  string `json:"agent_id"`
	AgentKey                 string `json:"agent_key"`
	DeviceId                 string `json:"device_id"`
	OrganizationId           string `json:"organization_id"`
	HeartbeatIntervalSeconds int    `json:"heartbeat_interval_seconds"`
	InventoryIntervalSeconds int    `json:"inventory_interval_seconds"`
}

// Enroll performs initial registration using a temporary one-time token.
func (c *Client) Enroll(token string, sysInfo *collector.SystemInfo) (*EnrollResponse, error) {
	url := fmt.Sprintf("%s/agent/enroll", c.cfg.ApiUrl)

	reqBody := EnrollRequest{
		EnrollmentToken: token,
		AgentUuid:       c.cfg.AgentUuid,
		AgentVersion:    c.cfg.Version,
		Hostname:        sysInfo.Hostname,
		OsFamily:        "WINDOWS",
		OsVersion:       sysInfo.OS.Name + " " + sysInfo.OS.Version,
		Architecture:    sysInfo.OS.Arch,
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal enroll request: %w", err)
	}

	resp, err := c.doWithRetry(context.Background(), "POST", url, data, false)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("enrollment rejected (status %d): %s", resp.StatusCode, string(body))
	}

	var res EnrollResponse
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return nil, fmt.Errorf("failed to parse enroll response: %w", err)
	}

	return &res, nil
}

type HeartbeatRequest struct {
	AgentUuid     string  `json:"agent_uuid"`
	UptimeSeconds *uint64 `json:"uptime_seconds,omitempty"`
	AgentVersion  string  `json:"agent_version"`
	ErrorMessage  *string `json:"error_message,omitempty"`
}

// SendHeartbeat sends periodic ping to server.
func (c *Client) SendHeartbeat(uptimeSec uint64, lastErr string) error {
	url := fmt.Sprintf("%s/agent/heartbeat", c.cfg.ApiUrl)

	var errPtr *string
	if lastErr != "" {
		errPtr = &lastErr
	}

	reqBody := HeartbeatRequest{
		AgentUuid:     c.cfg.AgentUuid,
		UptimeSeconds: &uptimeSec,
		AgentVersion:  c.cfg.Version,
		ErrorMessage:  errPtr,
	}

	data, err := json.Marshal(reqBody)
	if err != nil {
		return err
	}

	resp, err := c.doWithRetry(context.Background(), "POST", url, data, true)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusForbidden {
		return ErrRevoked
	}
	if resp.StatusCode == http.StatusUnauthorized {
		return ErrUnauthorized
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("heartbeat error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// SendInventory sends full technical hardware specifications.
func (c *Client) SendInventory(info *collector.SystemInfo) error {
	url := fmt.Sprintf("%s/agent/inventory", c.cfg.ApiUrl)

	// Combine system info with agent identity
	payload := map[string]interface{}{
		"agent_uuid":     c.cfg.AgentUuid,
		"cpu":            info.CPU,
		"memory":         info.Memory,
		"storage":        info.Storage,
		"network":        info.Network,
		"os_details":     info.OS,
		"manufacturer":   info.Manufacturer,
		"model":          info.Model,
		"serial_number":  info.SerialNumber,
		"uptime_seconds": info.UptimeSec,
	}

	data, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	resp, err := c.doWithRetry(context.Background(), "POST", url, data, true)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusForbidden {
		return ErrRevoked
	}
	if resp.StatusCode == http.StatusUnauthorized {
		return ErrUnauthorized
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("inventory error (status %d): %s", resp.StatusCode, string(body))
	}

	return nil
}

// doWithRetry executes HTTP request with exponential backoff and jitter.
func (c *Client) doWithRetry(ctx context.Context, method, url string, body []byte, authenticated bool) (*http.Response, error) {
	maxRetries := 3
	backoff := 500 * time.Millisecond

	for attempt := 0; attempt <= maxRetries; attempt++ {
		req, err := http.NewRequestWithContext(ctx, method, url, bytes.NewReader(body))
		if err != nil {
			return nil, err
		}

		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("User-Agent", fmt.Sprintf("NexusAssetAgent/%s", c.cfg.Version))

		if authenticated && c.cfg.AgentKey != "" {
			req.Header.Set("X-Agent-Key", c.cfg.AgentKey)
		}

		resp, err := c.httpClient.Do(req)
		if err == nil {
			// Don't retry on client errors (400, 401, 403, 404)
			if resp.StatusCode < 500 {
				return resp, nil
			}
			resp.Body.Close()
			err = fmt.Errorf("server error: %d", resp.StatusCode)
		}

		if attempt == maxRetries {
			return nil, fmt.Errorf("request failed after %d retries: %w", maxRetries, err)
		}

		// Calculate exponential backoff with jitter
		jitter := time.Duration(rand.Int63n(int64(backoff / 2)))
		sleepDuration := backoff + jitter
		logger.Warn("Connection attempt %d to %s failed (%v); retrying in %v...", attempt+1, url, err, sleepDuration)

		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(sleepDuration):
		}

		backoff *= 2
	}

	return nil, errors.New("request failed")
}
