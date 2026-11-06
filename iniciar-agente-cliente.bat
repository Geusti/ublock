@echo off
setlocal EnableDelayedExpansion
title Ublock - Agente Cliente Windows (Console)
cls
echo ========================================================
echo       UBLOCK RMM - AGENTE CLIENTE WINDOWS
echo ========================================================
echo.

cd /d "%~dp0"

if not exist "%~dp0ublock-agent.exe" (
    echo [ERRO] O arquivo ublock-agent.exe nao foi encontrado nesta pasta.
    pause
    exit /b 1
)

set "HAS_STATE=0"
if exist "%~dp0agent_state.json" set "HAS_STATE=1"
if exist "%ProgramFiles%\UblockAgent\agent_state.json" set "HAS_STATE=1"

if "!HAS_STATE!"=="0" (
    echo [NOVO COMPUTADOR] Este computador ainda nao possui registro ativo.
    set /p TOKEN="Cole o Codigo de Pareamento gerado no Painel Web (ex: ublock_bulk_...): "
) else (
    set /p TOKEN="Cole o Codigo de Pareamento (ou pressione Enter para usar o registro atual): "
)

set "TOKEN=!TOKEN: =!"

if "!TOKEN!"=="" (
    if "!HAS_STATE!"=="0" (
        echo.
        echo [ERRO] E obrigatorio informar o Codigo de Pareamento no primeiro acesso!
        echo Gere um codigo no painel web em "Pareamento em Lote (Auto-Discovery)".
        pause
        exit /b 1
    )
    "%~dp0ublock-agent.exe" -api "https://ublock-api-fn7d.onrender.com/api/v1"
) else (
    "%~dp0ublock-agent.exe" -token "!TOKEN!" -api "https://ublock-api-fn7d.onrender.com/api/v1"
)

echo.
pause
