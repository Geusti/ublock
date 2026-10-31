@echo off
title NEXUS / Ublock - Agente Cliente (Nuvem)
cls
echo ========================================================
echo   NEXUS IT ASSET MANAGER - AGENTE CLIENTE (PRODUCAO)
echo ========================================================
echo.

set "API_URL=https://ublock-api-fn7d.onrender.com/api/v1"
echo Conectando ao Servidor Central: %API_URL%
echo.

set "PY_CMD=python"
where python >nul 2>&1
if %errorlevel% neq 0 (
    if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" (
        set "PY_CMD=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"
    ) else if exist "..\backend\venv\Scripts\python.exe" (
        set "PY_CMD=..\backend\venv\Scripts\python.exe"
    ) else (
        echo [ERRO] Python nao foi encontrado neste computador.
        echo Por favor, instale o Python 3 nesta maquina para executar o agente cliente.
        pause
        exit /b 1
    )
)

set /p TOKEN="Cole o Codigo de Pareamento gerado no Painel Web (ou pressione Enter se ja pareou): "

if "%TOKEN%"=="" (
    "%PY_CMD%" "%~dp0run-agent-client.py" -api "%API_URL%"
) else (
    "%PY_CMD%" "%~dp0run-agent-client.py" -token "%TOKEN%" -api "%API_URL%"
)

echo.
pause