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
  Info 
} from 'lucide-react';

export const Commands: React.FC = () => {
  const [commands, setCommands] = useState<Command[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCommands = async () => {
    setLoading(true);
    try {
      const res = await api.getCommands({
        status: statusFilter || undefined,
        page,
        page_size: 15,
      });
      setCommands(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommands();
  }, [page, statusFilter]);

  const handleSimulateResult = async (commandId: string, succeeded: boolean) => {
    try {
      await api.simulateCommandResult(commandId, { succeeded });
      fetchCommands();
    } catch (err: any) {
      alert(err.message || 'Falha ao atualizar simulação.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Fila de Comandos & Ações de Bloqueio</h2>
        <p className="text-xs text-slate-400">
          Gerenciamento e simulação das ações de contenção em endpoints corporativos
        </p>
      </div>

      {/* Safety Notice */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
        <Info className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-300 space-y-1">
          <p className="font-semibold text-amber-200">
            ARQUITETURA DE SEGURANÇA — FASE 1: CONTROLE SIMULADO
          </p>
          <p className="text-amber-300/80 leading-relaxed">
            As ordens abaixo representam o ciclo de vida completo da mensageria (criação, auditoria, execução simulada e feedback).
            Nenhum shell remoto, PowerShell ou desativação real de adaptadores físicos é acionada nesta fase de homologação.
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => { setStatusFilter(''); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            statusFilter === ''
              ? 'bg-blue-600 text-white'
              : 'bg-[#151F32] border border-[#24334C] text-slate-400 hover:text-white'
          }`}
        >
          Todos ({total})
        </button>
        <button
          onClick={() => { setStatusFilter('PENDING'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            statusFilter === 'PENDING'
              ? 'bg-amber-600 text-white'
              : 'bg-[#151F32] border border-[#24334C] text-slate-400 hover:text-white'
          }`}
        >
          Pendentes
        </button>
        <button
          onClick={() => { setStatusFilter('SUCCEEDED_SIMULATED'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            statusFilter === 'SUCCEEDED_SIMULATED'
              ? 'bg-emerald-600 text-white'
              : 'bg-[#151F32] border border-[#24334C] text-slate-400 hover:text-white'
          }`}
        >
          Sucesso (Simulado)
        </button>
        <button
          onClick={() => { setStatusFilter('FAILED_SIMULATED'); setPage(1); }}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
            statusFilter === 'FAILED_SIMULATED'
              ? 'bg-rose-600 text-white'
              : 'bg-[#151F32] border border-[#24334C] text-slate-400 hover:text-white'
          }`}
        >
          Falha (Simulada)
        </button>
      </div>

      {/* Commands Table */}
      <div className="bg-[#151F32] border border-[#24334C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0B1120] border-b border-[#24334C] text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Dispositivo Alvo</th>
              <th className="px-4 py-3">Tipo de Ação</th>
              <th className="px-4 py-3">Alvo Específico</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Solicitante</th>
              <th className="px-4 py-3">Data de Envio</th>
              <th className="px-5 py-3 text-right">Ação de Simulação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#24334C] text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  Carregando comandos...
                </td>
              </tr>
            ) : commands.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-5 py-8 text-center text-slate-400">
                  Nenhuma ordem encontrada para os critérios selecionados.
                </td>
              </tr>
            ) : (
              commands.map(cmd => (
                <tr key={cmd.id} className="hover:bg-[#1a263e] transition">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-white">{cmd.device_name || 'Dispositivo'}</div>
                    <div className="text-[10px] font-mono text-slate-400">{cmd.device_id.substring(0, 8)}...</div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="font-semibold text-slate-200">{cmd.action_type}</span>
                    <span className="block text-[10px] text-amber-400 font-mono">[{cmd.mode}]</span>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-300">
                    {cmd.target_username ? `@${cmd.target_username}` : 'Dispositivo Completo'}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cmd.status === 'SUCCEEDED_SIMULATED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      cmd.status === 'FAILED_SIMULATED' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                      'bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse'
                    }`}>
                      {cmd.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-300">
                    {cmd.requester_name || 'Admin'}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-slate-400">
                    {new Date(cmd.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {cmd.status === 'PENDING' ? (
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleSimulateResult(cmd.id, true)}
                          className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-semibold flex items-center gap-1"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Simular Sucesso</span>
                        </button>
                        <button
                          onClick={() => handleSimulateResult(cmd.id, false)}
                          className="px-2 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-semibold flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Simular Falha</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500 text-right">
                        {cmd.result_message || 'Finalizado'}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="px-5 py-3 bg-[#0B1120] border-t border-[#24334C] flex items-center justify-between text-xs text-slate-400">
          <span>Página {page} de {totalPages}</span>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="p-1 rounded hover:bg-slate-800 disabled:opacity-40"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
