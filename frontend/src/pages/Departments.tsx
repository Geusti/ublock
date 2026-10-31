import React, { useState, useEffect } from 'react';
import { Department } from '../types';
import { api } from '../services/api';
import { Modal } from '../components/Modal';
import { 
  Building2, 
  Plus, 
  Edit, 
  Trash2, 
  Users, 
  Laptop, 
  AlertCircle,
  CheckCircle2,
  XCircle
} from 'lucide-react';

export const Departments: React.FC = () => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [deletingDept, setDeletingDept] = useState<Department | null>(null);

  // Form State
  const [name, setName] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchDepartments = async () => {
    setLoading(true);
    try {
      const data = await api.getDepartments();
      setDepartments(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao carregar departamentos.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const openCreateModal = () => {
    setEditingDept(null);
    setName('');
    setIsActive(true);
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (dept: Department) => {
    setEditingDept(dept);
    setName(dept.name);
    setIsActive(dept.is_active);
    setError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (editingDept) {
        await api.updateDepartment(editingDept.id, {
          name: name.trim(),
          is_active: isActive,
        });
        setFeedback({ type: 'success', message: `Departamento '${name}' atualizado!` });
      } else {
        await api.createDepartment({
          name: name.trim(),
          is_active: isActive,
        });
        setFeedback({ type: 'success', message: `Departamento '${name}' criado!` });
      }
      setIsModalOpen(false);
      fetchDepartments();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar departamento.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deletingDept) return;
    try {
      const res = await api.deleteDepartment(deletingDept.id);
      setFeedback({ type: 'success', message: res.message });
      setDeletingDept(null);
      fetchDepartments();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Erro ao excluir departamento.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Notifications */}
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
          <h2 className="text-xl font-bold text-white tracking-tight">Departamentos & Setores</h2>
          <p className="text-xs text-slate-400">
            Organização corporativa dos equipamentos e funcionários da Ubook
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center gap-2 shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          Novo Departamento
        </button>
      </div>

      {/* Departments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-3 p-8 text-center text-slate-400">
            Carregando departamentos...
          </div>
        ) : departments.length === 0 ? (
          <div className="col-span-3 p-8 text-center text-slate-400 bg-[#151F32] rounded-xl border border-[#24334C]">
            Nenhum departamento cadastrado. Clique em "Novo Departamento" para adicionar.
          </div>
        ) : (
          departments.map((dept) => (
            <div 
              key={dept.id} 
              className="bg-[#151F32] border border-[#24334C] rounded-xl p-5 space-y-4 hover:border-slate-600 transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">{dept.name}</h3>
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold mt-0.5 ${
                      dept.is_active ? 'text-emerald-400' : 'text-slate-500'
                    }`}>
                      {dept.is_active ? (
                        <>
                          <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Ativo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3 text-slate-500" /> Inativo
                        </>
                      )}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => openEditModal(dept)}
                    title="Editar Departamento"
                    className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeletingDept(dept)}
                    title="Excluir ou Desativar"
                    className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-3 border-t border-[#24334C] text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span>{dept.employee_count} Colaborador(es)</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <Laptop className="w-4 h-4 text-emerald-400" />
                  <span>{dept.device_count} Computador(es)</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingDept ? 'Editar Departamento' : 'Novo Departamento'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase text-slate-400 mb-1">
              Nome do Setor / Departamento *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex.: Engenharia de Software"
              className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3 py-2 text-sm text-white"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="deptActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded bg-[#0B1120] border-[#24334C] text-blue-600 focus:ring-0"
            />
            <label htmlFor="deptActive" className="text-xs text-slate-300 font-medium cursor-pointer">
              Departamento ativo para alocação de equipamentos e funcionários
            </label>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#24334C]">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : 'Salvar Departamento'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete / Deactivate Safe Confirmation Modal */}
      {deletingDept && (
        <Modal
          isOpen={!!deletingDept}
          onClose={() => setDeletingDept(null)}
          title="Excluir ou Desativar Departamento"
        >
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-start gap-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-amber-200">Integridade dos Relacionamentos</p>
                <p className="mt-1 leading-relaxed">
                  {deletingDept.employee_count > 0 || deletingDept.device_count > 0 ? (
                    <>
                      O departamento <strong>{deletingDept.name}</strong> possui{' '}
                      <strong>{deletingDept.employee_count} colaborador(es)</strong> e{' '}
                      <strong>{deletingDept.device_count} ativo(s)</strong> vinculados.
                      Para não corromper o histórico, ele será <strong>desativado logicamente</strong>.
                    </>
                  ) : (
                    <>
                      O departamento <strong>{deletingDept.name}</strong> não possui nenhum colaborador ou ativo associado e pode ser removido permanentemente.
                    </>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#24334C]">
              <button
                type="button"
                onClick={() => setDeletingDept(null)}
                className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold"
              >
                Confirmar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};
