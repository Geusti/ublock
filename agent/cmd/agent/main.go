package main

import (
	"flag"
	"fmt"
	"os"

	"ublock/agent/internal/client"
	"ublock/agent/internal/collector"
	"ublock/agent/internal/config"
	"ublock/agent/internal/logger"
	"ublock/agent/internal/service"
)

func main() {
	// Flags
	installFlag := flag.Bool("install", false, "Instala o agente como Serviço do Windows com inicialização automática")
	uninstallFlag := flag.Bool("uninstall", false, "Remove o Serviço do Windows do agente")
	startFlag := flag.Bool("start", false, "Inicia o Serviço do Windows")
	stopFlag := flag.Bool("stop", false, "Para o Serviço do Windows")
	runFlag := flag.Bool("run", false, "Executa o agente interativamente no console (modo depuração)")
	enrollToken := flag.String("enroll", "", "Código de enrollment gerado no painel para vincular o agente")
	apiUrl := flag.String("api", "", "Endereço da API Ublock (ex: https://api.ublock.local/api/v1)")
	versionFlag := flag.Bool("version", false, "Exibe a versão do agente")
	_ = flag.Bool("service", false, "Flag interna usada pelo Gerenciador de Serviços do Windows")

	flag.Parse()

	if *versionFlag {
		fmt.Printf("NEXUS IT Asset Agent v%s (Windows x64)\n", config.DefaultVersion)
		return
	}

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Erro ao carregar configurações: %v\n", err)
		os.Exit(1)
	}

	if *apiUrl != "" {
		cfg.ApiUrl = *apiUrl
	}

	// Initialize Logger
	if err := logger.Init(cfg.LogFile); err != nil {
		fmt.Fprintf(os.Stderr, "Aviso: falha ao inicializar arquivo de log (%v); usando console.\n", err)
	}
	defer logger.Close()

	// 1. Service Management operations
	if *installFlag {
		fmt.Println("Instalando NEXUS Asset Agent como Serviço do Windows...")
		if err := service.InstallService(); err != nil {
			fmt.Fprintf(os.Stderr, "Falha na instalação do serviço: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Serviço instalado com sucesso! Tipo de inicialização: Automático.")
		return
	}

	if *uninstallFlag {
		fmt.Println("Removendo NEXUS Asset Agent do Windows...")
		if err := service.UninstallService(); err != nil {
			fmt.Fprintf(os.Stderr, "Falha na desinstalação: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Serviço desinstalado com sucesso.")
		return
	}

	if *startFlag {
		if err := service.StartService(); err != nil {
			fmt.Fprintf(os.Stderr, "Falha ao iniciar o serviço: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Serviço iniciado.")
		return
	}

	if *stopFlag {
		if err := service.StopService(); err != nil {
			fmt.Fprintf(os.Stderr, "Falha ao parar o serviço: %v\n", err)
			os.Exit(1)
		}
		fmt.Println("Serviço finalizado.")
		return
	}

	// 2. Enrollment operation
	if *enrollToken != "" {
		fmt.Printf("Iniciando enrollment com o servidor: %s...\n", cfg.ApiUrl)

		info, err := collector.CollectFullInventory()
		if err != nil {
			fmt.Fprintf(os.Stderr, "Falha ao coletar dados locais: %v\n", err)
			os.Exit(1)
		}

		// Ensure unique agent UUID exists
		if cfg.AgentUuid == "" {
			cfg.AgentUuid = fmt.Sprintf("%s-%d", info.Hostname, os.Getpid())
		}

		c := client.New(cfg)
		resp, err := c.Enroll(*enrollToken, info)
		if err != nil {
			fmt.Fprintf(os.Stderr, "ERRO NO ENROLLMENT: %v\n", err)
			os.Exit(1)
		}

		// Save issued credentials
		cfg.AgentKey = resp.AgentKey
		cfg.HeartbeatIntervalSec = resp.HeartbeatIntervalSeconds
		cfg.InventoryIntervalSec = resp.InventoryIntervalSeconds
		if err := cfg.Save(); err != nil {
			fmt.Fprintf(os.Stderr, "Falha ao salvar credencial do agente: %v\n", err)
			os.Exit(1)
		}

		fmt.Println("=====================================================")
		fmt.Println("  ENROLLMENT CONCLUÍDO COM SUCESSO!")
		fmt.Printf("  Dispositivo ID:    %s\n", resp.DeviceId)
		fmt.Printf("  Organização ID:    %s\n", resp.OrganizationId)
		fmt.Printf("  Heartbeat:         a cada %ds\n", resp.HeartbeatIntervalSeconds)
		fmt.Println("  A credencial do agente foi gravada com segurança.")
		fmt.Println("=====================================================")
		return
	}

	// 3. Normal Service / Daemon Execution
	if !cfg.IsEnrolled() {
		logger.Warn("O agente ainda não foi registrado neste computador. Utilize 'nexus-agent.exe -enroll <token> -api <url>' antes de iniciar.")
		if *runFlag {
			fmt.Fprintf(os.Stderr, "Agente não registrado. Execute com -enroll <token> primeiro.\n")
			os.Exit(1)
		}
	}

	// Run as Windows Service or Console
	if err := service.RunService(cfg); err != nil {
		logger.Error("Execução finalizada com erro: %v", err)
		os.Exit(1)
	}
}
