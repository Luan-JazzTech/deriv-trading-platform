
import React, { useState } from 'react';
import { TrendingUp, Lock, Mail } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';

interface LoginViewProps {
  onLoginSuccess: () => void;
}

export function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [loading, setLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulating API call
    setTimeout(() => {
      setLoading(false);
      onLoginSuccess();
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 text-white">
            <TrendingUp className="h-8 w-8 text-green-400" />
            <span className="text-3xl font-bold">DerivPro</span>
          </div>
        </div>
        
        <Card className="border-slate-800 bg-slate-950 text-white">
          <CardHeader>
            <CardTitle className="text-center text-white">
              {isRegister ? 'Criar nova conta' : 'Acessar plataforma'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input 
                    type="email" 
                    placeholder="seu@email.com" 
                    className="pl-9 bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-green-500"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-400">Senha</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    className="pl-9 bg-slate-900 border-slate-800 text-white placeholder:text-slate-600 focus-visible:ring-green-500"
                    required
                  />
                </div>
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700 text-white" 
                isLoading={loading}
              >
                {isRegister ? 'Registrar' : 'Entrar'}
              </Button>
            </form>
            
            <div className="mt-4 text-center">
              <button 
                onClick={() => setIsRegister(!isRegister)}
                className="text-sm text-slate-400 hover:text-green-400 transition-colors"
              >
                {isRegister ? 'Já tem conta? Fazer login' : 'Não tem conta? Criar agora'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
