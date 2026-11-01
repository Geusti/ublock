@echo off
title Ublock - Agente de Monitoramento
cls
echo ========================================================
echo       UBLOCK RMM - AGENTE CLIENTE WINDOWS
echo ========================================================
echo.

if not exist "%~dp0ublock-agent.exe" (
    echo [ERRO] O arquivo ublock-agent.exe nao foi encontrado nesta pasta.
    pause
    exit /b 1
)

set /p TOKEN="Cole o Codigo de Pareamento gerado no Painel Web (ou pressione Enter se ja pareou): "

if "%TOKEN%"=="" (
    "%~dp0ublock-agent.exe" -api "https://ublock-api-fn7d.onrender.com/api/v1"
) else (
    "%~dp0ublock-agent.exe" -token "%TOKEN%" -api "https://ublock-api-fn7d.onrender.com/api/v1"
)

echo.
pause