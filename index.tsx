
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from './components/Layout';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { SettingsView } from './views/SettingsView';
import './index.css'; // Assume basic Tailwind setup if available, or we rely on injected styles

// Tipos de rotas disponíveis
type ViewState = 'login' | 'dashboard' | 'settings' | 'logs';

const App = () => {
  // Estado simples de autenticação simulada
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentView('login');
  };

  // Se não estiver logado, força tela de login
  if (!isAuthenticated) {
    return <LoginView onLoginSuccess={handleLogin} />;
  }

  // Renderiza a view correta dentro do Layout
  return (
    <Layout 
      activeView={currentView} 
      onChangeView={(view) => setCurrentView(view as ViewState)}
      onLogout={handleLogout}
    >
      {currentView === 'dashboard' && <DashboardView />}
      {currentView === 'settings' && <SettingsView />}
      {currentView === 'logs' && (
        <div className="p-12 text-center text-slate-500">
          <h2 className="text-2xl font-bold mb-2">Logs de Auditoria</h2>
          <p>Histórico de operações será listado aqui na próxima fase.</p>
        </div>
      )}
    </Layout>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
