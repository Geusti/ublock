@echo off
title NEXUS / Ublock - Agente Cliente (Outro PC)
cls
echo ========================================================
echo   NEXUS IT ASSET MANAGER - AGENTE CLIENTE (REDE LOCAL)
echo ========================================================
echo.

set "SERVER_IP=192.168.1.103"
set "API_URL=http://%SERVER_IP%:8000/api/v1"

echo Servidor Central: %API_URL%
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
        echo Por favor, instale o Python 3 nesta maquina para executar o teste.
        pause
        exit /b 1
    )
)

set /p TOKEN="Cole o Codigo de Pareamento gerado no Painel Web: "

if "%TOKEN%"=="" (
    "%PY_CMD%" "%~dp0run-agent-client.py" -api "%API_URL%"
) else (
    "%PY_CMD%" "%~dp0run-agent-client.py" -token "%TOKEN%" -api "%API_URL%"
)

echo.
pause