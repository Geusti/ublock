package client

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"ublock/agent/internal/collector"
	"ublock/agent/internal/config"
)

func TestClientEnrollSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/agent/enroll" {
			t.Errorf("Unexpected path: %s", r.URL.Path)
		}
		res := EnrollResponse{
			AgentId:                  "agent-uuid-1",
			AgentKey:                 "key-abc",
			DeviceId:                 "dev-1",
			OrganizationId:           "org-1",
			HeartbeatIntervalSeconds: 30,
			InventoryIntervalSeconds: 600,
		}
		_ = json.NewEncoder(w).Encode(res)
	}))
	defer server.Close()

	cfg := &config.Config{
		ApiUrl:    server.URL,
		AgentUuid: "test-uuid",
		Version:   "1.0.0",
	}

	c := New(cfg)
	resp, err := c.Enroll("test-token", &collector.SystemInfo{Hostname: "MY-PC"})
	if err != nil {
		t.Fatalf("Enroll failed: %v", err)
	}

	if resp.AgentKey != "key-abc" {
		t.Errorf("Expected AgentKey 'key-abc', got '%s'", resp.AgentKey)
	}
}

func TestClientHeartbeatHeaders(t *testing.T) {
	var receivedKey string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedKey = r.Header.Get("X-Agent-Key")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ACK"}`))
	}))
	defer server.Close()

	cfg := &config.Config{
		ApiUrl:    server.URL,
		AgentUuid: "test-uuid",
		AgentKey:  "my-secret-agent-key",
		Version:   "1.0.0",
	}

	c := New(cfg)
	err := c.SendHeartbeat(3600, "")
	if err != nil {
		t.Fatalf("SendHeartbeat failed: %v", err)
	}

	if receivedKey != "my-secret-agent-key" {
		t.Errorf("Expected X-Agent-Key 'my-secret-agent-key', got '%s'", receivedKey)
	}
}

func TestClientHeartbeatRevoked(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden)
		_, _ = w.Write([]byte(`{"detail":"Agente revogado"}`))
	}))
	defer server.Close()

	cfg := &config.Config{
		ApiUrl:    server.URL,
		AgentUuid: "test-uuid",
		AgentKey:  "revoked-key",
		Version:   "1.0.0",
	}

	c := New(cfg)
	err := c.SendHeartbeat(3600, "")
	if err != ErrRevoked {
		t.Errorf("Expected ErrRevoked, got %v", err)
	}
}
