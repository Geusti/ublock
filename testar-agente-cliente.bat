@echo off
title NEXUS / Ublock - Agente Cliente de Teste
cls
echo ========================================================
echo   NEXUS IT ASSET MANAGER - AGENTE CLIENTE WINDOWS
echo ========================================================
echo.

cd /d "%~dp0"

set "PY_EXE="
if exist "%~dp0backend\venv\Scripts\python.exe" set "PY_EXE=%~dp0backend\venv\Scripts\python.exe"
if not defined PY_EXE if exist "%LOCALAPPDATA%\Programs\Python\Python311\python.exe" set "PY_EXE=%LOCALAPPDATA%\Programs\Python\Python311\python.exe"

if not defined PY_EXE (
    echo [ERRO] Python nao encontrado em backend\venv ou no sistema.
    pause
    exit /b 1
)

echo Python localizado: %PY_EXE%
echo.
set /p TOKEN="Cole o Codigo de Pareamento gerado no Painel (ou pressione Enter para reutilizar registro existente): "

if "%TOKEN%"=="" (
    "%PY_EXE%" "%~dp0agent\scripts\run-agent-client.py"
) else (
    "%PY_EXE%" "%~dp0agent\scripts\run-agent-client.py" -token "%TOKEN%"
)

echo.
pause