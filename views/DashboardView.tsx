
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
    // M1 = Nova vela a cada 5 segundos
    // M5 = Nova vela a cada 15 segundos
    // M15 = Nova vela a cada 30 segundos
    const candleDuration = timeframe === 'M1' ? 5000 : timeframe === 'M5' ? 15000 : 30000;
    
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