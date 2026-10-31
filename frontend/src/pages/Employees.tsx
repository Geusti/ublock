import React, { useState, useEffect } from 'react';
import { Employee, Department } from '../types';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { StatusBadge } from '../components/StatusBadge';
import { OSBadge } from '../components/OSBadge';
import { 
  Users, 
  Building2, 
  Plus, 
  Search, 
  Mail, 
  Laptop, 
  ChevronLeft, 
  ChevronRight, 
  Edit,
  Eye,
  Trash2,
  AlertCircle
} from 'lucide-react';

export const Employees: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals
  const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [viewingEmp, setViewingEmp] = useState<Employee | null>(null);
  const [deactivatingEmp, setDeactivatingEmp] = useState<Employee | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [corporateEmail, setCorporateEmail] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [empStatus, setEmpStatus] = useState<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.getEmployees({
        search: search || undefined,
        department_id: deptFilter || undefined,
        status: statusFilter || undefined,
        page,
        page_size: 15,
      });
      setEmployees(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar colaboradores.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchDepartments = async () => {
    try {
      const depts = await api.getDepartments();
      setDepartments(depts);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, [page, deptFilter, statusFilter]);

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleOpenCreateEmp = () => {
    setEditingEmp(null);
    setFullName('');
    setCorporateEmail('');
    setDepartmentId('');
    setEmpStatus('ACTIVE');
    setNotes('');
    setFormError(null);
    setIsEmpModalOpen(true);
  };

  const handleOpenEditEmp = (emp: Employee) => {
    setEditingEmp(emp);
    setFullName(emp.full_name);
    setCorporateEmail(emp.corporate_email || '');
    setDepartmentId(emp.department_id || '');
    setEmpStatus(emp.status);
    setNotes(emp.notes || '');
    setFormError(null);
    setIsEmpModalOpen(true);
  };

  const handleOpenViewEmp = async (emp: Employee) => {
    try {
      const detail = await api.getEmployee(emp.id);
      setViewingEmp(detail);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar detalhes do colaborador.' });
    }
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      if (editingEmp) {
        await api.updateEmployee(editingEmp.id, {
          full_name: fullName.trim(),
          corporate_email: corporateEmail.trim() || undefined,
          department_id: departmentId || undefined,
          status: empStatus,
          notes: notes.trim() || undefined,
        });
        setFeedback({ type: 'success', message: `Colaborador '${fullName}' atualizado!` });
      } else {
        await api.createEmployee({
          full_name: fullName.trim(),
          corporate_email: corporateEmail.trim() || undefined,
          department_id: departmentId || undefined,
          status: empStatus,
          notes: notes.trim() || undefined,
        });
        setFeedback({ type: 'success', message: `Colaborador '${fullName}' cadastrado!` });
      }
      setIsEmpModalOpen(false);
      fetchEmployees();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar colaborador.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDeactivate = async () => {
    if (!deactivatingEmp) return;
    try {
      await api.deactivateEmployee(deactivatingEmp.id);
      setFeedback({ type: 'success', message: `Colaborador '${deactivatingEmp.full_name}' desativado com sucesso.` });
      setDeactivatingEmp(null);
      fetchEmployees();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao desativar colaborador.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Banner */}
      {feedback && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-xs animate-fadeIn ${
          feedback.type === 'success' 
            ? 'bg-emerald-500/10 border border-emerald-500/25 text-emerald-300' 
            : 'bg-rose-500/10 border border-rose-500/25 text-rose-300'
        }`}>
          <span>{feedback.message}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white font-bold ml-4">
            &times;
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Gestão de Colaboradores</h2>
          <p className="text-xs text-slate-400">
            {total} profissionais cadastrados para responsabilidade de equipamentos
          </p>
        </div>

        <button
          onClick={handleOpenCreateEmp}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Novo Colaborador
        </button>
      </div>

      {/* Search and Filters */}
      <div className="bg-[#151F32] border border-[#24334C] rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { setPage(1); fetchEmployees(); } }}
            placeholder="Buscar por nome ou e-mail corporativo..."
            className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={deptFilter}
            onChange={(e) => { setDeptFilter(e.target.value); setPage(1); }}
            className="bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">Todos os Departamentos</option>
            {departments.map(d => (
              <option key={d.id} value={d.id}>{d.name} ({d.employee_count})</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500"
          >
            <option value="">Todos os Status</option>
            <option value="ACTIVE">Ativo</option>
            <option value="INACTIVE">Inativo</option>
          </select>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-[#151F32] border border-[#24334C] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-[#0B1120] border-b border-[#24334C] text-slate-400 font-semibold uppercase tracking-wider">
            <tr>
              <th className="px-5 py-3">Colaborador</th>
              <th className="px-4 py-3">E-mail Corporativo</th>
              <th className="px-4 py-3">Departamento</th>
              <th className="px-4 py-3">Equipamentos Vinculados</th>
              <th className="px-4 py-3">Situação</th>
              <th className="px-5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#24334C] text-slate-300">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  Carregando colaboradores...
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-slate-400">
                  Nenhum colaborador encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : (
              employees.map(emp => (
                <tr key={emp.id} className="hover:bg-[#1a263e] transition">
                  <td className="px-5 py-3.5">
                    <div className="font-semibold text-white">{emp.full_name}</div>
                    {emp.notes && <div className="text-[11px] text-slate-400 truncate max-w-xs">{emp.notes}</div>}
                  </td>
                  <td className="px-4 py-3.5">
                    {emp.corporate_email ? (
                      <div className="flex items-center gap-1.5 text-slate-300">
                        <Mail className="w-3.5 h-3.5 text-blue-400" />
                        <span>{emp.corporate_email}</span>
                      </div>
                    ) : (
                      <span className="text-slate-500 italic">Não informado</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-slate-300">
                    {emp.department_name || '-'}
                  </td>
                  <td className="px-4 py-3.5">
                    <button
                      onClick={() => handleOpenViewEmp(emp)}
                      className="flex items-center gap-1.5 text-blue-400 hover:text-blue-300 font-medium transition"
                    >
                      <Laptop className="w-3.5 h-3.5" />
                      <span>{emp.device_count} equipamento(s)</span>
                    </button>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      emp.status === 'ACTIVE'
                        ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                        : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                    }`}>
                      {emp.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {/* View assigned devices */}
                      <button
                        onClick={() => handleOpenViewEmp(emp)}
                        className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                        title="Ver Equipamentos Vinculados"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {/* Edit */}
                      <button
                        onClick={() => handleOpenEditEmp(emp)}
                        className="p-1.5 rounded text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 transition"
                        title="Editar Colaborador"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      {/* Deactivate */}
                      {emp.status === 'ACTIVE' && (
                        <button
                          onClick={() => setDeactivatingEmp(emp)}
                          className="p-1.5 rounded text-slate-400 hover:text-amber-400 hover:bg-amber-500/10 transition"
                          title="Desativar Colaborador"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
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

      {/* Employee Modal (Create/Edit) */}
      <Modal
        isOpen={isEmpModalOpen}
        onClose={() => setIsEmpModalOpen(false)}
        title={editingEmp ? `Editar Colaborador: ${editingEmp.full_name}` : 'Cadastrar Novo Colaborador'}
      >
        <form onSubmit={handleSaveEmployee} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Nome Completo *</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Ex.: Mariana Fernandes"
              className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">E-mail Corporativo</label>
            <input
              type="email"
              value={corporateEmail}
              onChange={(e) => setCorporateEmail(e.target.value)}
              placeholder="mariana.fernandes@ubook.com.br"
              className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Departamento</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="">Nenhum departamento...</option>
                {departments.filter(d => d.is_active).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Situação</label>
              <select
                value={empStatus}
                onChange={(e: any) => setEmpStatus(e.target.value)}
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
              >
                <option value="ACTIVE">Ativo</option>
                <option value="INACTIVE">Inativo</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">Observações Não Sensíveis</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex.: Regime híbrido / Matriz"
              className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>

          {formError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {formError}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#24334C]">
            <button
              type="button"
              onClick={() => setIsEmpModalOpen(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Salvar Colaborador'}
            </button>
          </div>
        </form>
      </Modal>

      {/* View Employee Detail Modal (With Assigned Devices) */}
      {viewingEmp && (
        <Modal
          isOpen={!!viewingEmp}
          onClose={() => setViewingEmp(null)}
          title={`Colaborador: ${viewingEmp.full_name}`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs">
            <div className="p-4 rounded-xl bg-[#0B1120] border border-[#24334C] grid grid-cols-2 gap-3">
              <div>
                <span className="text-slate-400 block">E-mail:</span>
                <span className="text-white font-medium">{viewingEmp.corporate_email || 'Não informado'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Departamento:</span>
                <span className="text-white font-medium">{viewingEmp.department_name || 'Sem departamento'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Situação:</span>
                <span className={`font-semibold ${viewingEmp.status === 'ACTIVE' ? 'text-emerald-400' : 'text-slate-400'}`}>
                  {viewingEmp.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Equipamentos Vinculados:</span>
                <span className="text-blue-400 font-semibold">{viewingEmp.device_count} máquina(s)</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-semibold uppercase text-slate-400 mb-2">
                Computadores Atribuídos a este Colaborador
              </h4>
              {(!viewingEmp.assigned_devices || viewingEmp.assigned_devices.length === 0) ? (
                <div className="p-4 rounded-lg bg-[#0B1120] border border-[#24334C] text-slate-500 italic text-center">
                  Nenhum computador vinculado atualmente a este colaborador.
                </div>
              ) : (
                <div className="divide-y divide-[#24334C] bg-[#0B1120] rounded-xl border border-[#24334C] overflow-hidden">
                  {viewingEmp.assigned_devices.map(dev => (
                    <div key={dev.id} className="p-3 flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-white">{dev.display_name}</div>
                        <div className="text-[10px] font-mono text-slate-400">{dev.hostname} &bull; Patrimônio: {dev.asset_tag || 'N/A'}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <OSBadge osFamily={dev.os_family} />
                        <StatusBadge status={dev.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-[#24334C]">
              <button
                type="button"
                onClick={() => setViewingEmp(null)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium"
              >
                Fechar
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivatingEmp && (
        <Modal
          isOpen={!!deactivatingEmp}
          onClose={() => setDeactivatingEmp(null)}
          title="Confirmar Desativação de Colaborador"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">Desativação Lógica</p>
                <p className="mt-1 leading-relaxed">
                  O colaborador <strong>{deactivatingEmp.full_name}</strong> será marcado como <strong>INATIVO</strong>.
                  Os computadores vinculados a ele continuarão atribuídos até que sejam transferidos para outro responsável.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#24334C]">
              <button
                type="button"
                onClick={() => setDeactivatingEmp(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeactivate}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold"
              >
                Confirmar Desativação
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
