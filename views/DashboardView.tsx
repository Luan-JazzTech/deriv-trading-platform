
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TrendingUp, TrendingDown, DollarSign, Activity, Lock, CheckCircle2, XCircle, AlertTriangle, PlayCircle, Zap, Clock, ShieldAlert } from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { analyzeMarket, Candle, AnalysisResult } from '../lib/analysis/engine';

export function DashboardView() {
  const [balance, setBalance] = useState(1240.50);
  const [symbol] = useState("Volatility 100 (1s)");
  const [stake, setStake] = useState(10);
  const [duration, setDuration] = useState(5);
  const [timeframe, setTimeframe] = useState('M1');

  // Estado da Análise
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [currentPrice, setCurrentPrice] = useState(1050.00);
  const [candles, setCandles] = useState<Candle[]>([]);

  // --- GERENCIAMENTO DE RISCO SNIPER ---
  const [dailyStats, setDailyStats] = useState({
      trades: 0,
      wins: 0,
      losses: 0,
      profit: 0
  });
  
  // Configurações do Robô Sniper
  const RISK_CONFIG = {
      maxTrades: 3,         // Limite de 3 tiros
      stopWin: 50.00,       // Meta de lucro
      stopLoss: -30.00      // Limite de perda
  };

  const isMarketLocked = 
      dailyStats.trades >= RISK_CONFIG.maxTrades || 
      dailyStats.profit >= RISK_CONFIG.stopWin || 
      dailyStats.profit <= RISK_CONFIG.stopLoss;

  // Ref para controlar o tempo
  const lastCandleCreationRef = useRef<number>(Date.now());

  // Simulação de Mercado
  useEffect(() => {
    setCandles([]);
    lastCandleCreationRef.current = Date.now();
    
    // M1 = 60s, M5 = 300s...
    const candleDuration = timeframe === 'M1' ? 60000 : timeframe === 'M5' ? 300000 : 900000;
    
    // Inicializar histórico
    const initialCandles: Candle[] = [];
    let price = 1050.00;
    const now = Date.now();
    const volatilityMultiplier = timeframe === 'M1' ? 1 : timeframe === 'M5' ? 2.5 : 5;

    for (let i = 60; i > 0; i--) {
      const open = price;
      const move = (Math.random() - 0.5) * 5 * volatilityMultiplier;
      const close = price + move;
      
      initialCandles.push({
        time: now - (i * candleDuration),
        open,
        high: Math.max(open, close) + Math.random(),
        low: Math.min(open, close) - Math.random(),
        close
      });
      price = close;
    }
    setCandles(initialCandles);
    setCurrentPrice(price);

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const timeSinceLastCandle = currentTime - lastCandleCreationRef.current;
      const shouldCreateNewCandle = timeSinceLastCandle >= candleDuration;

      const tickVolatility = timeframe === 'M1' ? 0.8 : 2;
      const change = (Math.random() - 0.5) * tickVolatility;

      setCandles(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        let newHistory = [...prev];

        if (shouldCreateNewCandle) {
            const newCandle: Candle = {
                time: currentTime,
                open: last.close, 
                close: last.close + change,
                high: Math.max(last.close, last.close + change),
                low: Math.min(last.close, last.close + change)
            };
            newHistory = [...prev.slice(1), newCandle]; 
            lastCandleCreationRef.current = currentTime;
            setCurrentPrice(newCandle.close);
        } else {
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

        const result = analyzeMarket(newHistory);
        setAnalysis(result);
        return newHistory;
      });
    }, 1000); 

    return () => clearInterval(interval);
  }, [timeframe]);

  const handleTrade = (type: 'CALL' | 'PUT') => {
      if (isMarketLocked) return;

      // SIMULAÇÃO DE RESULTADO (Apenas para testar o Stop Win/Loss)
      const isWin = Math.random() > 0.4; // 60% chance de win simulado
      const profit = isWin ? stake * 0.95 : -stake;

      const newStats = {
          trades: dailyStats.trades + 1,
          wins: isWin ? dailyStats.wins + 1 : dailyStats.wins,
          losses: !isWin ? dailyStats.losses + 1 : dailyStats.losses,
          profit: dailyStats.profit + profit
      };

      setDailyStats(newStats);
      setBalance(prev => prev + profit);

      // Feedback visual
      const msg = isWin ? `WIN! +${formatCurrency(stake * 0.95)}` : `LOSS! -${formatCurrency(stake)}`;
      alert(`Ordem ${type} Finalizada (Simulação)\nResultado: ${msg}`);
  };

  const getDirectionColor = (dir: string) => {
    if (dir === 'CALL') return 'text-green-600';
    if (dir === 'PUT') return 'text-red-600';
    return 'text-slate-400';
  };
  
  const getProbabilityColor = (prob: number) => {
    if (prob >= 80) return 'bg-green-600 text-white';
    if (prob >= 70) return 'bg-blue-600 text-white';
    return 'bg-slate-200 text-slate-500';
  };

  // SVG Chart rendering (mesmo código anterior, simplificado aqui)
  const renderChart = () => {
    if (candles.length === 0) return null;
    const minPrice = Math.min(...candles.map(c => c.low));
    const maxPrice = Math.max(...candles.map(c => c.high));
    const priceRange = maxPrice - minPrice || 1;
    const width = 800; const height = 300; const padding = 40; const usableHeight = height - (padding * 2);
    const candleWidth = (width / candles.length) * 0.6;
    const spacing = (width / candles.length);

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible preserve-3d">
        <line x1="0" y1={height/2} x2={width} y2={height/2} stroke="#f1f5f9" strokeDasharray="4" />
        {candles.map((candle, index) => {
          const normalizeY = (val: number) => height - padding - ((val - minPrice) / priceRange) * usableHeight;
          const yOpen = normalizeY(candle.open); const yClose = normalizeY(candle.close);
          const yHigh = normalizeY(candle.high); const yLow = normalizeY(candle.low);
          const isGreen = candle.close >= candle.open;
          const color = isGreen ? '#10b981' : '#ef4444';
          const x = index * spacing + (spacing - candleWidth) / 2;
          const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
          
          return (
            <g key={candle.time}>
              <line x1={x + candleWidth/2} y1={yHigh} x2={x + candleWidth/2} y2={yLow} stroke={color} strokeWidth="1.5" />
              <rect x={x} y={Math.min(yOpen, yClose)} width={candleWidth} height={bodyHeight} fill={color} rx="1" />
            </g>
          );
        })}
        <line x1="0" y1={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight} x2={width} y2={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" />
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">{symbol}</h2>
          <div className="flex items-center gap-2 text-slate-500 mt-1">
            <span className="flex items-center text-green-600 text-xs font-bold uppercase tracking-wider bg-green-100 px-2 py-0.5 rounded">
              Modo Sniper Ativo
            </span>
          </div>
        </div>
        
        {/* Painel de Metas Diárias */}
        <div className="flex gap-4">
             <Card className="bg-slate-900 text-white border-slate-800 w-40">
                <CardContent className="p-3 text-center">
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Meta Diária</p>
                    <div className="flex justify-center items-baseline gap-1">
                        <span className={dailyStats.profit >= 0 ? "text-green-400 font-bold" : "text-red-400 font-bold"}>
                            {formatCurrency(dailyStats.profit)}
                        </span>
                        <span className="text-[10px] text-slate-500">/ {formatCurrency(RISK_CONFIG.stopWin)}</span>
                    </div>
                    {/* Barra de Progresso */}
                    <div className="w-full bg-slate-800 h-1 mt-1 rounded-full overflow-hidden">
                        <div 
                            className="bg-green-500 h-full transition-all duration-500" 
                            style={{ width: `${Math.min((dailyStats.profit / RISK_CONFIG.stopWin) * 100, 100)}%` }}
                        />
                    </div>
                </CardContent>
             </Card>

             <Card className="bg-white border-slate-200 w-32">
                <CardContent className="p-3 text-center">
                    <p className="text-[10px] text-slate-500 uppercase font-bold">Trades</p>
                    <p className={`font-bold ${dailyStats.trades >= RISK_CONFIG.maxTrades ? 'text-red-600' : 'text-slate-900'}`}>
                        {dailyStats.trades} <span className="text-slate-400 text-xs">/ {RISK_CONFIG.maxTrades}</span>
                    </p>
                </CardContent>
             </Card>
        </div>
      </div>

      {isMarketLocked && (
          <div className="bg-slate-900 text-white p-4 rounded-lg flex items-center justify-between border-l-4 border-red-500 shadow-lg">
              <div className="flex items-center gap-3">
                  <ShieldAlert className="h-6 w-6 text-red-500" />
                  <div>
                      <h4 className="font-bold">Gerenciamento de Risco Ativado</h4>
                      <p className="text-sm text-slate-300">Você atingiu seu limite diário (Trades, Stop Win ou Stop Loss). Volte amanhã.</p>
                  </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>Reiniciar Demo</Button>
          </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-4">
          <Card className="h-[400px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
              <CardTitle className="text-sm font-medium text-slate-500">Gráfico em Tempo Real</CardTitle>
              <div className="flex gap-2">
                {['M1', 'M5', 'M15'].map((tf) => (
                  <button key={tf} onClick={() => setTimeframe(tf)} className={`px-3 py-1 text-xs font-bold rounded-md ${timeframe === tf ? 'bg-slate-900 text-white' : 'bg-slate-100'}`}>{tf}</button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-4">{renderChart()}</CardContent>
          </Card>

          {/* Análise Sniper */}
          <Card className={`border-l-4 min-h-[180px] transition-colors ${analysis?.isSniperReady ? (analysis.direction === 'CALL' ? 'border-l-green-500' : 'border-l-red-500') : 'border-l-slate-200'}`}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Zap className={`h-5 w-5 ${analysis?.isSniperReady ? 'text-yellow-500' : 'text-slate-300'}`} />
                    Análise Sniper IA
                  </CardTitle>
                  <div className="flex items-center gap-1 text-xs text-slate-400 bg-slate-50 px-2 py-1 rounded">
                      <Clock className="h-3 w-3" />
                      <span>Sinal para: <strong>Próxima Vela</strong></span>
                  </div>
              </div>
            </CardHeader>
            <CardContent>
              {analysis ? (
                <div className="flex items-start justify-between">
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-slate-500 mb-1 font-bold uppercase tracking-wider">Direção Confirmada</p>
                      <div className="flex items-center gap-2">
                        {analysis.direction === 'CALL' && <TrendingUp className="h-8 w-8 text-green-600" />}
                        {analysis.direction === 'PUT' && <TrendingDown className="h-8 w-8 text-red-600" />}
                        {analysis.direction === 'NEUTRO' && <Lock className="h-8 w-8 text-slate-300" />}
                        <span className={`text-4xl font-black tracking-tighter ${getDirectionColor(analysis.direction)}`}>
                          {analysis.direction}
                        </span>
                      </div>
                    </div>
                    
                    <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold shadow-sm ${getProbabilityColor(analysis.probability)}`}>
                        {analysis.probability}% Probabilidade
                    </div>
                  </div>

                  <div className="flex-1 ml-12 border-l pl-6 space-y-2 max-h-[140px] overflow-y-auto">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase">Filtros de Entrada</p>
                    </div>
                    {analysis.factors.map((factor, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-sm">
                        <div className={`w-2 h-2 rounded-full ${factor.status === 'POSITIVE' ? 'bg-green-500' : factor.status === 'NEGATIVE' ? 'bg-red-500' : 'bg-slate-300'}`} />
                        <span className="text-slate-700 font-medium">{factor.label}</span>
                      </div>
                    ))}
                    {!analysis.isSniperReady && (
                        <p className="text-xs text-orange-500 font-medium mt-2 bg-orange-50 p-2 rounded border border-orange-100">
                            ⚠️ Aguardando oportunidade de alta probabilidade...
                        </p>
                    )}
                  </div>
                </div>
              ) : <div className="animate-pulse text-slate-400">Analisando mercado...</div>}
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-4">
          <Card className="bg-white shadow-lg border-slate-200 h-full flex flex-col relative overflow-hidden">
            {isMarketLocked && <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px] z-50 flex items-center justify-center text-white font-bold text-lg cursor-not-allowed">Painel Bloqueado</div>}
            
            <CardHeader className="bg-slate-50 border-b">
              <CardTitle className="text-base flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-green-600" />
                Painel de Execução
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-between pt-6">
              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-600">Entrada Fixa</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input type="number" value={stake} onChange={(e) => setStake(Number(e.target.value))} className="w-full pl-9 h-10 rounded-md border border-slate-300 font-mono font-bold text-lg" />
                  </div>
                </div>

                <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                    <div className="flex justify-between">
                        <span className="text-xs text-green-700 font-bold uppercase">Payout</span>
                        <span className="text-xs font-bold text-green-700">95%</span>
                    </div>
                    <div className="text-2xl font-black text-green-800">+{formatCurrency(stake * 0.95)}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-8">
                <Button 
                    variant="success" 
                    className={`h-16 text-lg font-bold flex flex-col leading-tight ${analysis?.direction !== 'CALL' ? 'opacity-50 grayscale' : ''}`}
                    onClick={() => handleTrade('CALL')}
                    disabled={isMarketLocked}
                >
                    <span className="flex items-center gap-1">CALL <TrendingUp className="h-4 w-4" /></span>
                </Button>
                <Button 
                    variant="danger" 
                    className={`h-16 text-lg font-bold flex flex-col leading-tight ${analysis?.direction !== 'PUT' ? 'opacity-50 grayscale' : ''}`}
                    onClick={() => handleTrade('PUT')}
                    disabled={isMarketLocked}
                >
                    <span className="flex items-center gap-1">PUT <TrendingDown className="h-4 w-4" /></span>
                </Button>
              </div>
              <p className="text-xs text-center text-slate-400 mt-2">Botões destacados apenas se alinhados com a IA.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
