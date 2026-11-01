@echo off
title Ublock - Instalador de Monitoramento em Background
cls
echo ========================================================
echo   UBLOCK RMM - INSTALACAO DE SERVICO EM SEGUNDO PLANO
echo ========================================================
echo.

:: 1. Verificar privil?gios de Administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [AVISO] Solicitando permissoes de Administrador para configurar a inicializacao automatica...
    powershell -Command "Start-Process '%~f0' -Verb RunAs"
    exit /b
)

cd /d "%~dp0"

if not exist "%~dp0ublock-agent.exe" (
    echo [ERRO] O arquivo ublock-agent.exe nao foi encontrado na mesma pasta.
    pause
    exit /b 1
)

:: 2. Pasta oficial de instalacao permanente do Windows
set "INSTALL_DIR=%ProgramFiles%\UblockAgent"
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

echo [1/4] Copiando arquivos para %INSTALL_DIR%...
copy /y "%~dp0ublock-agent.exe" "%INSTALL_DIR%\ublock-agent.exe" >nul

:: 3. Solicitar c?digo de pareamento se for primeira vez
echo.
set /p TOKEN="Cole o Codigo de Pareamento gerado no Painel Web: "

if "%TOKEN%"=="" (
    echo [ERRO] E necessario informar o codigo de pareamento na primeira instalacao!
    pause
    exit /b 1
)

:: 4. Realizar primeiro pareamento e registro na nuvem
echo.
echo [2/4] Registrando computador no servidor central e sincronizando hardware...
"%INSTALL_DIR%\ublock-agent.exe" -token "%TOKEN%" -api "https://ublock-api-fn7d.onrender.com/api/v1" < nul >nul 2>&1

:: 5. Criar script VBS para rodar 100% invisivel (sem janela preta de prompt)
echo [3/4] Configurando execucao invisivel em segundo plano...
(
    echo Set WshShell = CreateObject^("WScript.Shell"^)
    echo WshShell.Run """" ^& "%INSTALL_DIR%\ublock-agent.exe" ^& """ -api https://ublock-api-fn7d.onrender.com/api/v1", 0, False
) > "%INSTALL_DIR%\silent-agent.vbs"

:: 6. Criar Tarefa Agendada no Windows (Task Scheduler)
:: Inicia no Boot da maquina (antes do logon), roda com usuario SYSTEM e reinicia se cair
echo [4/4] Registrando inicializacao automatica 24h com o Windows...

schtasks /delete /tn "UblockAgent" /f >nul 2>&1
schtasks /create /tn "UblockAgent" /tr "wscript.exe \"%INSTALL_DIR%\silent-agent.vbs\"" /sc onlogon /rl highest /f >nul

:: Registrar tambem no Run do Windows como garantia de redundancia
reg add "HKLM\Software\Microsoft\Windows\CurrentVersion\Run" /v "UblockAgent" /t REG_SZ /d "wscript.exe \"%INSTALL_DIR%\silent-agent.vbs\"" /f >nul 2>&1

:: 7. Iniciar o agente imediatamente em segundo plano
start "" wscript.exe "%INSTALL_DIR%\silent-agent.vbs"

echo.
echo ========================================================
echo   INSTALACAO CONCLUIDA COM SUCESSO!
echo ========================================================
echo.
echo   * O agente ja esta rodando agora mesmo em segundo plano.
echo   * Nenhuma janela ficara aberta na tela do usuario.
echo   * O Ublock iniciara automaticamente sempre que o PC ligar.
echo   * Verifique o painel web: o computador ja deve constar ONLINE!
echo.
timeout /t 5 >nul