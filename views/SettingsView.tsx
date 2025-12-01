
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ShieldCheck, Eye, EyeOff, CheckCircle } from 'lucide-react';

export function SettingsView() {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');

  useEffect(() => {
    const saved = localStorage.getItem('deriv_token');
    if (saved) setToken(saved);
  }, []);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Salva no LocalStorage para a API usar
    localStorage.setItem('deriv_token', token.trim());

    setTimeout(() => {
      setLoading(false);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    }, 500);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">Configurações</h2>
        <p className="text-slate-400">Gerencie suas chaves de API para conexão real.</p>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-green-500" />
            <CardTitle className="text-white">Conexão Deriv / Binary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">API Token (Read + Trade)</label>
              <div className="relative">
                <Input 
                  type={showToken ? "text" : "password"} 
                  placeholder="Insira seu token aqui..." 
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  className="pr-10 font-mono bg-slate-950 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-green-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowToken(!showToken)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-500">
                Seu token é salvo localmente no navegador para acesso direto à API.
              </p>
            </div>
            
            <div className="flex gap-4 pt-2 items-center">
              <Button type="submit" isLoading={loading} className="bg-green-600 hover:bg-green-500 text-white">
                {status === 'success' ? <><CheckCircle className="mr-2 h-4 w-4"/> Salvo com Sucesso</> : 'Salvar e Conectar'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
