; Script de Criação de Instalador Inno Setup para o NEXUS IT ASSET MANAGER / Ublock Windows Agent
; Compatível com Inno Setup 6.x

#define MyAppName "NEXUS IT Asset Manager Agent"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Ublock Inc."
#define MyAppURL "https://github.com/ublock"
#define MyAppExeName "nexus-agent.exe"

[Setup]
AppId={{D37F8A19-92B1-4DE1-9876-857A1C98B75B}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\NexusAgent
DisableDirPage=yes
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputBaseFilename=nexus-agent-setup-x64
Compression=lzma2/ultra64
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
PrivilegesRequired=admin
WizardStyle=modern

[Languages]
Name: "brazilianportuguese"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Files]
Source: "..\nexus-agent.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\scripts\install-service.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion
Source: "..\scripts\uninstall-service.ps1"; DestDir: "{app}\scripts"; Flags: ignoreversion

[Run]
; Registra o servico do Windows silenciosamente apos a extracao dos arquivos
Filename: "{app}\{#MyAppExeName}"; Parameters: "-install"; Flags: runhidden waituntilterminated

; Inicia o servico instalado
Filename: "{app}\{#MyAppExeName}"; Parameters: "-start"; Flags: runhidden waituntilterminated

[UninstallRun]
; Para e desregistra o servico antes de remover arquivos
Filename: "{app}\{#MyAppExeName}"; Parameters: "-stop"; Flags: runhidden waituntilterminated
Filename: "{app}\{#MyAppExeName}"; Parameters: "-uninstall"; Flags: runhidden waituntilterminated

[UninstallDelete]
Type: filesandordirs; Name: "{commonappdata}\NexusAgent"

[Code]
var
  ConfigPage: TInputQueryWizardPage;
  ApiUrl: String;
  Token: String;

procedure InitializeWizard;
begin
  // Adiciona tela interativa de configuracao da API e Token de Pareamento
  ConfigPage := CreateInputQueryPage(wpSelectDir,
    'Configuração do Servidor e Pareamento',
    'Conecte o agente ao painel administrativo NEXUS / Ublock',
    'Informe a URL do servidor e opcionalmente o código de pareamento único gerado no painel.');

  ConfigPage.Add('URL da API Central (ex: https://ublock.empresa.com.br/api/v1):', False);
  ConfigPage.Add('Código de Pareamento (Token Temporário - Opcional):', False);

  ConfigPage.Values[0] := 'http://localhost:8000/api/v1';
  ConfigPage.Values[1] := '';
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ResultCode: Integer;
  EnrollParams: String;
begin
  if CurStep = ssPostInstall then
  begin
    ApiUrl := Trim(ConfigPage.Values[0]);
    Token := Trim(ConfigPage.Values[1]);

    if Token <> '' then
    begin
      EnrollParams := Format('-enroll "%s" -api "%s"', [Token, ApiUrl]);
      Exec(ExpandConstant('{app}\{#MyAppExeName}'), EnrollParams, '', SW_HIDE, ewWaitUntilTerminated, ResultCode);
    end;
  end;
end;
