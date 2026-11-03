@echo off
title Ublock - Instalador de Monitoramento em Background
cls
echo ========================================================
echo   UBLOCK RMM - INSTALACAO DE SERVICO EM SEGUNDO PLANO
echo ========================================================
echo.

:: 1. Verificar privilégios de Administrador
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

echo [1/5] Encerrando processos anteriores se houver...
taskkill /f /im "ublock-agent.exe" >nul 2>&1

echo [2/5] Copiando arquivos para %INSTALL_DIR%...
copy /y "%~dp0ublock-agent.exe" "%INSTALL_DIR%\ublock-agent.exe" >nul

:: Se já houver state na pasta atual, copia também
if exist "%~dp0agent\scripts\agent_state.json" (
    copy /y "%~dp0agent\scripts\agent_state.json" "%INSTALL_DIR%\agent_state.json" >nul
)
if exist "%~dp0agent_state.json" (
    copy /y "%~dp0agent_state.json" "%INSTALL_DIR%\agent_state.json" >nul
)

:: 3. Solicitar código de pareamento se for primeira vez e não tiver state salvo
if not exist "%INSTALL_DIR%\agent_state.json" (
    echo.
    set /p TOKEN="Cole o Codigo de Pareamento gerado no Painel Web: "
    if "%TOKEN%"=="" (
        echo [ERRO] E necessario informar o codigo de pareamento na primeira instalacao!
        pause
        exit /b 1
    )
    echo [3/5] Registrando maquina no servidor central...
    cd /d "%INSTALL_DIR%"
    "%INSTALL_DIR%\ublock-agent.exe" -token "%TOKEN%" -api "https://ublock-api-fn7d.onrender.com/api/v1" < nul >nul 2>&1
) else (
    echo [3/5] Maquina ja possui registro salvo. Mantendo credenciais ativas.
)

:: 4. Criar script VBS para rodar 100% invisível em segundo plano
echo [4/5] Configurando execucao invisivel em segundo plano...
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%INSTALL_DIR%"
    echo WshShell.Run """" ^& "%INSTALL_DIR%\ublock-agent.exe" ^& """ -api https://ublock-api-fn7d.onrender.com/api/v1", 0, False
) > "%INSTALL_DIR%\silent-agent.vbs"

:: 5. Criar inicialização automática permanente no Registro do Windows
echo [5/5] Registrando inicializacao automatica 24h com o Windows...
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
echo   * O agente ja esta rodando agora mesmo em segundo plano.
echo   * Nenhuma janela ficara aberta na tela do usuario.
echo   * O Ublock iniciara automaticamente sempre que o PC ligar.
echo   * Comandos de Bloqueio da Web serao executados nesta maquina!
echo.
timeout /t 5 >nul
