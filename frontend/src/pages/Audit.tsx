import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { 
  ScrollText, 
  Search, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle, 
  AlertCircle, 
  Eye, 
  Shield 
} from 'lucide-react';

export const Audit: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [actionFilter, setActionFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Inspector modal
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.getAuditLogs({
        action_type: actionFilter || undefined,
        page,
        page_size: 20,
      });
      setLogs(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Trilha de Auditoria Imutável</h2>
        <p className="text-xs text-slate-400">
          Registro perene de todas as operações administrativas, acessos e comandos de segurança
        </p>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-4 flex items-center justify-between gap-3">
        <div className="flex-1 max-w-sm relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            placeholder="Filtrar por ação (ex.: COMMAND, LOGIN, CREATE)..."
            className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Shield className="w-4 h-4 text-emerald-400" />
          <span>Registros protegidos contra alteração ou exclusão</span>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-[#151F32] border border-[#24334C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0B1120] border-b border-[#24334C] text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Data / Hora (UTC)</th>
              <th className="px-4 py-3">Ação</th>
              <th className="px-4 py-3">Resultado</th>
              <th className="px-4 py-3">Administrador</th>
              <th className="px-4 py-3">Dispositivo Relacionado</th>
              <th className="px-5 py-3 text-right">Detalhes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#24334C] text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  Carregando trilha de auditoria...
                </td>
              </tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  Nenhum registro de auditoria encontrado.
                </td>
              </tr>
            ) : (
              logs.map(log => (
                <tr key={log.id} className="hover:bg-[#1a263e] transition">
                  <td className="px-5 py-3.5 font-mono text-slate-400">
                    {new Date(log.created_at).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-white">
                    {log.action}
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.outcome === 'SUCCESS' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      log.outcome === 'PENDING_SIMULATED' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {log.outcome}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-slate-300">
                    {log.actor_admin_name || 'Sistema'}
                  </td>
                  <td className="px-4 py-3.5 text-slate-400">
                    {log.device_name || '-'}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                      title="Inspecionar Detalhes do Evento"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div className="px-5 py-3 bg-[#0B1120] border-t border-[#24334C] flex items-center justify-between text-xs text-slate-400">
          <span>Página {page} de {totalPages} ({total} eventos registrados)</span>
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

      {/* Log Details Modal */}
      {selectedLog && (
        <Modal
          isOpen={!!selectedLog}
          onClose={() => setSelectedLog(null)}
          title={`Evento de Auditoria: ${selectedLog.action}`}
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3 p-3 bg-[#0B1120] border border-[#24334C] rounded-lg">
              <div>
                <span className="text-slate-400 block">ID do Registro:</span>
                <span className="font-mono text-slate-200">{selectedLog.id}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Horário UTC:</span>
                <span className="font-mono text-slate-200">{new Date(selectedLog.created_at).toISOString()}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Administrador / Ator:</span>
                <span className="text-white font-medium">{selectedLog.actor_admin_name || 'Sistema'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Resultado:</span>
                <span className="text-emerald-400 font-semibold">{selectedLog.outcome}</span>
              </div>
            </div>

            <div>
              <span className="block font-semibold uppercase text-slate-400 mb-1.5">Metadados e Payload do Evento:</span>
              <pre className="p-3 bg-[#0B1120] border border-[#24334C] rounded-lg text-slate-300 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(selectedLog.details, null, 2)}
              </pre>
            </div>

            <div className="flex justify-end pt-3 border-t border-[#24334C]">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
