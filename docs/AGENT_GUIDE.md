# NEXUS IT ASSET MANAGER — GUIA DO AGENTE WINDOWS (PARTE 3)

Este documento orienta a compilação, instalação, pareamento e validação do **Agente de Monitoramento Windows** do projeto **NEXUS IT ASSET MANAGER / Ublock**.

---

## 1. Princípios Arquiteturais e de Segurança

O agente foi projetado seguindo as melhores práticas corporativas de monitoramento e inventário:

- **Linguagem:** Go 1.21+ (binário compilado único, estático, sem dependências externas de runtime).
- **Execução:** Serviço do Windows de segundo plano (`NexusAgent`), iniciando automaticamente com o sistema antes do login do usuário.
- **Comunicação Unidirecional (Outbound HTTPS Only):** O agente **nunca abre portas de escuta ou sockets locais** no computador do colaborador. Todas as requisições são iniciadas pelo cliente em direção à API central (`POST /api/v1/agent/...`), funcionando perfeitamente atrás de NAT, roteadores domésticos e firewalls corporativos.
- **Autenticação Criptográfica Segura:**
  - **Pareamento por Token de Uso Único (Single-Use):** Gerado pelo administrador no painel web com tempo de expiração configurável (1h a 7 dias).
  - **Armazenamento com Hash (SHA-256):** O servidor armazena apenas o hash criptográfico do token e da chave do agente (`agent_key`), impedindo vazamento de credenciais em caso de inspeção direta do banco.
  - **Revogação Imediata:** Um clique no painel revoga a chave do agente, rejeitando qualquer heartbeat subsequente com código `403 Forbidden`.
- **Privacidade & Limites Operacionais:**
  - O agente nesta fase é **estritamente para inventário e telemetria de hardware**.
  - **Não executa** comandos arbitrários, shells remotos, exclusão de arquivos ou bloqueios reais do sistema operacional.
  - **Não coleta** histórico de navegação, senhas, cookies, teclas digitadas ou arquivos pessoais.

---

## 2. Estrutura de Diretórios no Windows

| Caminho | Finalidade |
|---|---|
| `C:\Program Files\NexusAgent\nexus-agent.exe` | Binário executável do agente |
| `C:\Program Files\NexusAgent\scripts\` | Scripts PowerShell de automação (`install-service.ps1`, `uninstall-service.ps1`) |
| `%ProgramData%\NexusAgent\config.json` | Arquivo de configuração persistente (API URL, UUID do agente, credencial autenticada criptografada) |
| `%ProgramData%\NexusAgent\agent.log` | Arquivo de log rotativo estruturado com registros de coleta e comunicação |

---

## 3. Instruções de Compilação

Para compilar o binário Windows de 64 bits (`nexus-agent.exe`):

### Compilando no Windows (PowerShell):
```powershell
cd ublock\agent

# Definir variáveis de arquitetura (se necessário)
$env:GOOS = "windows"
$env:GOARCH = "amd64"

# Compilar binário otimizado sem símbolos de debug (-s -w reduz o tamanho)
go build -ldflags="-s -w" -o nexus-agent.exe ./cmd/agent
```

### Compilando via Linux / macOS (Cross-Compilation):
```bash
cd ublock/agent
GOOS=windows GOARCH=amd64 go build -ldflags="-s -w" -o nexus-agent.exe ./cmd/agent
```

---

## 4. Guia de Instalação e Pareamento

### Método 1: Script Automatizado PowerShell (Recomendado)

1. No painel web administrativo ([http://localhost:3000](http://localhost:3000)), acesse **Inventário**, clique sobre o computador desejado e selecione **"Instalar / Parear Agente"**.
2. Copie o **Código de Pareamento (Token)** gerado (ex: `ublock_enr_...`).
3. Abra um terminal **PowerShell como Administrador** no computador Windows e execute:
```powershell
cd "caminho\ublock\agent\scripts"

.\install-service.ps1 -Token "ublock_enr_SEU_TOKEN_AQUI" -ApiUrl "http://localhost:8000/api/v1"
```

O script realizará automaticamente:
- Verificação de elevação de privilégios.
- Cópia do binário para `C:\Program Files\NexusAgent\`.
- Chamada de registro (`-enroll`) junto à API.
- Registro do serviço Windows `NexusAgent`.
- Configuração de recuperação de falhas no SCM.
- Início imediato do serviço.

---

### Método 2: Instalação Manual Passo a Passo via Linha de Comando

```powershell
# 1. Parear com o servidor (registra e salva a chave em %ProgramData%\NexusAgent\config.json):
.\nexus-agent.exe -enroll "ublock_enr_SEU_TOKEN" -api "http://localhost:8000/api/v1"

# 2. Registrar o serviço no Windows:
.\nexus-agent.exe -install

# 3. Iniciar o serviço:
.\nexus-agent.exe -start

# 4. Verificar se o serviço está em execução:
Get-Service NexusAgent
```

---

## 5. Roteiro de Validação dos 8 Itens Obrigatórios

Abaixo encontra-se a demonstração passo a passo de conformidade com todos os 8 requisitos da especificação:

### Item 1: O agente compila para Windows x64
- **Validação:**
  ```powershell
  cd ublock\agent
  go build -o nexus-agent.exe ./cmd/agent
  ```
- **Resultado:** É gerado o arquivo `nexus-agent.exe` de 64 bits para Windows (`PE32+ executable for MS Windows (console) x86-64`).

---

### Item 2: O serviço instala e inicia corretamente no Windows
- **Validação:**
  ```powershell
  # Executar como Administrador:
  .\nexus-agent.exe -install
  Start-Service NexusAgent
  Get-Service NexusAgent
  ```
- **Resultado Esperado:** O status retornado é `Running` e o tipo de inicialização é `Automatic`.
- **Inspeção de Log:** Em `%ProgramData%\NexusAgent\agent.log`, constará:
  ```json
  {"time":"...","level":"INFO","msg":"Iniciando Nexus Agent como servico do Windows..."}
  ```

---

### Item 3: O agente registra-se usando um código temporário válido
- **Validação:**
  - Gere um token no painel ou via API:
    ```bash
    POST /api/v1/devices/{device_id}/enrollment-token
    {"expires_in_hours": 24}
    ```
  - Execute no cliente Windows:
    ```powershell
    .\nexus-agent.exe -enroll "ublock_enr_..." -api "http://localhost:8000/api/v1"
    ```
- **Resultado Esperado:**
  - O terminal exibe: `[SUCESSO] Agente registrado com sucesso! Agent UUID: ...`.
  - O arquivo `%ProgramData%\NexusAgent\config.json` é gravado com a chave `agent_key` e `device_id`.
  - A API responde com HTTP `200 OK` e registra na auditoria o evento `AGENT_ENROLLED`.

---

### Item 4: O servidor rejeita um código expirado ou já utilizado
- **Validação:**
  - Tente reutilizar o mesmo token anterior:
    ```powershell
    .\nexus-agent.exe -enroll "ublock_enr_MESMO_TOKEN" -api "http://localhost:8000/api/v1"
    ```
- **Resultado Esperado:**
  - A requisição é rejeitada com código HTTP `400 Bad Request`.
  - Mensagem de erro: `"Código de registro inválido, expirado ou já utilizado."`
  - A tentativa é auditada com `outcome: "REJECTED_TOKEN"`.

---

### Item 5: O painel exibe o heartbeat recebido do computador de teste
- **Validação:**
  - Com o serviço `NexusAgent` rodando, a cada 60 segundos ele envia um heartbeat para a API (`POST /api/v1/agent/heartbeat`).
  - No Painel Web, abra o computador em **Inventário**.
- **Resultado Esperado:**
  - O badge exibe **"Agente Online (Real)"**.
  - O campo **"Último Heartbeat"** é atualizado continuamente.
  - A aba **"Agente & Hardware Real"** exibe modelo da CPU, núcleos, memória RAM física total/livre, espaço em disco de cada unidade (C:\) e interfaces de rede reais coletadas pelo agente.

---

### Item 6: Ao interromper a comunicação, o equipamento muda de status
- **Validação:**
  - Pare o serviço no Windows:
    ```powershell
    Stop-Service NexusAgent
    ```
  - Aguarde o tempo limite (`ONLINE_THRESHOLD_MINUTES = 15 minutos` ou configure para 2 minutos durante testes).
- **Resultado Esperado:**
  - O backend calcula dinamicamente o status: `device.status` passa de `ONLINE` para `OFFLINE`.
  - O badge no painel web atualiza para **"Agente Offline"** e **"OFFLINE"**.
  - No Dashboard principal, o computador entra na contagem de offline e na lista de atenção caso ultrapasse o limite.

---

### Item 7: Ao restabelecer a comunicação, o agente volta a enviar dados
- **Validação:**
  - Reinicie o serviço:
    ```powershell
    Start-Service NexusAgent
    ```
- **Resultado Esperado:**
  - O heartbeat é enviado imediatamente no início da rotina.
  - O campo `last_seen_at` e `last_heartbeat_at` são atualizados no banco de dados.
  - O status no painel web volta instantaneamente para **"ONLINE"** e **"Agente Online (Real)"**.

---

### Item 8: A revogação impede novas requisições autenticadas daquele agente
- **Validação:**
  - No painel web, na página de detalhes do computador, clique no botão **"Revogar Agente"** e confirme a operação.
  - Ou execute via API:
    ```bash
    POST /api/v1/devices/{device_id}/agent/revoke
    ```
  - Observe a próxima tentativa de heartbeat do agente no arquivo `%ProgramData%\NexusAgent\agent.log`.
- **Resultado Esperado:**
  - A API retorna HTTP `403 Forbidden` com a mensagem: `"Este agente teve seu acesso revogado pela administração."`
  - O agente registra no log: `Falha ao enviar heartbeat: HTTP 403`.
  - O badge do computador no painel web passa para **"Agente Revogado"**.
  - A revogação fica registrada de forma indelével na tabela de Auditoria com autor, data e hora.

---

## 6. Comandos da Linha de Comando do Agente

| Parâmetro | Descrição |
|---|---|
| `-enroll <token>` | Pareia o agente com o servidor central usando o token de uso único |
| `-api <url>` | Define a URL da API central (padrão: `http://localhost:8000/api/v1`) |
| `-install` | Instala o executável como serviço do Windows (`NexusAgent`) |
| `-uninstall` | Remove o serviço do Windows |
| `-start` | Inicia o serviço instalado |
| `-stop` | Para o serviço instalado |
| `-run` | Executa o agente interativamente no console (ideal para depuração) |
| `-version` | Exibe a versão compilada do agente |

---

## 7. Desinstalação Completa

Para remover completamente o agente da máquina de teste:
```powershell
cd ublock\agent\scripts
.\uninstall-service.ps1
```
