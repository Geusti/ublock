# Script PowerShell para iniciar o Agente de Teste
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  NEXUS IT ASSET MANAGER - AGENTE CLIENTE WINDOWS      " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$pyExe = Join-Path $scriptDir "backend\venv\Scripts\python.exe"

if (-not (Test-Path $pyExe)) {
    $pyExe = "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe"
}

if (-not (Test-Path $pyExe)) {
    Write-Error "Ambiente Python não localizado."
    exit 1
}

Write-Host "Python localizado: $pyExe" -ForegroundColor Green
Write-Host ""

$token = Read-Host "Cole o Código de Pareamento gerado no Painel (ou pressione Enter para reutilizar)"

$agentScript = Join-Path $scriptDir "agent\scripts\run-agent-client.py"

if ($token -and $token.Trim() -ne "") {
    & "$pyExe" "$agentScript" -token "$token"
} else {
    & "$pyExe" "$agentScript"
}
