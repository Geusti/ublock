#!/bin/bash
# ==============================================================================
# UBLOCK RMM - DESINSTALADOR UNIVERSAL UNIX (LINUX / UBUNTU E macOS)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OS_NAME="$(uname -s)"

if [ "$OS_NAME" = "Linux" ]; then
    bash "$SCRIPT_DIR/desinstalar-agente-linux.sh" "$@"
elif [ "$OS_NAME" = "Darwin" ]; then
    bash "$SCRIPT_DIR/desinstalar-agente-macos.sh" "$@"
else
    echo "[ERRO] Sistema operacional '$OS_NAME' nao reconhecido."
    exit 1
fi
