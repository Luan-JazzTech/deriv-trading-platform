
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
    
    // Configuração de Tempo Real (ms)
    // M1 = 60.000ms (1 min)
    // M5 = 300.000ms (5 min)
    // M15 = 900.000ms (15 min)
    const candleDuration = timeframe === 'M1' ? 60000 : timeframe === 'M5' ? 300000 : 900000;
    
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
        time: now - (i * candleDuration),
        open,
        high,
        low,
        close
      });
      price = close;
    }
    setCandles(initialCandles);
    setCurrentPrice(price);

    // Loop de atualização (Tick Rate de 1s)
    const interval = setInterval(() => {
      const currentTime = Date.now();
      const timeSinceLastCandle = currentTime - lastCandleCreationRef.current;
      const shouldCreateNewCandle = timeSinceLastCandle >= candleDuration;

      // Volatilidade do tick atual
      const tickVolatility = timeframe === 'M1' ? 0.5 : timeframe === 'M5' ? 1.5 : 3;
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
            // Mantém tamanho fixo removendo a primeira para não estourar memória
            newHistory = [...prev.slice(1), newCandle]; 
            lastCandleCreationRef.current = currentTime; // Reseta timer
            
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
            
            setCurrentPrice(newClose);
        }

        // Rodar análise técnica a cada tick
        const result = analyzeMarket(newHistory);
        setAnalysis(result);

        return newHistory;
      });

    }, 1000); // Atualiza o preço a cada segundo (Tick real)

    return () => clearInterval(interval);
  }, [timeframe]);

  const getDirectionColor = (dir: string) => {
    if (dir === 'CALL') return 'text-green-600';
    if (dir === 'PUT') return 'text-red-600';
    return 'text-slate-500';
  };

  // Lógica de Renderização do Gráfico (Auto-Scale SVG)
  const renderChart = () => {
    if (candles.length === 0) return null;

    // 1. Encontrar Min e Max da tela atual para escala vertical
    const minPrice = Math.min(...candles.map(c => c.low));
    const maxPrice = Math.max(...candles.map(c => c.high));
    const priceRange = maxPrice - minPrice || 1; // Evita divisão por zero

    // 2. Dimensões do SVG
    const width = 800;
    const height = 300;
    const padding = 20;
    const usableHeight = height - (padding * 2);
    const candleWidth = (width / candles.length) * 0.7;
    const spacing = (width / candles.length);

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Linhas de Grade (Grid) */}
        <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#e2e8f0" strokeDasharray="4" />
        
        {candles.map((candle, index) => {
          // Normaliza o preço para coordenadas Y do SVG (Invertido: 0 é topo)
          const yOpen = height - padding - ((candle.open - minPrice) / priceRange) * usableHeight;
          const yClose = height - padding - ((candle.close - minPrice) / priceRange) * usableHeight;
          const yHigh = height - padding - ((candle.high - minPrice) / priceRange) * usableHeight;
          const yLow = height - padding - ((candle.low - minPrice) / priceRange) * usableHeight;

          const isGreen = candle.close >= candle.open;
          const color = isGreen ? '#22c55e' : '#ef4444'; // Green-500 or Red-500

          const x = index * spacing + (spacing - candleWidth) / 2;

          return (
            <g key={candle.time}>
              {/* Pavio (High/Low) */}
              <line x1={x + candleWidth/2} y1={yHigh} x2={x + candleWidth/2} y2={yLow} stroke={color} strokeWidth="1" />
              {/* Corpo (Open/Close) */}
              <rect 
                x={x} 
                y={Math.min(yOpen, yClose)} 
                width={candleWidth} 
                height={Math.max(1, Math.abs(yClose - yOpen))} 
                fill={color} 
              />
            </g>
          );
        })}

        {/* Linha de Preço Atual */}
        <line 
          x1="0" 
          y1={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight} 
          x2={width} 
          y2={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight} 
          stroke="#3b82f6" 
          strokeWidth="1" 
          strokeDasharray="4"
        />
        <text 
            x={width - 60} 
            y={(height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight) - 5} 
            fill="#3b82f6" 
            fontSize="12"
            fontWeight="bold"
        >
            {currentPrice.toFixed(2)}
        </text>
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{symbol}</h2>
          <div className="flex items-center gap-2 text-slate-500 mt-1">
            <span className={`flex items-center ${analysis?.score && analysis.score > 50 ? 'text-green-600' : 'text-slate-500'}`}>
              <Activity className="h-4 w-4 mr-1" />
              Mercado em tempo real
            </span>
          </div>
        </div>
        <Card className="w-48 bg-slate-900 text-white border-slate-800">
          <CardContent className="p-4">
            <p className="text-xs text-slate-400 font-medium uppercase">Saldo Atual</p>
            <p className="text-2xl font-bold text-green-400">{formatCurrency(balance)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Gráfico (8 colunas) */}
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <Card className="h-[400px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <CardTitle className="text-sm font-medium text-slate-500">Gráfico de Preço (Simulação)</CardTitle>
              <div className="flex gap-2">
                {['M1', 'M5', 'M15'].map((tf) => (
                  <button
                    key={tf}
                    onClick={() => setTimeframe(tf)}
                    className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${
                      timeframe === tf 
                        ? 'bg-slate-900 text-white' 
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-4">
              {renderChart()}
            </CardContent>
          </Card>

           {/* Módulo de Análise (Abaixo do gráfico) */}
           <Card className="border-l-4 border-l-blue-500 min-h-[180px]">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-blue-500" />
                Análise da IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {analysis ? (
                <div className="flex items-start justify-between">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Direção Sugerida</p>
                      <div className="flex items-center gap-2">
                        {analysis.direction === 'CALL' && <TrendingUp className="h-8 w-8 text-green-600" />}
                        {analysis.direction === 'PUT' && <TrendingDown className="h-8 w-8 text-red-600" />}
                        {analysis.direction === 'NEUTRO' && <Activity className="h-8 w-8 text-slate-400" />}
                        <span className={`text-3xl font-black tracking-tighter ${getDirectionColor(analysis.direction)}`}>
                          {analysis.direction}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-500 mb-1">Score de Confluência</p>
                      <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden w-48">
                        <div 
                          className={`h-full transition-all duration-500 ${analysis.score > 50 ? 'bg-green-500' : 'bg-slate-400'}`} 
                          style={{ width: `${analysis.score}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 mt-1 block">{analysis.score}/100</span>
                    </div>
                  </div>

                  {/* Lista de Fatores */}
                  <div className="flex-1 ml-12 border-l pl-6 space-y-2 max-h-[140px] overflow-y-auto">
                    <p className="text-xs font-semibold text-slate-400 uppercase mb-2">Fatores Identificados</p>
                    {analysis.factors.map((factor, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <div className={`w-2 h-2 rounded-full ${
                          factor.status === 'POSITIVE' ? 'bg-green-500' : 
                          factor.status === 'NEGATIVE' ? 'bg-red-500' : 'bg-slate-300'
                        }`} />
                        <span className="text-slate-700">{factor.label}</span>
                        <span className="text-xs text-slate-400 ml-auto font-mono">+{factor.weight}</span>
                      </div>
                    ))}
                    {analysis.factors.length === 0 && (
                      <p className="text-sm text-slate-400 italic">Aguardando dados suficientes...</p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32 text-slate-400 animate-pulse">
                  Calculando confluências...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Painel de Operação (4 colunas) */}
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <Card className="bg-white shadow-lg border-slate-200 h-full flex flex-col">
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Execução de Ordem
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between pt-6">
              <div className="space-y-6">
                
                {/* Stake Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Valor da Entrada ($)</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 20, 50, 100].map(val => (
                      <button 
                        key={val}
                        onClick={() => setStake(val)}
                        className={`py-2 text-xs font-bold rounded border ${
                          stake === val ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        ${val}
                      </button>
                    ))}
                  </div>
                  <div className="relative mt-2">
                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input 
                      type="number" 
                      value={stake}
                      onChange={(e) => setStake(Number(e.target.value))}
                      className="w-full pl-9 h-10 rounded-md border border-slate-300 focus:ring-2 focus:ring-slate-900 focus:outline-none font-mono font-bold text-lg"
                    />
                  </div>
                </div>

                {/* Duration Input */}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Duração (Ticks)</label>
                  <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setDuration(Math.max(1, duration - 1))}
                        className="h-10 w-10 flex items-center justify-center rounded-md border border-slate-300 hover:bg-slate-100"
                    >-</button>
                    <div className="flex-1 h-10 flex items-center justify-center font-bold text-lg border border-slate-200 rounded-md bg-slate-50">
                        {duration} <span className="text-xs font-normal text-slate-400 ml-1">ticks</span>
                    </div>
                    <button 
                        onClick={() => setDuration(duration + 1)}
                        className="h-10 w-10 flex items-center justify-center rounded-md border border-slate-300 hover:bg-slate-100"
                    >+</button>
                  </div>
                </div>

                {/* Profit Info */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-green-700 font-semibold uppercase">Payout Estimado</span>
                    <span className="text-xs text-green-700 font-bold bg-green-200 px-2 py-0.5 rounded-full">95%</span>
                  </div>
                  <div className="text-2xl font-black text-green-800">
                    +{formatCurrency(stake * 0.95)}
                  </div>
                </div>

              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-8">
                <Button 
                    variant="success" 
                    className="h-16 text-lg font-bold flex flex-col leading-tight"
                    onClick={() => alert(`Ordem CALL enviada!\nValor: $${stake}\nDuração: ${duration} ticks`)}
                >
                    <span className="flex items-center gap-1">CALL <TrendingUp className="h-4 w-4" /></span>
                    <span className="text-xs opacity-80 font-normal">Para cima</span>
                </Button>
                <Button 
                    variant="danger" 
                    className="h-16 text-lg font-bold flex flex-col leading-tight"
                    onClick={() => alert(`Ordem PUT enviada!\nValor: $${stake}\nDuração: ${duration} ticks`)}
                >
                    <span className="flex items-center gap-1">PUT <TrendingDown className="h-4 w-4" /></span>
                    <span className="text-xs opacity-80 font-normal">Para baixo</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
