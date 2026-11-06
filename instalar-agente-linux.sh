#!/bin/bash
# ==============================================================================
# UBLOCK RMM - INSTALADOR DE SERVICO EM SEGUNDO PLANO (LINUX / UBUNTU)
# ==============================================================================

set -e

echo "========================================================"
echo "  UBLOCK RMM - INSTALACAO DE SERVICO 24H (LINUX)"
echo "========================================================"
echo ""

# 1. Verificar privilégios de root
if [ "$EUID" -ne 0 ]; then
    echo "[ERRO] Este instalador precisa de privilegios de Administrador (root)."
    echo "Por favor, execute novamente usando: sudo bash $0"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/opt/ublock-agent"
API_URL="https://ublock-api-fn7d.onrender.com/api/v1"

# 2. Verificar e instalar Python 3 se necessário
if ! command -v python3 &> /dev/null; then
    echo "[1/4] Python 3 nao encontrado. Instalando pacotes necessarios..."
    if command -v apt-get &> /dev/null; then
        apt-get update -qq && apt-get install -y -qq python3
    elif command -v yum &> /dev/null; then
        yum install -y python3
    else
        echo "[ERRO] Nao foi possivel instalar python3 automaticamente. Instale manualmente antes de prosseguir."
        exit 1
    fi
fi

# 3. Preparar diretório de instalação permanente
echo "[1/4] Preparando pasta de execucao em $INSTALL_DIR..."
mkdir -p "$INSTALL_DIR"

# Encontrar script do agente no pacote
AGENT_SRC=""
if [ -f "$SCRIPT_DIR/agent/scripts/run-agent-client.py" ]; then
    AGENT_SRC="$SCRIPT_DIR/agent/scripts/run-agent-client.py"
elif [ -f "$SCRIPT_DIR/run-agent-client.py" ]; then
    AGENT_SRC="$SCRIPT_DIR/run-agent-client.py"
elif [ -f "$INSTALL_DIR/agent.py" ]; then
    AGENT_SRC="$INSTALL_DIR/agent.py"
fi

if [ -z "$AGENT_SRC" ]; then
    echo "[ERRO] Arquivo run-agent-client.py nao foi encontrado nesta pasta."
    exit 1
fi

cp -f "$AGENT_SRC" "$INSTALL_DIR/agent.py"
chmod +x "$INSTALL_DIR/agent.py"

# 4. Obter token de pareamento
TOKEN="$1"
if [ -z "$TOKEN" ]; then
    echo ""
    echo "========================================================"
    echo "  PAREAMENTO DO COMPUTADOR LINUX (UBUNTU)"
    echo "========================================================"
    echo ""
    read -p "Cole o Codigo de Pareamento gerado no Painel Web (ex: ublock_bulk_...): " TOKEN
fi

# Remove espaços
TOKEN="$(echo "$TOKEN" | tr -d ' ')"

if [ -z "$TOKEN" ]; then
    if [ -f "$INSTALL_DIR/agent_state.json" ]; then
        echo "[INFO] Nenhum token informado. Utilizando credenciais de pareamento ja existentes..."
    else
        echo "[ERRO] E necessario informar o codigo de pareamento na primeira instalacao!"
        exit 1
    fi
else
    echo ""
    echo "[2/4] Removendo registro anterior e pareando maquina com a nuvem..."
    rm -f "$INSTALL_DIR/agent_state.json"

    # Executa pareamento inicial
    python3 "$INSTALL_DIR/agent.py" -token "$TOKEN" -api "$API_URL" --enroll-only
    if [ $? -ne 0 ]; then
        echo ""
        echo "[ERRO] Falha ao parear com o servidor central Ublock."
        echo "Verifique sua conexao com a internet e a validade do token informado."
        exit 1
    fi
fi

# 5. Configurar serviço permanente systemd (24h com reinício automático)
echo ""
echo "[3/4] Configurando servico de segundo plano no systemd (/etc/systemd/system/ublock-agent.service)..."

# Parar serviço anterior se existir
systemctl stop ublock-agent 2>/dev/null || true

cat <<EOF > /etc/systemd/system/ublock-agent.service
[Unit]
Description=Ublock RMM Monitoring & Endpoint Containment Agent
After=network.target network-online.target
Wants=network-online.target

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/python3 $INSTALL_DIR/agent.py -api $API_URL
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

chmod 644 /etc/systemd/system/ublock-agent.service

# 6. Ativar e iniciar serviço
echo "[4/4] Ativando inicializacao automatica no boot e iniciando o agente..."
systemctl daemon-reload
systemctl enable ublock-agent
systemctl restart ublock-agent

echo ""
echo "========================================================"
echo "  INSTALACAO CONCLUIDA COM SUCESSO NO LINUX!"
echo "========================================================"
echo ""
echo "  * O agente Ublock esta rodando 24h em segundo plano via systemd."
echo "  * Ele iniciara automaticamente sempre que a maquina for ligada."
echo "  * Comandos de Bloqueio, Offboarding e Telemetria estao ativos."
echo "  * Para verificar o status a qualquer momento: sudo systemctl status ublock-agent"
echo "  * Para acompanhar os logs em tempo real: sudo journalctl -u ublock-agent -f"
echo ""
