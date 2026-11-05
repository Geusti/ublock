@echo off
setlocal EnableDelayedExpansion
title Ublock - Instalador de Monitoramento em Background
cls
echo ========================================================
echo   UBLOCK RMM - INSTALACAO DE SERVICO EM SEGUNDO PLANO
echo ========================================================
echo.

:: 1. Verificar privilegios de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Solicitando permissoes de Administrador para configurar a inicializacao automatica...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

if not exist "%~dp0ublock-agent.exe" (
    echo [ERRO] O arquivo ublock-agent.exe nao foi encontrado nesta pasta.
    pause
    exit /b 1
)

:: 2. Pasta permanente do Windows
set "INSTALL_DIR=%ProgramFiles%\UblockAgent"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo [1/4] Encerrando processos anteriores se houver...
taskkill /f /im "ublock-agent.exe" >nul 2>&1

echo [2/4] Copiando arquivos para %INSTALL_DIR%...
copy /y "%~dp0ublock-agent.exe" "%INSTALL_DIR%\ublock-agent.exe" >nul

:: 3. Solicitar codigo de pareamento
echo.
echo ========================================================
echo   PAREAMENTO DO COMPUTADOR
echo ========================================================
echo.
set /p TOKEN="Cole o Codigo de Pareamento gerado no Painel Web (ex: ublock_bulk_...): "
set "TOKEN=!TOKEN: =!"

if "!TOKEN!"=="" (
    if exist "%INSTALL_DIR%\agent_state.json" (
        echo [INFO] Nenhum token digitado. Utilizando pareamento existente...
    ) else (
        echo [ERRO] E necessario informar o codigo de pareamento na primeira instalacao!
        pause
        exit /b 1
    )
) else (
    echo.
    echo [3/4] Removendo registro anterior e pareando maquina com a nuvem...
    if exist "%INSTALL_DIR%\agent_state.json" del /f /q "%INSTALL_DIR%\agent_state.json" >nul 2>&1
    if exist "%~dp0agent_state.json" del /f /q "%~dp0agent_state.json" >nul 2>&1
    if exist "%~dp0agent\scripts\agent_state.json" del /f /q "%~dp0agent\scripts\agent_state.json" >nul 2>&1
    
    cd /d "%INSTALL_DIR%"
    "%INSTALL_DIR%\ublock-agent.exe" -token "!TOKEN!" -api "https://ublock-api-fn7d.onrender.com/api/v1" < nul
    if !errorlevel! neq 0 (
        echo.
        echo [ERRO] Falha ao parear com o servidor central.
        echo Verifique sua conexao com a internet e se o token e valido.
        pause
        exit /b 1
    )
)

:: 4. Criar script VBS para rodar 100%% invisivel em segundo plano (24h)
echo.
echo [4/4] Configurando execucao invisivel e inicializacao automatica...
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%INSTALL_DIR%"
    echo WshShell.Run """" ^& "%INSTALL_DIR%\ublock-agent.exe" ^& """ -api https://ublock-api-fn7d.onrender.com/api/v1", 0, False
) > "%INSTALL_DIR%\silent-agent.vbs"

:: Registrar no Run (HKLM e HKCU) para iniciar 24h junto com o Windows
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "UblockAgent" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\silent-agent.vbs\"" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "UblockAgent" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\silent-agent.vbs\"" /f >nul 2>&1

:: Iniciar imediatamente em segundo plano
cd /d "%INSTALL_DIR%"
start "" wscript.exe "%INSTALL_DIR%\silent-agent.vbs"

echo.
echo ========================================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================================
echo.
echo   * O agente Ublock esta rodando em segundo plano.
echo   * Ele iniciara automaticamente sempre que o computador ligar.
echo   * Nenhuma janela ficara aberta na tela.
echo   * Os comandos de Bloqueio e Telemetria estao ativos.
echo.
pause
