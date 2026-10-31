@echo off
title NEXUS IT ASSET MANAGER - Ublock (Servidor LAN)
cls
echo ========================================================
echo   Iniciando NEXUS IT ASSET MANAGER (Servidor de Rede)
echo ========================================================
echo.

set "NODE_PATH=C:\Users\Jonatan Geusti\AppData\Local\Microsoft\WinGet\Packages\OpenJS.NodeJS.LTS_Microsoft.Winget.Source_8wekyb3d8bbwe\node-v24.20.0-win-x64"
set "PYTHON_PATH=%~dp0backend\venv\Scripts"
set "PATH=%NODE_PATH%;%PYTHON_PATH%;%PATH%"

echo [1/2] Iniciando Backend FastAPI no IP 192.168.1.103:8000...
start "Ublock Backend" cmd /k "cd /d "%~dp0backend" && .\venv\Scripts\uvicorn.exe app.main:app --host 192.168.1.103 --port 8000 --reload"

echo [2/2] Iniciando Frontend React na rede (0.0.0.0:5173)...
start "Ublock Frontend" cmd /k "cd /d "%~dp0frontend" && "%NODE_PATH%\npm.cmd" run dev -- --host 0.0.0.0"

echo.
echo Aguardando inicializacao dos servicos...
timeout /t 3 /nobreak > nul

echo.
echo ========================================================
echo   SISTEMA PRONTO PARA A REDE LOCAL!
echo   Painel Web (neste PC):     http://localhost:5173
echo   Painel Web (outros PCs):   http://192.168.1.103:5173
echo   API Docs:                  http://192.168.1.103:8000/docs
echo.
echo   Login:                     admin@ubook.com.br
echo   Senha:                     UblockAdmin2026!
echo ========================================================
echo.
start http://localhost:5173