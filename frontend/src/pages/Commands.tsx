import React, { useState, useEffect } from 'react';
import { Command } from '../types';
import { api } from '../services/api';
import { 
  Lock, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronLeft, 
  ChevronRight, 
  Info,
  Key,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  UserX,
  WifiOff
} from 'lucide-react';

export const Commands: React.FC = () => {
  const [commands, setCommands] = useState<Command[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterType, setFilterType] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchCommands = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      let apiStatusFilter: string | undefined = undefined;
      if (filterType === 'PENDING') apiStatusFilter = 'PENDING';
      else if (filterType === 'SUCCEEDED') apiStatusFilter = 'SUCCEEDED';
      else if (filterType === 'FAILED') apiStatusFilter = 'FAILED';

      const res = await api.getCommands({
        status: apiStatusFilter,
        page,
        page_size: 15,
      });

      let items = res.items;

      // In-memory filter for composite filters if needed
      if (filterType === 'OFFBOARDING') {
        items = items.filter(
          c => c.action_type === 'RESET_PASSWORD_AND_LOGOFF' || !!c.new_password || !!(c.parameters && c.parameters.new_password)
        );
      }

      setCommands(items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCommands();

    const timer = setInterval(() => {
      fetchCommands();
    }, 10000);
    return () => clearInterval(timer);
  }, [page, filterType]);

  const handleSimulateResult = async (commandId: string, succeeded: boolean) => {
    try {
      await api.simulateCommandResult(commandId, { succeeded });
      fetchCommands();
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar simulação.');
    }
  };

  const handleCopyPassword = async (cmdId: string, password?: string) => {
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      setCopiedId(cmdId);
      setTimeout(() => setCopiedId(null), 2500);
    } catch (e) {
      console.error(e);
    }
  };

  const getActionInfo = (actionType: string) => {
    switch (actionType) {
      case 'RESET_PASSWORD_AND_LOGOFF':
        return {
          title: 'Alterar Senha & Logoff',
          subtitle: 'Offboarding / Desligamento de Colaborador',
          badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: Key,
        };
      case 'LOCK_USER_SESSION':
        return {
          title: 'Bloqueio de Sessão',
          subtitle: 'Bloqueia a tela ativa do endpoint',
          badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
          icon: Lock,
        };
      case 'ISOLATE_NETWORK':
        return {
          title: 'Isolamento de Rede',
          subtitle: 'Corta conectividade IP local e externa',
          badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
          icon: WifiOff,
        };
      case 'SUSPEND_LOCAL_ACCOUNT':
        return {
          title: 'Suspender Conta Local',
          subtitle: 'Desativa a conta de login no Windows',
          badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: UserX,
        };
      case 'REACTIVATE_LOCAL_ACCOUNT':
        return {
          title: 'Reativar Conta Local',
          subtitle: 'Reabilita o acesso local ao endpoint',
          badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: CheckCircle2,
        };
      case 'EMERGENCY_LOCKDOWN':
        return {
          title: 'Lockdown de Emergência',
          subtitle: 'Bloqueio total do dispositivo e rede',
          badgeClass: 'bg-red-500/20 text-red-300 border-red-500/40',
          icon: ShieldAlert,
        };
      default:
        return {
          title: actionType,
          subtitle: 'Ordem de contenção',
          badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
          icon: Terminal,
        };
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SUCCEEDED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Executado no Agente
          </span>
        );
      case 'SUCCEEDED_SIMULATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            Sucesso (Simulado)
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Falha no Agente
          </span>
        );
      case 'FAILED_SIMULATED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/30">
            <XCircle className="w-3.5 h-3.5 text-rose-400" />
            Falha (Simulada)
          </span>
        );
      case 'EXECUTING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30 animate-pulse">
            <Clock className="w-3.5 h-3.5 text-blue-400 animate-spin" />
            Executando...
          </span>
        );
      case 'PENDING':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            Pendente
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-amber-400" />
            Fila de Comandos & Ações de Bloqueio
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Gerenciamento, auditoria e senhas de acesso para ações de contenção e offboarding de colaboradores
          </p>
        </div>
        <button
          onClick={() => fetchCommands(true)}
          disabled={refreshing}
          className="px-3.5 py-2 rounded-lg bg-[#151F32] hover:bg-[#1a263e] border border-[#24334C] text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-2 transition disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-amber-400' : ''}`} />
          <span>Atualizar Fila</span>
        </button>
      </div>

      {/* Offboarding & Security Notice */}
      <div className="p-4 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 flex items-start gap-3">
        <Key className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-300 space-y-1">
          <p className="font-semibold text-amber-200 flex items-center gap-2">
            <span>OFFBOARDING & CONTROLE DE SENHAS</span>
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] border border-amber-500/40 font-mono">
              MODO REAL ATIVO
            </span>
          </p>
          <p className="text-amber-300/80 leading-relaxed">
            Ordens de <strong className="text-amber-200">Alteração de Senha & Logoff</strong> são transmitidas em tempo real ao Agente Windows. 
            O agente identifica a conta do usuário ativo, executa o comando nativo <code className="bg-black/30 px-1 py-0.5 rounded font-mono text-amber-200">net user [usuario] [senha]</code> e desconecta a sessão imediatamente (<code className="bg-black/30 px-1 py-0.5 rounded font-mono text-amber-200">shutdown /l /f</code>).
            A nova senha de acesso é persistida com segurança nesta fila para que a equipe de TI possa efetuar login administrativo posteriormente.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => { setFilterType('ALL'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filterType === 'ALL'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-[#151F32] border border-[#24334C] text-slate-400 hover:text-white'
          }`}
        >
          Todos ({total})
        </button>
        <button
          onClick={() => { setFilterType('OFFBOARDING'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
            filterType === 'OFFBOARDING'
              ? 'bg-amber-600 text-white shadow-sm'
              : 'bg-[#151F32] border border-amber-500/30 text-amber-300 hover:text-white'
          }`}
        >
          <Key className="w-3.5 h-3.5" />
          Offboarding & Senhas TI
        </button>
        <button
          onClick={() => { setFilterType('PENDING'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filterType === 'PENDING'
              ? 'bg-amber-500 text-black font-semibold'
              : 'bg-[#151F32] border border-[#24334C] text-slate-400 hover:text-white'
          }`}
        >
          Pendentes
        </button>
        <button
          onClick={() => { setFilterType('SUCCEEDED'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filterType === 'SUCCEEDED'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'bg-[#151F32] border border-[#24334C] text-slate-400 hover:text-white'
          }`}
        >
          Concluídos com Sucesso
        </button>
        <button
          onClick={() => { setFilterType('FAILED'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            filterType === 'FAILED'
              ? 'bg-rose-600 text-white shadow-sm'
              : 'bg-[#151F32] border border-[#24334C] text-slate-400 hover:text-white'
          }`}
        >
          Falhas
        </button>
      </div>

      {/* Commands Table */}
      <div className="bg-[#151F32] border border-[#24334C] rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#0B1120] border-b border-[#24334C] text-slate-400 font-semibold uppercase tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Dispositivo</th>
                <th className="px-4 py-3.5">Ação Solicitada & Credenciais</th>
                <th className="px-4 py-3.5">Alvo</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Solicitante</th>
                <th className="px-4 py-3.5">Data / Hora</th>
                <th className="px-5 py-3.5 text-right">Resultado / Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#24334C] text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-amber-400" />
                      <span>Carregando fila de comandos...</span>
                    </div>
                  </td>
                </tr>
              ) : commands.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-slate-400">
                    Nenhuma ordem encontrada para os filtros selecionados.
                  </td>
                </tr>
              ) : (
                commands.map(cmd => {
                  const actionInfo = getActionInfo(cmd.action_type);
                  const Icon = actionInfo.icon;
                  const password = cmd.new_password || (cmd.parameters && cmd.parameters.new_password);
                  const isOffboarding = cmd.action_type === 'RESET_PASSWORD_AND_LOGOFF' || !!password;

                  return (
                    <tr key={cmd.id} className="hover:bg-[#1a263e] transition">
                      {/* Device */}
                      <td className="px-5 py-4 align-top">
                        <div className="font-semibold text-white">{cmd.device_name || 'Dispositivo'}</div>
                        <div className="text-[10px] font-mono text-slate-400 mt-0.5">
                          ID: {cmd.device_id.substring(0, 8)}...
                        </div>
                      </td>

                      {/* Action & Password */}
                      <td className="px-4 py-4 align-top">
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold border ${actionInfo.badgeClass}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {actionInfo.title}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                            cmd.mode === 'REAL' 
                              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                              : 'bg-slate-700/50 text-slate-400 border border-slate-600/40'
                          }`}>
                            {cmd.mode || 'SIMULATION'}
                          </span>
                        </div>

                        {cmd.reason && (
                          <p className="text-[11px] text-slate-400 mt-1 line-clamp-1 italic">
                            "{cmd.reason}"
                          </p>
                        )}

                        {/* Stored Password for IT Support */}
                        {password && (
                          <div className="mt-2.5 inline-flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#0d1627] border border-amber-500/40 shadow-inner">
                            <Key className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-[11px] font-medium text-amber-200">Senha Salva para TI:</span>
                            <code className="px-2 py-0.5 rounded bg-black/60 font-mono font-bold text-amber-300 text-xs tracking-wider select-all border border-amber-500/30">
                              {password}
                            </code>
                            <button
                              type="button"
                              onClick={() => handleCopyPassword(cmd.id, password)}
                              className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 transition flex items-center gap-1 text-[10px] font-semibold border border-amber-500/30"
                              title="Copiar Senha"
                            >
                              {copiedId === cmd.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copiada!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Copiar</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </td>

                      {/* Target */}
                      <td className="px-4 py-4 align-top">
                        {cmd.target_username ? (
                          <span className="font-mono text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded text-[11px] border border-slate-700">
                            @{cmd.target_username}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">
                            {isOffboarding ? 'Sessão Ativa / Windows' : 'Dispositivo Completo'}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 align-top">
                        {getStatusBadge(cmd.status)}
                      </td>

                      {/* Requester */}
                      <td className="px-4 py-4 align-top text-slate-300">
                        <div className="font-medium text-white">{cmd.requester_name || 'Administrador'}</div>
                      </td>

                      {/* Created At */}
                      <td className="px-4 py-4 align-top font-mono text-[11px] text-slate-400 whitespace-nowrap">
                        {new Date(cmd.created_at).toLocaleString('pt-BR')}
                      </td>

                      {/* Result / Actions */}
                      <td className="px-5 py-4 align-top text-right">
                        {cmd.status === 'PENDING' && cmd.mode === 'SIMULATION' ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleSimulateResult(cmd.id, true)}
                              className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1 transition"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Simular Sucesso</span>
                            </button>
                            <button
                              onClick={() => handleSimulateResult(cmd.id, false)}
                              className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-semibold flex items-center gap-1 transition"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Simular Falha</span>
                            </button>
                          </div>
                        ) : cmd.status === 'PENDING' && cmd.mode === 'REAL' ? (
                          <div className="text-right">
                            <span className="inline-flex items-center gap-1.5 text-[11px] text-amber-400 animate-pulse font-medium">
                              <Clock className="w-3.5 h-3.5" />
                              Aguardando Agente Windows...
                            </span>
                            <div className="text-[10px] text-slate-400 mt-0.5">Execução no próximo heartbeat (15s)</div>
                          </div>
                        ) : (
                          <div className="text-right space-y-1">
                            <div className="text-[11px] text-slate-300 font-medium">
                              {cmd.result_message || 'Finalizado com êxito'}
                            </div>
                            {cmd.completed_at && (
                              <div className="text-[10px] text-slate-400 font-mono">
                                Concluído: {new Date(cmd.completed_at).toLocaleTimeString('pt-BR')}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-5 py-3.5 bg-[#0B1120] border-t border-[#24334C] flex items-center justify-between text-xs text-slate-400">
          <span>Página {page} de {totalPages} ({total} ordens no total)</span>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1.5 rounded-lg bg-[#151F32] hover:bg-[#1a263e] border border-[#24334C] text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1.5 rounded-lg bg-[#151F32] hover:bg-[#1a263e] border border-[#24334C] text-slate-300 disabled:opacity-30 disabled:pointer-events-none transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
