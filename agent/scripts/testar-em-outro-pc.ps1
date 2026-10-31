# NEXUS IT ASSET MANAGER - Agente Cliente para Outro Computador na Mesma Rede
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  NEXUS IT ASSET MANAGER - AGENTE CLIENTE WINDOWS      " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$serverIp = "192.168.1.103"
$apiUrl = "http://${serverIp}:8000/api/v1"

Write-Host "Servidor Central: $apiUrl" -ForegroundColor Yellow
Write-Host ""

$token = Read-Host "Cole o Codigo de Pareamento (ou pressione Enter se ja pareou anteriormente)"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$agentPy = Join-Path $scriptDir "run-agent-client.py"

if (-not (Test-Path $agentPy)) {
    $agentPy = Join-Path $scriptDir "agent\scripts\run-agent-client.py"
}

# Tenta usar python do sistema
$pythonCmd = Get-Command python -ErrorAction SilentlyContinue

if (-not $pythonCmd) {
    Write-Host "[INFO] Python nao detectado no PATH. Tentando via instalacao local..." -ForegroundColor Gray
    if (Test-Path "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe") {
        $pythonCmd = "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
    } elseif (Test-Path "..\backend\venv\Scripts\python.exe") {
        $pythonCmd = "..\backend\venv\Scripts\python.exe"
    }
}

if (-not $pythonCmd) {
    Write-Error "Python 3 nao encontrado nesta maquina. Instale o Python para rodar o cliente de teste."
    pause
    exit 1
}

if ($token -and $token.Trim() -ne "") {
    & $pythonCmd "$agentPy" -token "$token" -api "$apiUrl"
} else {
    & $pythonCmd "$agentPy" -api "$apiUrl"
}

pause
