<#
.SYNOPSIS
    Script de Desinstalação e Limpeza do Agente NEXUS IT ASSET MANAGER / Ublock para Windows.
.DESCRIPTION
    Para o serviço Windows NexusAgent, remove o registro do Service Control Manager
    e remove os arquivos de instalação e diretórios de dados temporários.
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [string]$InstallDir = "C:\Program Files\NexusAgent",

    [Parameter(Mandatory = $false)]
    [switch]$KeepData = $false
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  NEXUS IT ASSET MANAGER / Ublock - Desinstalador         " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Verificar privilégios de Administrador
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Error "ERRO: Este script deve ser executado como Administrador. Abra o PowerShell com 'Executar como Administrador'."
    exit 1
}

# 2. Parar o serviço se estiver em execução
$svc = Get-Service -Name "NexusAgent" -ErrorAction SilentlyContinue
if ($svc) {
    if ($svc.Status -eq "Running") {
        Write-Host "[1/3] Parando serviço NexusAgent..." -ForegroundColor Yellow
        try {
            Stop-Service -Name "NexusAgent" -Force -ErrorAction SilentlyContinue
            Start-Sleep -Seconds 2
        } catch {}
    }

    # 3. Remover serviço via binary ou sc.exe
    $destBinary = Join-Path $InstallDir "nexus-agent.exe"
    if (Test-Path $destBinary) {
        Write-Host "[2/3] Removendo serviço via executável..." -ForegroundColor Yellow
        & "$destBinary" -uninstall
    } else {
        Write-Host "[2/3] Removendo serviço via sc.exe delete..." -ForegroundColor Yellow
        sc.exe delete "NexusAgent" | Out-Null
    }
} else {
    Write-Host "[1/3] Serviço NexusAgent não está cadastrado no sistema." -ForegroundColor Gray
}

# 4. Limpar diretório de instalação
if (Test-Path $InstallDir) {
    Write-Host "[3/3] Removendo pasta de instalação: $InstallDir..." -ForegroundColor Yellow
    Remove-Item -Path $InstallDir -Recurse -Force -ErrorAction SilentlyContinue
}

# 5. Opcional: remover ProgramData
if (-not $KeepData) {
    $programData = Join-Path $env:ProgramData "NexusAgent"
    if (Test-Path $programData) {
        Write-Host "      Limpando dados em $programData..." -ForegroundColor Yellow
        Remove-Item -Path $programData -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  SUCESSO: Agente NexusAgent removido com êxito!          " -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
