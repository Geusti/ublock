import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Devices } from './pages/Devices';
import { DeviceDetail } from './pages/DeviceDetail';
import { Employees } from './pages/Employees';
import { Departments } from './pages/Departments';
import { Commands } from './pages/Commands';
import { Audit } from './pages/Audit';
import { Device } from './types';

export const App: React.FC = () => {
  const { isAuthenticated, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mr-3" />
        Carregando NEXUS IT Asset Manager...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  const getTitle = () => {
    if (currentTab === 'devices' && selectedDevice) {
      return `Equipamento: ${selectedDevice.display_name}`;
    }
    switch (currentTab) {
      case 'dashboard':
        return 'Visão Geral & Indicadores';
      case 'devices':
        return 'Inventário de Computadores';
      case 'employees':
        return 'Gestão de Colaboradores';
      case 'departments':
        return 'Gestão de Departamentos';
      case 'commands':
        return 'Controle de Acesso & Ações de Bloqueio (SIM)';
      case 'audit':
        return 'Trilha de Auditoria e Conformidade';
      default:
        return 'NEXUS IT Asset Manager';
    }
  };

  const handleSelectTab = (tab: string, device?: Device) => {
    if (device) {
      setSelectedDevice(device);
    } else {
      setSelectedDevice(null);
    }
    setCurrentTab(tab);
  };

  return (
    <Layout currentTab={currentTab} onSelectTab={(tab) => handleSelectTab(tab)} title={getTitle()}>
      {currentTab === 'dashboard' && <Dashboard onNavigate={handleSelectTab} />}
      {currentTab === 'devices' && (
        selectedDevice ? (
          <DeviceDetail device={selectedDevice} onBack={() => setSelectedDevice(null)} />
        ) : (
          <Devices onSelectDevice={setSelectedDevice} />
        )
      )}
      {currentTab === 'employees' && <Employees />}
      {currentTab === 'departments' && <Departments />}
      {currentTab === 'commands' && <Commands />}
      {currentTab === 'audit' && <Audit />}
    </Layout>
  );
};
