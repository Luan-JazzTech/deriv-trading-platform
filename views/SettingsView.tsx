import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ShieldCheck, Eye, EyeOff } from 'lucide-react';

export function SettingsView() {
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulação de salvamento
    setTimeout(() => {
      setLoading(false);
      alert('Token salvo com segurança! (Simulação)');
    }, 1000);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-white">Configurações</h2>
        <p className="text-slate-400">Gerencie suas chaves de API e preferências de segurança.</p>
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
                Seu token será criptografado antes de ser salvo no banco de dados.
                Nunca compartilhe este token com ninguém.
              </p>
            </div>
            
            <div className="flex gap-4 pt-2">
              <Button type="submit" isLoading={loading} className="bg-green-600 hover:bg-green-500 text-white">
                Salvar Configuração
              </Button>
              <Button type="button" variant="outline" onClick={() => alert('Testando conexão...')} className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800">
                Testar Conexão
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}