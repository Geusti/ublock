import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Lock, Shield, ArrowRight } from 'lucide-react';

export const Login: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@ubook.com.br');
  const [password, setPassword] = useState('UblockAdmin2026!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Falha na autenticação. Verifique suas credenciais.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">NEXUS IT ASSET MANAGER</h1>
          <p className="text-sm text-slate-400">
            Painel Administrativo & Gestão de Ativos para Endpoints Ubook
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-[#151F32] border border-[#24334C] rounded-2xl p-8 shadow-2xl shadow-black/50">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                E-mail Corporativo
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu.email@ubook.com.br"
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                Senha de Acesso
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full bg-[#0B1120] border border-[#24334C] rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition disabled:opacity-50"
            >
              {loading ? 'Autenticando...' : 'Acessar Painel Administrativo'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Credentials Guide */}
          <div className="mt-6 pt-6 border-t border-[#24334C] text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-1.5 text-slate-300 font-semibold">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span>Credenciais de Demonstração (Seed):</span>
            </div>
            <div className="space-y-1 bg-[#0B1120] p-2.5 rounded-lg border border-[#24334C]">
              <div className="flex justify-between">
                <span>Super Admin:</span>
                <span className="font-mono text-slate-300">admin@ubook.com.br / UblockAdmin2026!</span>
              </div>
              <div className="flex justify-between">
                <span>Técnico TI:</span>
                <span className="font-mono text-slate-300">tecnico@ubook.com.br / UblockTech2026!</span>
              </div>
              <div className="flex justify-between">
                <span>Auditor:</span>
                <span className="font-mono text-slate-300">auditor@ubook.com.br / UblockView2026!</span>
              </div>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-slate-500">
          NEXUS IT Asset Manager &bull; Ublock v1.0.0
        </p>
      </div>
    </div>
  );
};
