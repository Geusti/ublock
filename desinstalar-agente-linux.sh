#!/bin/bash
# ==============================================================================
# UBLOCK RMM - DESINSTALADOR DO AGENTE LINUX
# ==============================================================================

set -e

if [ "$EUID" -ne 0 ]; then
    echo "[ERRO] Execute como root: sudo bash $0"
    exit 1
fi

echo "========================================================"
echo "  REMOVENDO AGENTE UBLOCK RMM (LINUX)"
echo "========================================================"

echo "[1/3] Parando e desativando servico systemd..."
systemctl stop ublock-agent 2>/dev/null || true
systemctl disable ublock-agent 2>/dev/null || true

echo "[2/3] Removendo definicao do servico..."
rm -f /etc/systemd/system/ublock-agent.service
systemctl daemon-reload

echo "[3/3] Removendo arquivos de execucao e credenciais..."
rm -rf /opt/ublock-agent

echo ""
echo "O Agente Ublock foi desinstalado com sucesso do sistema."
