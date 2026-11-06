#!/bin/bash
# ==============================================================================
# UBLOCK RMM - INSTALADOR DE SERVICO EM SEGUNDO PLANO (macOS)
# ==============================================================================

set -e

echo "========================================================"
echo "  UBLOCK RMM - INSTALACAO DE SERVICO 24H (macOS)"
echo "========================================================"
echo ""

# 1. Verificar privilégios de root
if [ "$EUID" -ne 0 ]; then
    echo "[ERRO] Este instalador precisa de privilegios de Administrador (root)."
    echo "Por favor, execute novamente usando: sudo bash $0"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
INSTALL_DIR="/Library/Application Support/UblockAgent"
API_URL="https://ublock-api-fn7d.onrender.com/api/v1"

# 2. Verificar Python 3
PYTHON_BIN=""
if command -v python3 &> /dev/null; then
    PYTHON_BIN="$(command -v python3)"
elif [ -x "/usr/bin/python3" ]; then
    PYTHON_BIN="/usr/bin/python3"
elif [ -x "/usr/local/bin/python3" ]; then
    PYTHON_BIN="/usr/local/bin/python3"
elif [ -x "/opt/homebrew/bin/python3" ]; then
    PYTHON_BIN="/opt/homebrew/bin/python3"
else
    echo "[ERRO] Python 3 nao encontrado no macOS."
    echo "Instale o Command Line Tools executando: xcode-select --install"
    exit 1
fi

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

# 3. Obter token de pareamento
TOKEN="$1"
if [ -z "$TOKEN" ]; then
    echo ""
    echo "========================================================"
    echo "  PAREAMENTO DO MAC (macOS)"
    echo "========================================================"
    echo ""
    read -p "Cole o Codigo de Pareamento gerado no Painel Web (ex: ublock_bulk_...): " TOKEN
fi

# Remove espaços
TOKEN="$(echo "$TOKEN" | tr -d ' ')"

if [ -z "$TOKEN" ]; then
    if [ -f "$INSTALL_DIR/agent_state.json" ]; then
        echo "[INFO] Nenhum token informado. Utilizando credenciais de pareamento existentes..."
    else
        echo "[ERRO] E necessario informar o codigo de pareamento na primeira instalacao!"
        exit 1
    fi
else
    echo ""
    echo "[2/4] Removendo registro anterior e pareando maquina com a nuvem..."
    rm -f "$INSTALL_DIR/agent_state.json"

    # Executa pareamento inicial
    "$PYTHON_BIN" "$INSTALL_DIR/agent.py" -token "$TOKEN" -api "$API_URL" --enroll-only
    if [ $? -ne 0 ]; then
        echo ""
        echo "[ERRO] Falha ao parear com o servidor central Ublock."
        echo "Verifique sua conexao com a internet e a validade do token informado."
        exit 1
    fi
fi

# 4. Configurar LaunchDaemon no macOS (execução 24h em segundo plano no boot)
PLIST_PATH="/Library/LaunchDaemons/com.ublock.agent.plist"
echo ""
echo "[3/4] Configurando LaunchDaemon do macOS ($PLIST_PATH)..."

# Descarregar daemon anterior se ativo
launchctl unload -w "$PLIST_PATH" 2>/dev/null || true

cat <<EOF > "$PLIST_PATH"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ublock.agent</string>
    <key>ProgramArguments</key>
    <array>
        <string>$PYTHON_BIN</string>
        <string>$INSTALL_DIR/agent.py</string>
        <string>-api</string>
        <string>$API_URL</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$INSTALL_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/var/log/ublock-agent.log</string>
    <key>StandardErrorPath</key>
    <string>/var/log/ublock-agent.err</string>
</dict>
</plist>
EOF

chmod 644 "$PLIST_PATH"
chown root:wheel "$PLIST_PATH"

# 5. Carregar e iniciar daemon imediatamente
echo "[4/4] Iniciando servico em segundo plano via launchctl..."
launchctl load -w "$PLIST_PATH"

echo ""
echo "========================================================"
echo "  INSTALACAO CONCLUIDA COM SUCESSO NO macOS!"
echo "========================================================"
echo ""
echo "  * O agente Ublock esta rodando 24h como LaunchDaemon no macOS."
echo "  * Ele iniciara automaticamente sempre que o Mac for ligado."
echo "  * Comandos de Bloqueio, Offboarding e Telemetria estao ativos."
echo "  * Para visualizar os logs em tempo real: tail -f /var/log/ublock-agent.log"
echo ""
