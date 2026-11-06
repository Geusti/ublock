import React, { useState } from 'react';
import { Device, EnrollmentTokenResponse } from '../types';
import { api } from '../services/api';
import { X, Copy, Check, ShieldCheck, Terminal, AlertTriangle, KeyRound, Monitor, Apple } from 'lucide-react';

interface EnrollAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  device?: Device | null;
  isBulk?: boolean;
  onEnrolled?: () => void;
}

export const EnrollAgentModal: React.FC<EnrollAgentModalProps> = ({
  isOpen,
  onClose,
  device,
  isBulk = false,
  onEnrolled,
}) => {
  const [hours, setHours] = useState(isBulk ? 168 : 24);
  const [tokenData, setTokenData] = useState<EnrollmentTokenResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const [activeOsTab, setActiveOsTab] = useState<'WINDOWS' | 'LINUX' | 'MACOS'>('WINDOWS');

  if (!isOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = isBulk || !device
        ? await api.generateBulkEnrollmentToken(hours)
        : await api.generateEnrollmentToken(device.id, hours);
      setTokenData(res);
      if (onEnrolled) onEnrolled();
    } catch (err: any) {
      setError(err.message || 'Erro ao gerar código de instalação.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, isToken: boolean) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isToken) {
        setCopiedToken(true);
        setTimeout(() => setCopiedToken(false), 2000);
      } else {
        setCopiedCommand(true);
        setTimeout(() => setCopiedCommand(false), 2000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const apiUrl = (import.meta.env.VITE_API_BASE_URL || `https://ublock-api-fn7d.onrender.com/api/v1`).replace(/\/$/, '');
  const tokenStr = tokenData?.enrollment_token || '';

  const getCommandLine = () => {
    switch (activeOsTab) {
      case 'WINDOWS':
        return `.\\ublock-agent.exe -token "${tokenStr}" -api "${apiUrl}"`;
      case 'LINUX':
        return `sudo bash instalar-agente-linux.sh "${tokenStr}"`;
      case 'MACOS':
        return `sudo bash instalar-agente-macos.sh "${tokenStr}"`;
      default:
        return '';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
      <div className="bg-[#151F32] border border-[#24334C] rounded-2xl max-w-xl w-full p-6 text-slate-200 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-slate-400 hover:text-white transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400">
            <KeyRound className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white tracking-tight">
              {isBulk ? 'Pareamento Automático em Lote (Cross-Platform)' : 'Instalação do Agente de Monitoramento'}
            </h3>
            <p className="text-xs text-slate-400">
              {isBulk
                ? 'Cadastre máquinas Windows, Linux (Ubuntu) e macOS automaticamente com o mesmo código corporativo!'
                : `Pareamento seguro de ${device?.display_name || 'Dispositivo'} (${device?.hostname || 'N/A'})`}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {!tokenData ? (
          <div className="space-y-4">
            <div className="bg-[#0B1120] border border-[#24334C] p-4 rounded-xl text-xs space-y-2">
              <p className="text-slate-300 font-medium">
                {isBulk
                  ? 'Este código de organização permite instalar o agente em dezenas de computadores simultaneamente sem precisar cadastrá-los antes na interface.'
                  : 'O código de pareamento autoriza o agente a se registrar nesta organização e associar as métricas deste computador.'}
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                {isBulk ? (
                  <>
                    <li>Multiplataforma: Compatível com Windows (.bat), Linux/Ubuntu (.sh) e macOS (.sh).</li>
                    <li>Auto-Discovery: o computador cria seu próprio registro no inventário com especificações reais de hardware.</li>
                    <li>Reutilizável: use o mesmo código em todas as máquinas da empresa.</li>
                    <li>Expiração automática por tempo limite com Hash criptográfico SHA-256.</li>
                  </>
                ) : (
                  <>
                    <li>Uso único (Single-Use): inutilizado imediatamente após o registro.</li>
                    <li>Armazenamento com Hash criptográfico (SHA-256) no servidor.</li>
                    <li>Expiração automática por tempo limite.</li>
                  </>
                )}
              </ul>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Tempo de validade do código
              </label>
              <select
                value={hours}
                onChange={(e) => setHours(Number(e.target.value))}
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value={1}>1 hora (Imediato)</option>
                <option value={6}>6 horas</option>
                <option value={24}>24 horas (Recomendado)</option>
                <option value={72}>3 dias</option>
                <option value={168}>7 dias</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-3">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[#0B1120] border border-[#24334C] text-xs font-semibold text-slate-300 hover:text-white transition"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={loading}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-xs font-semibold text-white shadow-lg shadow-blue-600/25 transition flex items-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                {loading ? 'Gerando...' : 'Gerar Código de Pareamento'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 text-xs">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Código corporativo gerado com sucesso! Válido até {new Date(tokenData.expires_at).toLocaleString('pt-BR')}.</span>
            </div>

            {/* Token display */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 uppercase tracking-wider">
                Código de Registro (Token)
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={tokenData.enrollment_token}
                  className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 select-all focus:outline-none"
                />
                <button
                  onClick={() => copyToClipboard(tokenData.enrollment_token, true)}
                  className="px-3 py-2 rounded-lg bg-[#0B1120] border border-[#24334C] hover:bg-[#1a263e] text-slate-300 hover:text-white transition flex items-center gap-1.5 text-xs shrink-0"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedToken ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Sistema Operacional Tabs */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wider">
                Selecione o Sistema Operacional Alvo:
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveOsTab('WINDOWS')}
                  className={`p-2 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition border ${
                    activeOsTab === 'WINDOWS'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-[#0B1120] border-[#24334C] text-slate-400 hover:text-white'
                  }`}
                >
                  <Monitor className="w-4 h-4 text-blue-400" />
                  <span>Windows (.bat)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveOsTab('LINUX')}
                  className={`p-2 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition border ${
                    activeOsTab === 'LINUX'
                      ? 'bg-amber-600/20 border-amber-500 text-amber-300'
                      : 'bg-[#0B1120] border-[#24334C] text-slate-400 hover:text-white'
                  }`}
                >
                  <Terminal className="w-4 h-4 text-amber-400" />
                  <span>Linux / Ubuntu (.sh)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveOsTab('MACOS')}
                  className={`p-2 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition border ${
                    activeOsTab === 'MACOS'
                      ? 'bg-purple-600/20 border-purple-500 text-purple-300'
                      : 'bg-[#0B1120] border-[#24334C] text-slate-400 hover:text-white'
                  }`}
                >
                  <Apple className="w-4 h-4 text-slate-200" />
                  <span>macOS (.sh)</span>
                </button>
              </div>
            </div>

            {/* Instruções de Instalação Conforme SO */}
            <div className="bg-[#0B1120] border border-[#24334C] rounded-xl p-3.5 space-y-2 text-xs">
              <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Como instalar no {activeOsTab === 'WINDOWS' ? 'Windows' : activeOsTab === 'LINUX' ? 'Linux (Ubuntu / Debian)' : 'macOS'}:</span>
              </div>

              {activeOsTab === 'WINDOWS' && (
                <ol className="list-decimal list-inside text-slate-300 space-y-1.5 pl-1 text-[11px]">
                  <li>Abra a pasta do Ublock no computador Windows.</li>
                  <li>Clique com o botão direito em <strong className="text-white bg-slate-800 px-1.5 py-0.5 rounded font-mono">instalar-agente-24h.bat</strong> e selecione <em>Executar como Administrador</em>.</li>
                  <li>Cole o código acima quando solicitado e pressione <kbd className="px-1.5 py-0.5 rounded bg-slate-700 text-white font-mono text-[10px]">Enter</kbd>.</li>
                  <li>O agente roda invisível 24h em segundo plano e a máquina surge online no painel!</li>
                </ol>
              )}

              {activeOsTab === 'LINUX' && (
                <ol className="list-decimal list-inside text-slate-300 space-y-1.5 pl-1 text-[11px]">
                  <li>Abra o terminal no Ubuntu / Linux.</li>
                  <li>Navegue até a pasta do projeto Ublock e execute:</li>
                  <div className="my-1 font-mono text-[11px] text-amber-300 bg-black/40 p-1.5 rounded border border-amber-500/20">
                    sudo bash instalar-agente-linux.sh "{tokenStr}"
                  </div>
                  <li>O serviço será ativado 24h no <code className="text-amber-200">systemd</code> com reinício automático no boot!</li>
                </ol>
              )}

              {activeOsTab === 'MACOS' && (
                <ol className="list-decimal list-inside text-slate-300 space-y-1.5 pl-1 text-[11px]">
                  <li>Abra o Terminal no Mac.</li>
                  <li>Navegue até a pasta do projeto Ublock e execute com privilégios de root:</li>
                  <div className="my-1 font-mono text-[11px] text-purple-300 bg-black/40 p-1.5 rounded border border-purple-500/20">
                    sudo bash instalar-agente-macos.sh "{tokenStr}"
                  </div>
                  <li>O agente é registrado como <code className="text-purple-200">LaunchDaemon</code> do macOS para execução contínua!</li>
                </ol>
              )}
            </div>

            {/* Direct CLI */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Comando pronto para colar no terminal:
              </label>
              <div className="relative">
                <pre className="bg-[#0B1120] border border-[#24334C] rounded-lg p-2.5 text-[11px] font-mono text-slate-300 overflow-x-auto select-all">
                  {getCommandLine()}
                </pre>
                <button
                  onClick={() => copyToClipboard(getCommandLine(), false)}
                  className="absolute top-1.5 right-1.5 px-2 py-1 rounded bg-[#151F32] border border-[#24334C] hover:bg-[#1f2d45] text-slate-300 hover:text-white text-[10px] font-medium flex items-center gap-1 transition"
                >
                  {copiedCommand ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedCommand ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={onClose}
                className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white transition"
              >
                Concluir & Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
