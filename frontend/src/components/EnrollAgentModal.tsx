import React, { useState } from 'react';
import { Device, EnrollmentTokenResponse } from '../types';
import { api } from '../services/api';
import { X, Copy, Check, ShieldCheck, Terminal, AlertTriangle, KeyRound } from 'lucide-react';

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

  const apiUrl = (import.meta.env.VITE_API_BASE_URL || `http://${window.location.hostname}:8000/api/v1`).replace(/\/$/, '');
  const cliCommand = tokenData ? `nexus-agent.exe -enroll ${tokenData.enrollment_token} -api ${apiUrl}` : '';
  const psCommand = tokenData ? `.\\scripts\\install-service.ps1 -Token "${tokenData.enrollment_token}" -ApiUrl "${apiUrl}"` : '';

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
              {isBulk ? 'Pareamento Automático em Lote (Auto-Discovery)' : 'Instalação do Agente de Monitoramento'}
            </h3>
            <p className="text-xs text-slate-400">
              {isBulk
                ? 'Cadastre 10, 50 ou 100 máquinas automaticamente com o mesmo código corporativo!'
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
                  : 'O código de pareamento autoriza o binário nexus-agent.exe a se registrar nesta organização e associar as métricas deste computador.'}
              </p>
              <ul className="list-disc list-inside text-slate-400 space-y-1">
                {isBulk ? (
                  <>
                    <li>Auto-Discovery: o computador cria seu próprio registro no inventário com nome, IP e dados reais.</li>
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
              <span>Código temporário gerado com sucesso! Válido até {new Date(tokenData.expires_at).toLocaleString('pt-BR')}.</span>
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

            {/* PowerShell / CLI Command */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                <Terminal className="w-3.5 h-3.5 text-blue-400" />
                Comando Automático (PowerShell Administrador)
              </label>
              <div className="relative">
                <pre className="bg-[#0B1120] border border-[#24334C] rounded-lg p-3 text-[11px] font-mono text-slate-300 overflow-x-auto whitespace-pre-wrap break-all">
                  {psCommand}
                </pre>
                <button
                  onClick={() => copyToClipboard(psCommand, false)}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded bg-[#151F32] border border-[#24334C] hover:bg-[#1f2d45] text-slate-300 hover:text-white text-[11px] font-medium flex items-center gap-1 transition"
                >
                  {copiedCommand ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  {copiedCommand ? 'Copiado' : 'Copiar'}
                </button>
              </div>
            </div>

            {/* Direct CLI */}
            <div>
              <label className="block text-[11px] text-slate-400 mb-1">
                Ou registre diretamente pelo executável:
              </label>
              <pre className="bg-[#0B1120] border border-[#24334C] rounded-lg p-2.5 text-[11px] font-mono text-slate-400 overflow-x-auto select-all">
                {cliCommand}
              </pre>
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
