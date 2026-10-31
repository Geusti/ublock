import React, { useState } from 'react';
import { Device, ActionType, DeviceAccount } from '../types';
import { Modal } from './Modal';
import { AlertTriangle, ShieldAlert, Lock, UserX, WifiOff, CheckCircle } from 'lucide-react';

interface EmergencyActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: Device;
  accounts: DeviceAccount[];
  onSubmit: (data: {
    action_type: ActionType;
    target_account_id?: string;
    reason: string;
  }) => Promise<void>;
}

export const EmergencyActionModal: React.FC<EmergencyActionModalProps> = ({
  isOpen,
  onClose,
  device,
  accounts,
  onSubmit,
}) => {
  const [selectedAction, setSelectedAction] = useState<ActionType>('END_USER_SESSION');
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [confirmInput, setConfirmInput] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLockdown = selectedAction === 'EMERGENCY_LOCKDOWN';
  const requiresAccount = selectedAction === 'SUSPEND_LOCAL_ACCOUNT' || selectedAction === 'REACTIVATE_LOCAL_ACCOUNT';

  const handleExecute = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reason.trim()) {
      setError('Por favor, informe a justificativa de segurança.');
      return;
    }

    if (requiresAccount && !targetAccountId && accounts.length > 0) {
      setError('Selecione a conta de usuário alvo da ação.');
      return;
    }

    if (isLockdown && confirmInput.trim() !== 'CONFIRMAR') {
      setError('Para acionar o Lockdown de Emergência, digite CONFIRMAR no campo abaixo.');
      return;
    }

    setLoading(true);
    try {
      await onSubmit({
        action_type: selectedAction,
        target_account_id: targetAccountId || undefined,
        reason: reason.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Falha ao registrar a ação simulada.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Controle de Acesso & Ações de Emergência" maxWidth="max-w-2xl">
      <form onSubmit={handleExecute} className="space-y-5">
        {/* Safe Simulation Disclaimer Banner */}
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5 text-amber-400" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-200">
              MODO DE SIMULAÇÃO ATIVO (FASE 1)
            </p>
            <p className="text-amber-300/90 leading-relaxed">
              Esta ação será gravada na fila de comandos como <strong>SIMULATION</strong> e devidamente registrada na trilha de auditoria. 
              <strong> Nenhum comando de sistema operacional ou alteração na rede física do computador {device.hostname} será executada.</strong>
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
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
                <p className="text-xs text-slate-400">Força logoff imediato de todos os usuários logados.</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedAction('SUSPEND_LOCAL_ACCOUNT')}
              className={`p-3 rounded-lg border text-left flex items-start gap-3 transition ${
                selectedAction === 'SUSPEND_LOCAL_ACCOUNT'
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-[#24334C] bg-[#0B1120] text-slate-300 hover:border-slate-600'
              }`}
            >
              <Lock className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Suspender Conta Local</p>
                <p className="text-xs text-slate-400">Desativa o login da conta especificada.</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedAction('ISOLATE_DEVICE_NETWORK')}
              className={`p-3 rounded-lg border text-left flex items-start gap-3 transition ${
                selectedAction === 'ISOLATE_DEVICE_NETWORK'
                  ? 'border-blue-500 bg-blue-500/10 text-white'
                  : 'border-[#24334C] bg-[#0B1120] text-slate-300 hover:border-slate-600'
              }`}
            >
              <WifiOff className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium">Isolar da Rede</p>
                <p className="text-xs text-slate-400">Derruba adaptadores de rede físicos e Wi-Fi.</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setSelectedAction('EMERGENCY_LOCKDOWN')}
              className={`p-3 rounded-lg border text-left flex items-start gap-3 transition ${
                selectedAction === 'EMERGENCY_LOCKDOWN'
                  ? 'border-rose-500 bg-rose-500/10 text-white ring-1 ring-rose-500'
                  : 'border-[#24334C] bg-[#0B1120] text-slate-300 hover:border-slate-600'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-rose-300">Lockdown de Emergência</p>
                <p className="text-xs text-slate-400">Ação combinada em cadeia: Bloqueio + Desconexão + Isolamento.</p>
              </div>
            </button>
          </div>
        </div>

        {/* Account select if required */}
        {requiresAccount && (
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
              Conta Local Alvo
            </label>
            <select
              value={targetAccountId}
              onChange={(e) => setTargetAccountId(e.target.value)}
              className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
            >
              <option value="">Selecione uma conta detectada...</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.username} ({acc.account_status}) {acc.is_demo ? '[DEMO]' : ''}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Reason / Justification */}
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">
            Motivo / Justificativa da Ação (Obrigatório)
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex.: Solicitação do departamento de segurança da informação após detecção de anomalia."
            className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Double confirmation for Lockdown */}
        {isLockdown && (
          <div className="p-3 rounded-lg border border-rose-500/40 bg-rose-500/5 space-y-2">
            <p className="text-xs text-rose-300 font-medium">
              Atenção: Ação de contenção severa. Para prosseguir, digite <strong>CONFIRMAR</strong> abaixo:
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
              isLockdown
                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                : 'bg-blue-600 hover:bg-blue-500 text-white'
            }`}
          >
            {loading ? 'Registrando...' : 'Registrar Ação Simulada'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
