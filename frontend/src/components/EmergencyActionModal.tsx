import React, { useState } from 'react';
import { Device, ActionType, DeviceAccount } from '../types';
import { Modal } from './Modal';
import { AlertTriangle, ShieldAlert, Lock, UserX, WifiOff, CheckCircle, KeyRound, RotateCcw, Copy, Check } from 'lucide-react';

interface EmergencyActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: Device;
  accounts: DeviceAccount[];
  onSubmit: (data: {
    action_type: ActionType;
    target_account_id?: string;
    reason: string;
    new_password?: string;
  }) => Promise<void>;
}

const generateRandomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let rand = '';
  for (let i = 0; i < 4; i++) {
    rand += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `Ubk@${rand}!2026`;
};

export const EmergencyActionModal: React.FC<EmergencyActionModalProps> = ({
  isOpen,
  onClose,
  device,
  accounts,
  onSubmit,
}) => {
  const [selectedAction, setSelectedAction] = useState<ActionType>('RESET_PASSWORD_AND_LOGOFF');
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [reason, setReason] = useState<string>('Offboarding / Desligamento de colaborador - Bloqueio de credenciais e encerramento de sessão');
  const [newPassword, setNewPassword] = useState<string>(() => generateRandomPassword());
  const [copiedPassword, setCopiedPassword] = useState(false);
  const [confirmInput, setConfirmInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isHighImpact = selectedAction === 'RESET_PASSWORD_AND_LOGOFF';

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError('Por favor, informe a justificativa de segurança.');
      return;
    }

    if (isHighImpact && confirmInput.trim() !== 'CONFIRMAR') {
      setError('Para acionar esta ação crítica de segurança, digite CONFIRMAR no campo de confirmação.');
      return;
    }

    if (selectedAction === 'RESET_PASSWORD_AND_LOGOFF' && !newPassword.trim()) {
      setError('A nova senha não pode estar em branco.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        action_type: selectedAction,
        target_account_id: targetAccountId || undefined,
        reason: reason.trim(),
        new_password: selectedAction === 'RESET_PASSWORD_AND_LOGOFF' ? newPassword.trim() : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar a ação de contenção.');
    } finally {
      setLoading(false);
    }
  };

  const copyPasswordToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(newPassword);
      setCopiedPassword(true);
      setTimeout(() => setCopiedPassword(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Controle de Acesso & Ações de Bloqueio" maxWidth="max-w-2xl">
      <form onSubmit={handleExecute} className="space-y-5">
        {/* Safe Simulation / Real Execution Banner */}
        <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-400" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-blue-200">
              DISPARO DIRETO AO AGENTE CLIENTE
            </p>
            <p className="text-blue-300/90 leading-relaxed">
              O comando será enfileirado e executado pelo agente local no computador <strong>{device.hostname}</strong> no próximo ciclo de comunicação (em menos de 15 segundos). Todas as ações são auditadas de forma imutável.
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Dispositivo Selecionado
          </label>
          <div className="p-3 bg-[#0B1120] border border-[#24334C] rounded-lg text-sm text-slate-200 flex justify-between items-center">
            <div>
              <span className="font-semibold text-white">{device.display_name}</span> ({device.hostname})
            </div>
            <span className="text-xs text-slate-400">IP: {device.local_ip || 'N/A'}</span>
          </div>
        </div>

        {/* Action Type Selection */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Selecione o Tipo de Ação
          </label>
          <div className="grid grid-cols-1 gap-2.5">
            {/* Alterar Senha e Deslogar (Offboarding) */}
            <button
              type="button"
              onClick={() => setSelectedAction('RESET_PASSWORD_AND_LOGOFF')}
              className={`p-3 rounded-lg border text-left flex items-start gap-3 transition ${
                selectedAction === 'RESET_PASSWORD_AND_LOGOFF'
                  ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500'
                  : 'border-[#24334C] bg-[#0B1120] text-slate-300 hover:border-slate-600'
              }`}
            >
              <KeyRound className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-amber-300">Alterar Senha e Deslogar</p>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">Recomendado TI</span>
                </div>
              </div>
            </button>

            {/* Encerrar Sessão Ativa */}
            <button
              type="button"
              onClick={() => setSelectedAction('END_USER_SESSION')}
              className={`p-3 rounded-lg border text-left flex items-start gap-3 transition ${
                selectedAction === 'END_USER_SESSION'
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-[#24334C] bg-[#0B1120] text-slate-300 hover:border-slate-600'
              }`}
            >
              <UserX className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Encerrar Sessão Ativa</p>
                <p className="text-xs text-slate-400">Força logoff imediato sem alterar a senha.</p>
              </div>
            </button>

            {/* Reativar Conta Local */}
            <button
              type="button"
              onClick={() => setSelectedAction('REACTIVATE_LOCAL_ACCOUNT')}
              className={`p-3 rounded-lg border text-left flex items-start gap-3 transition ${
                selectedAction === 'REACTIVATE_LOCAL_ACCOUNT'
                  ? 'border-emerald-500 bg-emerald-500/10 text-white'
                  : 'border-[#24334C] bg-[#0B1120] text-slate-300 hover:border-slate-600'
              }`}
            >
              <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Reativar Conta Local</p>
                <p className="text-xs text-slate-400">Reabilita o login local do usuário no endpoint.</p>
              </div>
            </button>
          </div>
        </div>

        {/* Bloco de Configuração de Senha para Offboarding */}
        {selectedAction === 'RESET_PASSWORD_AND_LOGOFF' && (
          <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <KeyRound className="w-4 h-4" />
                Nova Senha Temporária (Para acesso da TI)
              </label>
              <button
                type="button"
                onClick={() => setNewPassword(generateRandomPassword())}
                className="text-[11px] text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition"
              >
                <RotateCcw className="w-3 h-3" />
                Gerar Outra Senha
              </button>
            </div>
            
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#0B1120] border border-amber-500/40 rounded-lg px-3.5 py-2 text-xs font-mono font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                placeholder="Ex.: Ubk@9X2A!2026"
                required
              />
              <button
                type="button"
                onClick={copyPasswordToClipboard}
                className="px-3 py-2 rounded-lg bg-[#0B1120] border border-amber-500/40 hover:bg-amber-500/20 text-amber-300 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition"
              >
                {copiedPassword ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedPassword ? 'Copiada' : 'Copiar'}
              </button>
            </div>
          </div>
        )}

        {/* Reason / Justification */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Motivo / Justificativa da Ação (Obrigatório)
          </label>
          <textarea
            required
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: Desligamento de colaborador / Procedimento de segurança da informação."
            className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Double confirmation for High Impact actions */}
        {isHighImpact && (
          <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/5 space-y-2">
            <p className="text-xs text-rose-300 font-medium">
              Atenção: Ação crítica de contenção. Para confirmar e disparar a ordem imediatamente, digite <strong>CONFIRMAR</strong>:
            </p>
            <input
              type="text"
              value={confirmInput}
              onChange={(e) => setConfirmInput(e.target.value)}
              placeholder="Digite CONFIRMAR"
              className="w-full bg-[#0B1120] border border-rose-500/40 rounded-lg px-3 py-2 text-sm text-rose-200 placeholder-slate-600 focus:outline-none focus:border-rose-400"
            />
          </div>
        )}

        {error && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#24334C]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={loading}
            className={`px-5 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition ${
              isHighImpact
                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {loading ? 'Disparando...' : selectedAction === 'RESET_PASSWORD_AND_LOGOFF' ? 'Alterar Senha e Deslogar Agora' : 'Enviar Comando ao Computador'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
