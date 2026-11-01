@echo off
title Ublock - Desinstalador
cls
echo ========================================================
echo   UBLOCK RMM - DESINSTALACAO DO AGENTE
echo ========================================================
echo.

net session >nul 2>&1
if %errorlevel% neq 0 (
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

echo [1/3] Encerrando processos do ublock-agent em execucao...
taskkill /f /im "ublock-agent.exe" >nul 2>&1

echo [2/3] Removendo inicializacao automatica do Windows...
schtasks /delete /tn "UblockAgent" /f >nul 2>&1
reg delete "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "UblockAgent" /f >nul 2>&1

echo [3/3] Removendo arquivos de %ProgramFiles%\UblockAgent...
if exist "%ProgramFiles%\UblockAgent" (
    rmdir /s /q "%ProgramFiles%\UblockAgent" >nul 2>&1
)

echo.
echo ========================================================
echo   Ublock Agente desinstalado com sucesso deste PC.
echo ========================================================
echo.
pause