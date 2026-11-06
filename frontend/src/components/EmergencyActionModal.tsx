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

  const isHighImpact = selectedAction === 'EMERGENCY_LOCKDOWN' || selectedAction === 'RESET_PASSWORD_AND_LOGOFF';
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {/* NOVO: Alterar Senha e Deslogar (Offboarding) */}
            <button
              type="button"
              onClick={() => setSelectedAction('RESET_PASSWORD_AND_LOGOFF')}
              className={`p-3 rounded-lg border text-left flex items-start gap-3 transition col-span-1 md:col-span-2 ${
                selectedAction === 'RESET_PASSWORD_AND_LOGOFF'
                  ? 'border-amber-500 bg-amber-500/10 text-white ring-1 ring-amber-500'
                  : 'border-[#24334C] bg-[#0B1120] text-slate-300 hover:border-slate-600'
              }`}
            >
              <KeyRound className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-amber-300">Alterar Senha e Deslogar (Offboarding / Demissão)</p>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30">Recomendado TI</span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">Altera a senha do usuário local do Windows via <code className="text-amber-300/90 font-mono">net user %username%</code> e força logoff imediato. A senha fica salva no painel para que a equipe de TI possa efetuar login.</p>
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
                <p className="text-sm font-semibold text-rose-300">Bloquear Estação (Lockdown)</p>
                <p className="text-xs text-slate-400">Bloqueia a tela de imediato com LockWorkStation.</p>
              </div>
            </button>

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
                <p className="text-sm font-medium">Desativar Conta Local</p>
                <p className="text-xs text-slate-400">Desativa o login da conta (net user /active:no).</p>
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
                <p className="text-xs text-slate-400">Desativa adaptadores de rede físicos e Wi-Fi.</p>
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
                Nova Senha Temporária do Windows (Para acesso da TI)
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

            <div className="text-[11px] text-amber-200/90 leading-relaxed bg-[#0B1120]/70 p-3 rounded-lg border border-amber-500/20">
              <p>
                <strong>⚡ Procedimento Automatizado:</strong> O agente executará no Windows o comando:
              </p>
              <p className="font-mono text-amber-300 text-[10px] mt-1 bg-black/40 p-1.5 rounded">
                net user %username% {newPassword} &amp;&amp; shutdown.exe /l /f
              </p>
              <p className="mt-1.5 text-slate-300">
                O colaborador será desconectado no mesmo instante e não poderá mais entrar. A senha acima ficará gravada no banco de dados e visível na aba <strong>Fila de Comandos</strong> para que a equipe de TI utilize quando recuperar o equipamento.
              </p>
            </div>
          </div>
        )}

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
