
import React, { useState, useEffect, useRef } from 'react';
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

  // Ref para controlar o tempo de criação do último candle sem causar re-render
  const lastCandleCreationRef = useRef<number>(Date.now());

  // Simulação de Mercado (Gerador de Candles Fake)
  useEffect(() => {
    // Resetar estado ao mudar timeframe
    setCandles([]);
    lastCandleCreationRef.current = Date.now();
    
    // Configuração de Velocidade da Simulação (Acelerado para Teste)
    // M1 = Nova vela a cada 3 segundos
    // M5 = Nova vela a cada 10 segundos
    // M15 = Nova vela a cada 20 segundos
    const candleDuration = timeframe === 'M1' ? 3000 : timeframe === 'M5' ? 10000 : 20000;
    
    // Inicializa com 30 candles históricos para preencher o gráfico visualmente
    const initialCandles: Candle[] = [];
    let price = 1050.00;
    const now = Date.now();
    
    // Volatilidade baseada no timeframe (apenas visual)
    const volatilityMultiplier = timeframe === 'M1' ? 1 : timeframe === 'M5' ? 2.5 : 5;

    for (let i = 30; i > 0; i--) {
      const open = price;
      const move = (Math.random() - 0.5) * 5 * volatilityMultiplier;
      const close = price + move;
      const high = Math.max(open, close) + Math.random() * 2;
      const low = Math.min(open, close) - Math.random() * 2;
      
      initialCandles.push({
        time: now - (i * candleDuration), // Espaçamento de tempo simulado
        open,
        high,
        low,
        close
      });
      price = close;
    }
    setCandles(initialCandles);
    setCurrentPrice(price);

    // Loop de atualização (Tick Rate de 500ms)
    const interval = setInterval(() => {
      const currentTime = Date.now();
      const timeSinceLastCandle = currentTime - lastCandleCreationRef.current;
      const shouldCreateNewCandle = timeSinceLastCandle >= candleDuration;

      // Volatilidade do tick atual
      const tickVolatility = timeframe === 'M1' ? 1.5 : timeframe === 'M5' ? 3 : 5;
      const change = (Math.random() - 0.5) * tickVolatility;

      setCandles(prev => {
        if (prev.length === 0) return prev;
        
        const last = prev[prev.length - 1];
        let newHistory = [...prev];

        if (shouldCreateNewCandle) {
            // FECHAR VELA ATUAL E ABRIR UMA NOVA
            const newCandle: Candle = {
                time: currentTime,
                open: last.close, // Abre onde a anterior fechou
                close: last.close + change,
                high: Math.max(last.close, last.close + change),
                low: Math.min(last.close, last.close + change)
            };
            newHistory = [...prev.slice(1), newCandle]; // Mantém tamanho fixo removendo a primeira
            lastCandleCreationRef.current = currentTime; // Reseta timer
            
            // Atualiza preço atual de referência
            setCurrentPrice(newCandle.close);
        } else {
            // ATUALIZAR VELA EXISTENTE (Tick)
            const newClose = last.close + change;
            const updatedLast = { 
                ...last, 
                close: newClose,
                high: Math.max(last.high, newClose),
                low: Math.min(last.low, newClose) 
            };
            newHistory = [...prev.slice(0, -1), updatedLast];
            
            // Atualiza preço atual de referência
            setCurrentPrice(newClose);
        }

        // Rodar análise técnica a cada tick
        const result = analyzeMarket(newHistory);
        setAnalysis(result);

        return newHistory;
      });

    }, 500); // Atualiza o preço a cada meio segundo (Tick)

    return () => clearInterval(interval);
  }, [timeframe]);

  const getDirectionColor = (dir: string) => {
    if (dir === 'CALL') return 'text-green-600';
    if (dir === 'PUT') return 'text-red-600';
    return 'text-slate-500';
  };

  // Lógica de Renderização do Gráfico (Auto-Scale)
  const renderChart = () => {
    if (candles.length === 0) return null;

    // 1. Encontrar Min e Max da tela atual para escala
    const minPrice = Math.min(...candles.map(c => c.low));
    const maxPrice = Math.max(...candles.map(c => c.high));
    const range = maxPrice - minPrice || 1; // Evitar divisão por zero

    return (
      <div className="relative w-full h-full flex items-end justify-between px-2 gap-1 overflow-hidden">
        {/* Linhas de Grade (Grid) */}
        <div className="absolute inset-0 flex flex-col justify-between text-[10px] text-slate-300 pointer-events-none p-1 z-0">
            <span className="border-b border-slate-100 w-full">{maxPrice.toFixed(2)}</span>
            <span className="border-b border-slate-100 w-full">{(minPrice + range/2).toFixed(2)}</span>
            <span className="border-b border-slate-100 w-full">{minPrice.toFixed(2)}</span>
        </div>

        {candles.map((c, i) => {
            const isGreen = c.close >= c.open;
            
            // Cálculos de porcentagem para posicionamento absoluto relativo ao container
            const highPct = ((c.high - minPrice) / range) * 100;
            const lowPct = ((c.low - minPrice) / range) * 100;
            const openPct = ((c.open - minPrice) / range) * 100;
            const closePct = ((c.close - minPrice) / range) * 100;
            
            const bodyTop = Math.max(openPct, closePct);
            const bodyBottom = Math.min(openPct, closePct);
            const bodyHeight = Math.max(bodyTop - bodyBottom, 1); // Mínimo 1% para visibilidade

            return (
                <div key={i} className="relative w-full h-full flex justify-center group z-10">
                    {/* Tooltip simples */}
                    <div className="hidden group-hover:block absolute bottom-full mb-1 bg-slate-800 text-white text-[10px] p-1 rounded z-20 whitespace-nowrap">
                        O:{c.open.toFixed(2)} C:{c.close.toFixed(2)}
                    </div>

                    {/* Pavio (High - Low) */}
                    <div 
                        className={`absolute w-[1px] ${isGreen ? 'bg-green-600' : 'bg-red-600'}`}
                        style={{
                            bottom: `${lowPct}%`,
                            height: `${highPct - lowPct}%`
                        }}
                    />
                    
                    {/* Corpo (Open - Close) */}
                    <div 
                        className={`absolute w-[80%] max-w-[12px] rounded-sm ${isGreen ? 'bg-green-500' : 'bg-red-500'}`}
                        style={{
                            bottom: `${bodyBottom}%`,
                            height: `${bodyHeight}%`
                        }}
                    />
                </div>
            );
        })}
      </div>
    );
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
                <div className="flex items-end gap-2">
                    <span className="text-2xl font-mono font-bold text-slate-800">
                        {currentPrice.toFixed(2)}
                    </span>
                    <span className="text-xs text-slate-400 mb-1">USD</span>
                </div>
              </div>
              <div className="flex gap-2">
                {['M1', 'M5', 'M15'].map((tf) => (
                  <Button 
                    key={tf}
                    variant={timeframe === tf ? "default" : "outline"} 
                    size="sm" 
                    className="text-xs w-12"
                    onClick={() => setTimeframe(tf)}
                  >
                    {tf}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-1 bg-slate-50 relative p-4">
             {renderChart()}
             
            <div className="absolute top-4 left-4 text-xs text-slate-500 bg-white/90 p-2 rounded border shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div> 
                    <span className="font-medium">Live Feed (Simulado)</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                    Velocidade: {timeframe === 'M1' ? '3s' : timeframe === 'M5' ? '10s' : '20s'}/vela
                </div>
            </div>
          </CardContent>
        </Card>

        {/* Control Panel */}
        <div className="space-y-6">
          {/* Signal Card Dinâmico */}
          <Card className={`h-[280px] flex flex-col border-l-4 transition-colors duration-300 ${analysis?.direction === 'CALL' ? 'border-l-green-500' : analysis?.direction === 'PUT' ? 'border-l-red-500' : 'border-l-slate-300'}`}>
            <CardHeader className="pb-2 flex-none">
              <CardTitle className="text-sm font-medium text-slate-500 uppercase">Sugestão da IA</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden flex flex-col">
              {analysis ? (
                  <>
                    <div className="flex items-center justify-between mb-4 flex-none">
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
                        <p className="text-xs text-slate-500">Confiança</p>
                        </div>
                    </div>
                    
                    <div className="space-y-2 overflow-y-auto pr-1 flex-1 custom-scrollbar">
                        {analysis.factors.map((factor, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 border-b border-slate-50 last:border-0">
                                <span className="text-slate-600 flex items-center gap-1 truncate max-w-[150px]">
                                    <ArrowRight className="h-3 w-3 flex-none" /> {factor.label}
                                </span>
                                <span className={`font-medium flex-none ${factor.status === 'POSITIVE' ? 'text-green-600' : factor.status === 'NEGATIVE' ? 'text-red-600' : 'text-slate-400'}`}>
                                    {factor.status === 'POSITIVE' ? 'Alta' : factor.status === 'NEGATIVE' ? 'Baixa' : 'Neutro'}
                                </span>
                            </div>
                        ))}
                        {analysis.factors.length === 0 && (
                            <p className="text-xs text-slate-400 italic mt-4 text-center">Aguardando confluência...</p>
                        )}
                    </div>
                  </>
              ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
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
                    disabled={analysis?.direction === 'PUT'} // Trava oposta
                >
                  <TrendingUp className="mr-2 h-5 w-5" /> CALL
                </Button>
                <Button 
                    variant="danger" 
                    className="w-full h-12 text-lg font-bold disabled:opacity-50"
                    disabled={analysis?.direction === 'CALL'} // Trava oposta
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
