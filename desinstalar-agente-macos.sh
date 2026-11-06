#!/bin/bash
# ==============================================================================
# UBLOCK RMM - DESINSTALADOR DO AGENTE macOS
# ==============================================================================

set -e

if [ "$EUID" -ne 0 ]; then
    echo "[ERRO] Execute como root: sudo bash $0"
    exit 1
fi

PLIST_PATH="/Library/LaunchDaemons/com.ublock.agent.plist"

echo "========================================================"
echo "  REMOVENDO AGENTE UBLOCK RMM (macOS)"
echo "========================================================"

echo "[1/2] Parando LaunchDaemon do macOS..."
launchctl unload -w "$PLIST_PATH" 2>/dev/null || true
rm -f "$PLIST_PATH"

echo "[2/2] Removendo arquivos de execucao e credenciais..."
rm -rf "/Library/Application Support/UblockAgent"
rm -f /var/log/ublock-agent.log /var/log/ublock-agent.err

echo ""
echo "O Agente Ublock foi desinstalado com sucesso do macOS."
