
import React, { useState, Component, ErrorInfo } from 'react';
import { createRoot } from 'react-dom/client';
import { Layout } from './components/Layout';
import { LoginView } from './views/LoginView';
import { DashboardView } from './views/DashboardView';
import { SettingsView } from './views/SettingsView';
import { LogsView } from './views/LogsView';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

// Tipos de rotas disponíveis
type ViewState = 'login' | 'dashboard' | 'settings' | 'logs';

// --- ERROR BOUNDARY (Proteção contra Tela Branca) ---
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  handleRetry = () => {
      this.setState({ hasError: false, error: null });
      window.location.reload();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
          <div className="bg-red-500/10 p-4 rounded-full mb-4">
            <AlertTriangle className="h-12 w-12 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Ops! Algo deu errado.</h1>
          <p className="text-slate-400 max-w-md mb-6">
            A aplicação encontrou um erro inesperado. Isso geralmente acontece por falha na conexão ou dados inválidos.
          </p>
          <div className="bg-slate-900 p-4 rounded text-left text-xs text-red-400 font-mono mb-6 w-full max-w-md overflow-auto">
             {this.state.error?.message}
          </div>
          <button 
            onClick={this.handleRetry}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold transition-colors"
          >
            <RefreshCcw className="h-4 w-4" />
            Recarregar Aplicação
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

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
    return (
        <ErrorBoundary>
            <LoginView onLoginSuccess={handleLogin} />
        </ErrorBoundary>
    );
  }

  // Renderiza a view correta dentro do Layout
  return (
    <ErrorBoundary>
        <Layout 
        activeView={currentView} 
        onChangeView={(view) => setCurrentView(view as ViewState)}
        onLogout={handleLogout}
        >
        {/* 
            ESTRATÉGIA DE PERSISTÊNCIA:
            O DashboardView contém o Bot, o WebSocket e o estado das operações ativas.
            Não podemos desmontá-lo (remover do DOM) quando o usuário troca de aba,
            senão o Bot para e as operações somem.
            Usamos 'display: none' (hidden) para mantê-lo rodando no fundo.
        */}
        <div className={currentView === 'dashboard' ? 'block h-full' : 'hidden'}>
            <DashboardView />
        </div>

        {/* As outras telas carregam dados do banco, podem ser remontadas sem problemas */}
        {currentView === 'settings' && <SettingsView />}
        {currentView === 'logs' && <LogsView />}
        </Layout>
    </ErrorBoundary>
  );
};

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(<App />);
}
