
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TrendingUp, TrendingDown, DollarSign, Activity, AlertTriangle, ArrowRight } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { analyzeMarket, Candle, AnalysisResult } from '../lib/analysis/engine';

export function DashboardView() {
  const [balance] = useState(1240.50);
  const [symbol] = useState("Volatility 100 (1s)");
  const [stake, setStake] = useState(10);
  const [duration, setDuration] = useState(5);
  const [timeframe, setTimeframe] = useState('M1');

  // Estado da Análise
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [currentPrice, setCurrentPrice] = useState(1050.00);
  const [candles, setCandles] = useState<Candle[]>([]);

  // Simulação de Mercado (Gerador de Candles Fake)
  useEffect(() => {
    // Inicializa com 50 candles aleatórios
    const initialCandles: Candle[] = [];
    let price = 1050.00;
    const now = Date.now();
    for (let i = 50; i > 0; i--) {
      const open = price;
      const close = price + (Math.random() - 0.5) * 2;
      initialCandles.push({
        time: now - i * 60000,
        open,
        high: Math.max(open, close) + Math.random(),
        low: Math.min(open, close) - Math.random(),
        close
      });
      price = close;
    }
    setCandles(initialCandles);

    // Loop de atualização (Simula WebSocket chegando tick a tick)
    const interval = setInterval(() => {
      setCandles(prev => {
        const last = prev[prev.length - 1];
        // Simplesmente altera o preço atual aleatoriamente (Random Walk)
        const volatility = 1.5;
        const change = (Math.random() - 0.5) * volatility;
        const newPrice = last.close + change;
        
        // Atualiza preço visual
        setCurrentPrice(newPrice);

        // A cada 5 ticks, cria um novo candle (simulando tempo passando rápido)
        // Na vida real, isso seria controlado pelo tempo do servidor
        if (Math.random() > 0.7) {
            const newCandle: Candle = {
                time: Date.now(),
                open: last.close,
                close: newPrice,
                high: Math.max(last.close, newPrice),
                low: Math.min(last.close, newPrice)
            };
            // Mantém tamanho fixo do array para não explodir memória
            const newHistory = [...prev.slice(1), newCandle];
            
            // Roda a Engine de Análise nos novos dados!
            const result = analyzeMarket(newHistory);
            setAnalysis(result);
            
            return newHistory;
        } else {
            // Apenas atualiza o fechamento do último candle
            const updatedLast = { 
                ...last, 
                close: newPrice,
                high: Math.max(last.high, newPrice),
                low: Math.min(last.low, newPrice) 
            };
            const newHistory = [...prev.slice(0, -1), updatedLast];
            
            // Roda engine também (análise intra-candle)
            const result = analyzeMarket(newHistory);
            setAnalysis(result);
            
            return newHistory;
        }
      });
    }, 1000); // Atualiza a cada 1 segundo

    return () => clearInterval(interval);
  }, [timeframe]);

  const getDirectionColor = (dir: string) => {
    if (dir === 'CALL') return 'text-green-600';
    if (dir === 'PUT') return 'text-red-600';
    return 'text-slate-500';
  };

  const getDirectionBg = (dir: string) => {
    if (dir === 'CALL') return 'bg-green-500';
    if (dir === 'PUT') return 'bg-red-500';
    return 'bg-slate-500';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Trading Dashboard</h2>
          <p className="text-slate-500">Análise técnica em tempo real (Engine v1.0)</p>
        </div>
        <Card className="bg-slate-900 text-white border-none min-w-[200px]">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="p-2 bg-green-500/20 rounded-full">
              <DollarSign className="h-6 w-6 text-green-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium uppercase">Saldo Atual</p>
              <p className="text-xl font-bold">{formatCurrency(balance)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Area */}
        <Card className="lg:col-span-2 h-[500px] flex flex-col">
          <CardHeader className="border-b border-slate-100 py-4">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Activity className="h-5 w-5 text-slate-500" />
                    {symbol}
                </CardTitle>
                <span className="text-2xl font-mono font-bold text-slate-800">
                    {currentPrice.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-2">
                {['M1', 'M5', 'M15'].map((tf) => (
                  <Button 
                    key={tf}
                    variant={timeframe === tf ? "default" : "outline"} 
                    size="sm" 
                    className="text-xs"
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 bg-slate-50 relative group overflow-hidden p-0">
             {/* Visualização Simplificada de Candles */}
             <div className="w-full h-full flex items-end justify-end px-4 gap-1">
                {candles.slice(-40).map((c, i) => {
                    const height = Math.abs(c.close - c.open) * 10 + 2; // Escala visual
                    const isGreen = c.close >= c.open;
                    return (
                        <div 
                            key={i} 
                            className={`w-3 rounded-t-sm ${isGreen ? 'bg-green-500' : 'bg-red-500'}`}
                            style={{ height: `${Math.min(height, 200)}px`, opacity: 0.8 }}
                        />
                    )
                })}
             </div>
             
            <div className="absolute top-4 left-4 text-xs text-slate-400 bg-white/90 p-2 rounded border">
                Simulação de Mercado Ativa<br/>
                Engine calculando RSI e EMA...
            </div>
          </CardContent>
        </Card>

        {/* Control Panel */}
        <div className="space-y-6">
          {/* Signal Card Dinâmico */}
          <Card className={`border-l-4 transition-colors duration-300 ${analysis?.direction === 'CALL' ? 'border-l-green-500' : analysis?.direction === 'PUT' ? 'border-l-red-500' : 'border-l-slate-300'}`}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-500 uppercase">Sugestão da IA</CardTitle>
            </CardHeader>
            <CardContent>
              {analysis ? (
                  <>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                        {analysis.direction === 'CALL' && <TrendingUp className="h-8 w-8 text-green-600" />}
                        {analysis.direction === 'PUT' && <TrendingDown className="h-8 w-8 text-red-600" />}
                        {analysis.direction === 'NEUTRO' && <Activity className="h-8 w-8 text-slate-400" />}
                        
                        <span className={`text-3xl font-bold ${getDirectionColor(analysis.direction)}`}>
                            {analysis.direction}
                        </span>
                        </div>
                        <div className="text-right">
                        <span className="text-2xl font-bold text-slate-900">{analysis.score}%</span>
                        <p className="text-xs text-slate-500">Score de Confiança</p>
                        </div>
                    </div>
                    
                    <div className="space-y-3">
                        {analysis.factors.map((factor, idx) => (
                            <div key={idx} className="flex items-center justify-between text-sm">
                                <span className="text-slate-600 flex items-center gap-1">
                                    <ArrowRight className="h-3 w-3" /> {factor.label}
                                </span>
                                <span className={`font-medium ${factor.status === 'POSITIVE' ? 'text-green-600' : factor.status === 'NEGATIVE' ? 'text-red-600' : 'text-slate-400'}`}>
                                    {factor.status === 'POSITIVE' ? 'Alta' : factor.status === 'NEGATIVE' ? 'Baixa' : 'Neutro'}
                                </span>
                            </div>
                        ))}
                        {analysis.factors.length === 0 && (
                            <p className="text-xs text-slate-400 italic">Aguardando mais dados para confluência...</p>
                        )}
                    </div>
                  </>
              ) : (
                  <div className="flex flex-col items-center justify-center h-32 text-slate-400">
                      <Activity className="animate-spin h-6 w-6 mb-2" />
                      <p>Analisando mercado...</p>
                  </div>
              )}
            </CardContent>
          </Card>

          {/* Operation Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Execução</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">Valor (USD)</label>
                  <input 
                    type="number" 
                    value={stake}
                    onChange={(e) => setStake(Number(e.target.value))}
                    className="flex h-10 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-500">Duração (Ticks)</label>
                  <input 
                    type="number" 
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="flex h-10 w-full rounded-md border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <Button 
                    variant="success" 
                    className="w-full h-12 text-lg font-bold disabled:opacity-50"
                    disabled={analysis?.direction === 'PUT'} // Trava oposta para segurança (exemplo)
                >
                  <TrendingUp className="mr-2 h-5 w-5" /> CALL
                </Button>
                <Button 
                    variant="danger" 
                    className="w-full h-12 text-lg font-bold disabled:opacity-50"
                    disabled={analysis?.direction === 'CALL'} // Trava oposta para segurança
                >
                  <TrendingDown className="mr-2 h-5 w-5" /> PUT
                </Button>
              </div>
              
              <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                <AlertTriangle className="h-3 w-3" />
                <span>Stop Loss Diário: $50.00</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
