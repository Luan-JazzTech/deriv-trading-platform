
import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { TrendingUp, TrendingDown, DollarSign, Activity, Lock, Zap, Clock, ShieldAlert, ChevronDown, Globe, Bitcoin, Box, Layers, BarChart3, Target } from 'lucide-react';
import { formatCurrency, cn } from '../lib/utils';
import { analyzeMarket, Candle, AnalysisResult } from '../lib/analysis/engine';

// --- CONFIGURAÇÃO DE ATIVOS (DERIV COMPLETA) ---
const AVAILABLE_ASSETS = [
  // --- SINTÉTICOS (VOLATILITY) ---
  { id: 'R_100', name: 'Volatility 100 (1s)', basePrice: 1240.50, volatility: 2.0, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'R_75', name: 'Volatility 75 (1s)', basePrice: 450.25, volatility: 1.5, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'R_50', name: 'Volatility 50 (1s)', basePrice: 280.10, volatility: 0.8, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'R_25', name: 'Volatility 25 (1s)', basePrice: 1050.00, volatility: 1.2, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'R_10', name: 'Volatility 10 (1s)', basePrice: 1800.50, volatility: 1.0, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  
  // --- SINTÉTICOS (JUMP/STEP) ---
  { id: 'JUMP_10', name: 'Jump 10 Index', basePrice: 150.00, volatility: 3.5, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'BEAR', name: 'Bear Market Index', basePrice: 980.00, volatility: 1.1, type: 'synthetic', decimals: 2, group: 'Derived Indices' },
  { id: 'BULL', name: 'Bull Market Index', basePrice: 1020.00, volatility: 1.1, type: 'synthetic', decimals: 2, group: 'Derived Indices' },

  // --- FOREX MAJORS ---
  { id: 'frxEURUSD', name: 'EUR/USD', basePrice: 1.0850, volatility: 0.00015, type: 'forex', decimals: 5, group: 'Forex Majors' },
  { id: 'frxGBPUSD', name: 'GBP/USD', basePrice: 1.2730, volatility: 0.00020, type: 'forex', decimals: 5, group: 'Forex Majors' },
  { id: 'frxUSDJPY', name: 'USD/JPY', basePrice: 155.40, volatility: 0.05, type: 'forex', decimals: 3, group: 'Forex Majors' },
  { id: 'frxAUDUSD', name: 'AUD/USD', basePrice: 0.6650, volatility: 0.00015, type: 'forex', decimals: 5, group: 'Forex Majors' },
  
  // --- COMMODITIES ---
  { id: 'frxXAUUSD', name: 'Gold / USD', basePrice: 2350.00, volatility: 1.5, type: 'commodities', decimals: 2, group: 'Commodities' },
  { id: 'frxXAGUSD', name: 'Silver / USD', basePrice: 30.50, volatility: 0.05, type: 'commodities', decimals: 3, group: 'Commodities' },
  { id: 'frxOILUSD', name: 'Oil / USD', basePrice: 82.40, volatility: 0.10, type: 'commodities', decimals: 2, group: 'Commodities' },

  // --- CRYPTO ---
  { id: 'cryBTCUSD', name: 'BTC/USD', basePrice: 64250.00, volatility: 45.0, type: 'crypto', decimals: 2, group: 'Cryptocurrencies' },
  { id: 'cryETHUSD', name: 'ETH/USD', basePrice: 3450.00, volatility: 5.0, type: 'crypto', decimals: 2, group: 'Cryptocurrencies' },
  { id: 'cryLTCUSD', name: 'LTC/USD', basePrice: 85.00, volatility: 0.5, type: 'crypto', decimals: 2, group: 'Cryptocurrencies' },
];

export function DashboardView() {
  const [balance, setBalance] = useState(1240.50);
  const [activeAsset, setActiveAsset] = useState(AVAILABLE_ASSETS[0]);
  const [stake, setStake] = useState(10);
  const [timeframe, setTimeframe] = useState('M1');
  
  // Estado da Análise
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [currentPrice, setCurrentPrice] = useState(activeAsset.basePrice);
  const [candles, setCandles] = useState<Candle[]>([]);

  // --- GERENCIAMENTO DE RISCO SNIPER ---
  const [dailyStats, setDailyStats] = useState({ trades: 0, wins: 0, losses: 0, profit: 0 });
  const RISK_CONFIG = { maxTrades: 3, stopWin: 50.00, stopLoss: -30.00 };
  const isMarketLocked = dailyStats.trades >= RISK_CONFIG.maxTrades || dailyStats.profit >= RISK_CONFIG.stopWin || dailyStats.profit <= RISK_CONFIG.stopLoss;

  const lastCandleCreationRef = useRef<number>(Date.now());

  // Simulação de Mercado
  useEffect(() => {
    setCandles([]); setAnalysis(null); lastCandleCreationRef.current = Date.now();
    const candleDuration = timeframe === 'M1' ? 60000 : timeframe === 'M5' ? 300000 : 900000;
    
    // Inicialização do Histórico
    const initialCandles: Candle[] = [];
    let price = activeAsset.basePrice;
    const now = Date.now();
    const volatilityMultiplier = (timeframe === 'M1' ? 1 : timeframe === 'M5' ? 2.5 : 5) * activeAsset.volatility;

    for (let i = 80; i > 0; i--) {
      const open = price;
      const move = (Math.random() - 0.5) * 5 * volatilityMultiplier;
      const close = price + move;
      const bodyMax = Math.max(open, close);
      const bodyMin = Math.min(open, close);
      initialCandles.push({
        time: now - (i * candleDuration),
        open,
        close,
        high: bodyMax + (Math.random() * volatilityMultiplier * 0.5),
        low: bodyMin - (Math.random() * volatilityMultiplier * 0.5)
      });
      price = close;
    }
    setCandles(initialCandles);
    setCurrentPrice(price);

    const interval = setInterval(() => {
      const currentTime = Date.now();
      const timeSinceLastCandle = currentTime - lastCandleCreationRef.current;
      const shouldCreateNewCandle = timeSinceLastCandle >= candleDuration;
      const tickVolatility = (timeframe === 'M1' ? 0.8 : 2) * activeAsset.volatility;
      const change = (Math.random() - 0.5) * tickVolatility;

      setCandles(prev => {
        if (prev.length === 0) return prev;
        const last = prev[prev.length - 1];
        let newHistory = [...prev];

        if (shouldCreateNewCandle) {
            const newCandle: Candle = {
                time: currentTime, open: last.close, close: last.close + change,
                high: Math.max(last.close, last.close + change), low: Math.min(last.close, last.close + change)
            };
            newHistory = [...prev.slice(1), newCandle]; 
            lastCandleCreationRef.current = currentTime;
            setCurrentPrice(newCandle.close);
        } else {
            const newClose = last.close + change;
            const updatedLast = { 
                ...last, close: newClose,
                high: Math.max(last.high, newClose), low: Math.min(last.low, newClose) 
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
  }, [timeframe, activeAsset]);

  const handleTrade = (type: 'CALL' | 'PUT') => {
      if (isMarketLocked) return;
      const isWin = Math.random() > 0.4; 
      const profit = isWin ? stake * 0.95 : -stake;
      const newStats = {
          trades: dailyStats.trades + 1,
          wins: isWin ? dailyStats.wins + 1 : dailyStats.wins,
          losses: !isWin ? dailyStats.losses + 1 : dailyStats.losses,
          profit: dailyStats.profit + profit
      };
      setDailyStats(newStats);
      setBalance(prev => prev + profit);
  };

  const getAssetIcon = (type: string) => {
    switch(type) {
      case 'crypto': return <Bitcoin className="h-5 w-5 text-orange-500" />;
      case 'forex': return <Globe className="h-5 w-5 text-blue-500" />;
      case 'commodities': return <Box className="h-5 w-5 text-yellow-500" />;
      default: return <Activity className="h-5 w-5 text-purple-500" />;
    }
  };

  // --- RENDERIZADOR DE GRÁFICO (DARK THEME) ---
  const renderChart = () => {
    if (candles.length === 0) return <div className="h-full flex items-center justify-center text-slate-500">Carregando mercado...</div>;
    const minPrice = Math.min(...candles.map(c => c.low));
    const maxPrice = Math.max(...candles.map(c => c.high));
    const priceRange = maxPrice - minPrice || 1;
    const width = 800; const height = 350; const padding = 40; const usableHeight = height - (padding * 2);
    const candleWidth = (width / candles.length) * 0.7;
    const spacing = (width / candles.length);
    const formatPrice = (p: number) => p.toFixed(activeAsset.decimals);

    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="overflow-visible preserve-3d bg-[#0f172a] rounded-lg">
        {/* Grid Background */}
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />

        {candles.map((candle, index) => {
          const normalizeY = (val: number) => height - padding - ((val - minPrice) / priceRange) * usableHeight;
          const yOpen = normalizeY(candle.open); const yClose = normalizeY(candle.close);
          const yHigh = normalizeY(candle.high); const yLow = normalizeY(candle.low);
          const isGreen = candle.close >= candle.open;
          const color = isGreen ? '#22c55e' : '#ef4444'; // Green-500 / Red-500
          const x = index * spacing + (spacing - candleWidth) / 2;
          const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
          
          return (
            <g key={candle.time}>
              <line x1={x + candleWidth/2} y1={yHigh} x2={x + candleWidth/2} y2={yLow} stroke={color} strokeWidth="1" opacity="0.8" />
              <rect x={x} y={Math.min(yOpen, yClose)} width={candleWidth} height={bodyHeight} fill={color} rx="1" stroke={color} strokeWidth="0.5" />
            </g>
          );
        })}
        
        {/* Linha de Preço Atual */}
        <line x1="0" y1={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight} x2={width} y2={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4" opacity="0.8" />
        <rect x={width - 60} y={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight - 10} width="60" height="20" fill="#3b82f6" rx="2" />
        <text x={width - 30} y={height - padding - ((currentPrice - minPrice) / priceRange) * usableHeight} fill="white" fontSize="11" fontWeight="bold" textAnchor="middle" alignmentBaseline="middle">
            {formatPrice(currentPrice)}
        </text>
      </svg>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* --- HUD HEADER --- */}
      <div className="flex flex-col lg:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-slate-200">
        
        {/* ASSET SELECTOR */}
        <div className="relative group w-full lg:w-auto min-w-[300px]">
          <label className="text-[10px] uppercase font-bold text-slate-400 absolute -top-2 left-2 bg-white px-1">Ativo Selecionado</label>
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            {getAssetIcon(activeAsset.type)}
          </div>
          <select 
            value={activeAsset.id}
            onChange={(e) => setActiveAsset(AVAILABLE_ASSETS.find(a => a.id === e.target.value) || AVAILABLE_ASSETS[0])}
            className="w-full appearance-none bg-slate-50 text-slate-900 text-lg font-bold py-3 pl-12 pr-10 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900 transition-all shadow-inner"
          >
            {['Derived Indices', 'Forex Majors', 'Commodities', 'Cryptocurrencies'].map(group => (
              <optgroup key={group} label={group}>
                {AVAILABLE_ASSETS.filter(a => a.group === group).map(asset => (
                  <option key={asset.id} value={asset.id}>{asset.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 pointer-events-none" />
        </div>

        {/* RISK STATS HUD */}
        <div className="flex items-center gap-2 bg-slate-900 text-white p-1 rounded-lg shadow-md">
            <div className="px-4 py-1 border-r border-slate-700">
                <p className="text-[9px] uppercase text-slate-400 font-bold">Saldo Demo</p>
                <p className="text-sm font-bold text-green-400">{formatCurrency(balance)}</p>
            </div>
            <div className="px-4 py-1 border-r border-slate-700">
                <p className="text-[9px] uppercase text-slate-400 font-bold">Meta do Dia</p>
                <div className="flex items-center gap-2">
                    <p className={`text-sm font-bold ${dailyStats.profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {formatCurrency(dailyStats.profit)}
                    </p>
                    <span className="text-[10px] text-slate-500">/ {formatCurrency(RISK_CONFIG.stopWin)}</span>
                </div>
            </div>
            <div className="px-4 py-1">
                <p className="text-[9px] uppercase text-slate-400 font-bold">Trades</p>
                <div className="flex items-center gap-1">
                    <p className={`text-sm font-bold ${dailyStats.trades >= RISK_CONFIG.maxTrades ? 'text-red-500' : 'text-white'}`}>
                        {dailyStats.trades}
                    </p>
                    <span className="text-[10px] text-slate-500">/ {RISK_CONFIG.maxTrades}</span>
                </div>
            </div>
        </div>
      </div>

      {isMarketLocked && (
          <div className="bg-red-50 text-red-900 p-4 rounded-lg flex items-center justify-between border border-red-200 shadow-sm animate-pulse">
              <div className="flex items-center gap-3">
                  <ShieldAlert className="h-6 w-6 text-red-600" />
                  <div>
                      <h4 className="font-bold">Gerenciamento de Risco Ativado</h4>
                      <p className="text-sm opacity-90">Meta atingida ou limite de perdas alcançado. Respeite seu gerenciamento.</p>
                  </div>
              </div>
              <Button variant="secondary" size="sm" onClick={() => window.location.reload()} className="bg-white border hover:bg-red-50">Reiniciar Demo</Button>
          </div>
      )}

      <div className="grid grid-cols-12 gap-6 h-[calc(100vh-220px)]">
        {/* --- COLUNA PRINCIPAL (GRÁFICO) --- */}
        <div className="col-span-12 lg:col-span-9 flex flex-col gap-4 h-full">
          <Card className="flex-1 flex flex-col bg-white border-slate-200 shadow-md overflow-hidden">
            <div className="flex flex-row items-center justify-between p-4 border-b bg-slate-50">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-slate-500" />
                <span className="font-bold text-slate-700">Análise Gráfica</span>
              </div>
              <div className="flex bg-white rounded-md border border-slate-200 p-1">
                {['M1', 'M5', 'M15'].map((tf) => (
                  <button 
                    key={tf} 
                    onClick={() => setTimeframe(tf)} 
                    className={cn(
                        "px-3 py-1 text-xs font-bold rounded transition-colors",
                        timeframe === tf ? "bg-slate-900 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-1 bg-slate-950 p-4 relative">
                {renderChart()}
                <div className="absolute top-6 left-6 flex items-center gap-2 px-3 py-1 bg-slate-800/80 rounded backdrop-blur-sm text-xs text-white border border-slate-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Mercado Aberto
                </div>
            </div>
          </Card>

          {/* --- PAINEL DE SINAL (SNIPER) --- */}
          <Card className={cn(
              "border-l-4 shadow-md transition-all h-[200px]",
              analysis?.isSniperReady 
                ? (analysis.direction === 'CALL' ? 'border-l-green-500 bg-green-50/50' : 'border-l-red-500 bg-red-50/50') 
                : 'border-l-slate-300 bg-white'
          )}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className={cn("p-2 rounded-lg", analysis?.isSniperReady ? "bg-yellow-100 text-yellow-700" : "bg-slate-100 text-slate-400")}>
                        <Zap className="h-5 w-5" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-bold">Sniper IA</CardTitle>
                        <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Engine v2.0</p>
                    </div>
                  </div>
                  {analysis?.isSniperReady && (
                      <div className="flex items-center gap-1 text-xs font-bold text-white bg-slate-900 px-3 py-1 rounded-full shadow-lg animate-bounce">
                          <Target className="h-3 w-3" />
                          ENTRADA CONFIRMADA
                      </div>
                  )}
              </div>
            </CardHeader>
            <CardContent className="pt-2">
              {analysis ? (
                <div className="flex items-center justify-between gap-8">
                  {/* Direção */}
                  <div className="flex flex-col items-center min-w-[120px]">
                      <span className="text-[10px] font-bold uppercase text-slate-400 mb-1">Direção</span>
                      <div className={cn(
                          "text-4xl font-black tracking-tighter flex items-center gap-1",
                          analysis.direction === 'CALL' ? 'text-green-600 drop-shadow-sm' : 
                          analysis.direction === 'PUT' ? 'text-red-600 drop-shadow-sm' : 'text-slate-300'
                      )}>
                          {analysis.direction === 'CALL' && <TrendingUp className="h-8 w-8" />}
                          {analysis.direction === 'PUT' && <TrendingDown className="h-8 w-8" />}
                          {analysis.direction === 'NEUTRO' && <Lock className="h-8 w-8" />}
                          {analysis.direction}
                      </div>
                  </div>

                  {/* Probabilidade */}
                  <div className="flex flex-col items-center">
                      <span className="text-[10px] font-bold uppercase text-slate-400 mb-2">Assertividade</span>
                      <div className="relative h-16 w-16 flex items-center justify-center">
                          <svg className="absolute top-0 left-0 w-full h-full transform -rotate-90">
                              <circle cx="32" cy="32" r="28" stroke="#e2e8f0" strokeWidth="6" fill="none" />
                              <circle 
                                cx="32" cy="32" r="28" stroke={analysis.probability >= 80 ? "#22c55e" : "#3b82f6"} strokeWidth="6" fill="none" 
                                strokeDasharray={175} strokeDashoffset={175 - (175 * analysis.probability) / 100}
                                className="transition-all duration-1000 ease-out"
                              />
                          </svg>
                          <span className="text-sm font-bold text-slate-700">{analysis.probability}%</span>
                      </div>
                  </div>

                  {/* Lista de Fatores */}
                  <div className="flex-1 h-[100px] overflow-y-auto pr-2 border-l pl-6 space-y-2">
                    <span className="text-[10px] font-bold uppercase text-slate-400 sticky top-0 bg-inherit">Confluências</span>
                    {analysis.factors.map((factor, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs border-b border-slate-100 pb-1 last:border-0">
                        <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", 
                            factor.status === 'POSITIVE' ? 'bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 
                            factor.status === 'NEGATIVE' ? 'bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]' : 'bg-slate-300'
                        )} />
                        <span className="text-slate-600 font-medium leading-tight">{factor.label}</span>
                      </div>
                    ))}
                    {!analysis.isSniperReady && (
                        <p className="text-xs text-orange-600 font-bold mt-2 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Aguardando gatilho...
                        </p>
                    )}
                  </div>
                </div>
              ) : <div className="text-center py-8 text-slate-400">Carregando IA...</div>}
            </CardContent>
          </Card>
        </div>

        {/* --- COLUNA LATERAL (EXECUÇÃO) --- */}
        <div className="col-span-12 lg:col-span-3 h-full">
          <Card className="h-full flex flex-col bg-white shadow-lg border-slate-200 relative overflow-hidden">
             {isMarketLocked && <div className="absolute inset-0 bg-slate-900/80 z-20 flex flex-col items-center justify-center text-white text-center p-4">
                 <ShieldAlert className="h-12 w-12 text-red-500 mb-2" />
                 <h3 className="font-bold text-lg">Bloqueado</h3>
                 <p className="text-sm text-slate-300">Volte amanhã Sniper.</p>
             </div>}

             <div className="p-4 bg-slate-900 text-white text-center">
                 <h3 className="font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2">
                     <Layers className="h-4 w-4 text-green-400" /> Ordem Rápida
                 </h3>
             </div>

             <CardContent className="flex-1 flex flex-col p-6 gap-6">
                <div className="space-y-4">
                    <label className="text-xs font-bold text-slate-500 uppercase">Valor da Entrada</label>
                    <div className="relative group">
                        <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400 group-focus-within:text-green-600 transition-colors" />
                        <input 
                            type="number" 
                            value={stake} 
                            onChange={(e) => setStake(Number(e.target.value))} 
                            className="w-full h-14 pl-10 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-2xl font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                        />
                    </div>
                    <div className="flex justify-between text-xs font-medium text-slate-400 px-1">
                        <span>Min: $0.35</span>
                        <span>Payout: <span className="text-green-600 font-bold">95%</span></span>
                    </div>
                </div>

                <div className="bg-green-50 border border-green-100 p-4 rounded-xl text-center space-y-1">
                    <span className="text-xs font-bold text-green-700 uppercase">Lucro Previsto</span>
                    <div className="text-3xl font-black text-green-600 tracking-tight">+{formatCurrency(stake * 0.95)}</div>
                </div>

                <div className="flex-1 grid grid-rows-2 gap-3 mt-4">
                    <Button 
                        className={cn(
                            "h-full text-xl font-black flex flex-col items-center justify-center gap-1 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                            analysis?.direction === 'CALL' 
                                ? "bg-green-600 hover:bg-green-500 text-white ring-4 ring-green-100" 
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        )}
                        onClick={() => handleTrade('CALL')}
                        disabled={isMarketLocked}
                    >
                        <span className="flex items-center gap-2">CALL <TrendingUp className="h-5 w-5" /></span>
                    </Button>

                    <Button 
                        className={cn(
                            "h-full text-xl font-black flex flex-col items-center justify-center gap-1 rounded-xl shadow-lg transition-all transform hover:scale-[1.02] active:scale-[0.98]",
                            analysis?.direction === 'PUT' 
                                ? "bg-red-600 hover:bg-red-500 text-white ring-4 ring-red-100" 
                                : "bg-slate-100 text-slate-400 hover:bg-slate-200"
                        )}
                        onClick={() => handleTrade('PUT')}
                        disabled={isMarketLocked}
                    >
                        <span className="flex items-center gap-2">PUT <TrendingDown className="h-5 w-5" /></span>
                    </Button>
                </div>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
