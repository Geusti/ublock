<#
.SYNOPSIS
    Script de Instalação e Configuração do Agente NEXUS IT ASSET MANAGER / Ublock para Windows.
.DESCRIPTION
    Este script verifica os privilégios administrativos, copia o binário nexus-agent.exe
    para o diretório de programas, realiza o pareamento de segurança (enrollment) caso um token seja fornecido,
    e registra o executável como serviço do Windows com inicialização automática.
.PARAMETER Token
    Código de pareamento temporário (single-use) gerado no painel administrativo web.
.PARAMETER ApiUrl
    URL base da API Ublock (ex: https://ublock.suaempresa.com.br/api/v1 ou http://localhost:8000/api/v1).
.PARAMETER InstallDir
    Diretório de instalação de destino. Padrão: C:\Program Files\NexusAgent
.EXAMPLE
    .\install-service.ps1 -Token "ublock_enr_abcdef..." -ApiUrl "http://localhost:8000/api/v1"
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$Token,

    [Parameter(Mandatory = $false)]
    [string]$ApiUrl = "http://localhost:8000/api/v1",

    [Parameter(Mandatory = $false)]
    [string]$InstallDir = "C:\Program Files\NexusAgent"
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  NEXUS IT ASSET MANAGER / Ublock - Instalador de Agente   " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verificar privilégios de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "ERRO: Este script deve ser executado como Administrador. Abra o PowerShell com 'Executar como Administrador'."
    exit 1
}

# 2. Localizar binário de origem
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$binaryCandidate1 = Join-Path $scriptDir "..\nexus-agent.exe"
$binaryCandidate2 = Join-Path $scriptDir "nexus-agent.exe"
$binaryCandidate3 = Join-Path (Get-Location) "nexus-agent.exe"

$sourceBinary = $null
if (Test-Path $binaryCandidate1) {
    $sourceBinary = (Resolve-Path $binaryCandidate1).Path
} elseif (Test-Path $binaryCandidate2) {
    $sourceBinary = (Resolve-Path $binaryCandidate2).Path
} elseif (Test-Path $binaryCandidate3) {
    $sourceBinary = (Resolve-Path $binaryCandidate3).Path
}

if (-not $sourceBinary) {
    Write-Error "ERRO: O binário 'nexus-agent.exe' não foi encontrado nas proximidades do script. Compile-o previamente com 'go build -o nexus-agent.exe ./cmd/agent'."
    exit 1
}

Write-Host "[1/5] Binário localizado: $sourceBinary" -ForegroundColor Green

# 3. Criar diretório de destino e copiar binário
if (-not (Test-Path $InstallDir)) {
    Write-Host "[2/5] Criando pasta de destino: $InstallDir" -ForegroundColor Yellow
    New-Item -Path $InstallDir -ItemType Directory -Force | Out-Null
}

$destBinary = Join-Path $InstallDir "nexus-agent.exe"
Write-Host "[2/5] Copiando executável para $destBinary..." -ForegroundColor Green
Copy-Item -Path $sourceBinary -Destination $destBinary -Force

# 4. Realizar pareamento prévio (se token fornecido)
if ($Token -and $Token.Trim() -ne "") {
    Write-Host "[3/5] Registrando agente junto à API ($ApiUrl)..." -ForegroundColor Yellow
    & "$destBinary" -enroll "$Token" -api "$ApiUrl"
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "O registro imediato falhou com código $LASTEXITCODE. Você pode registrar manualmente depois com: '$destBinary -enroll <token> -api <url>'."
    } else {
        Write-Host "      Pareamento concluído com sucesso!" -ForegroundColor Green
    }
} else {
    Write-Host "[3/5] Nenhum token informado. O agente pode ser registrado após a instalação." -ForegroundColor Gray
}

# 5. Instalar o serviço do Windows
Write-Host "[4/5] Registrando o serviço Windows 'NexusAgent'..." -ForegroundColor Yellow
& "$destBinary" -install
if ($LASTEXITCODE -ne 0) {
    Write-Warning "Comando de instalação retornou $LASTEXITCODE. Verifique se o serviço já estava cadastrado."
}

# Configurar recuperação automática em caso de falha
try {
    sc.exe failure "NexusAgent" reset= 86400 actions= restart/60000/restart/60000// | Out-Null
} catch {}

# 6. Iniciar o serviço
Write-Host "[5/5] Iniciando o serviço NexusAgent..." -ForegroundColor Green
try {
    Start-Service -Name "NexusAgent" -ErrorAction SilentlyContinue
} catch {}

Start-Sleep -Seconds 2

$svc = Get-Service -Name "NexusAgent" -ErrorAction SilentlyContinue
if ($svc -and $svc.Status -eq "Running") {
    Write-Host ""
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  SUCESSO: O serviço NexusAgent está instalado e EM EXECUÇÃO! " -ForegroundColor Green
    Write-Host "  Logs disponíveis em: %ProgramData%\NexusAgent\agent.log" -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "O serviço foi instalado com status: $($svc.Status)." -ForegroundColor Yellow
    Write-Host "Verifique os logs em %ProgramData%\NexusAgent\agent.log ou use 'Start-Service NexusAgent'." -ForegroundColor Yellow
}
