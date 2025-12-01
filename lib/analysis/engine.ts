
import { calculateEMA, calculateRSI, calculateBollingerBands } from './indicators';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AnalysisFactor {
  label: string;
  weight: number; 
  status: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
}

export interface AnalysisResult {
  direction: 'CALL' | 'PUT' | 'NEUTRO';
  score: number;
  probability: number;
  factors: AnalysisFactor[];
  timestamp: number;
  isSniperReady: boolean;
}

export function analyzeMarket(candles: Candle[]): AnalysisResult {
  // Proteção robusta contra arrays vazios ou insuficientes
  if (!candles || candles.length < 52) {
    return { direction: 'NEUTRO', score: 0, probability: 50, factors: [], timestamp: Date.now(), isSniperReady: false };
  }

  const confirmedCandles = candles.slice(0, -1);
  if (confirmedCandles.length === 0) {
      return { direction: 'NEUTRO', score: 0, probability: 50, factors: [], timestamp: Date.now(), isSniperReady: false };
  }

  const lastClosed = confirmedCandles[confirmedCandles.length - 1];
  
  // Garantia de que lastClosed existe
  if (!lastClosed) {
      return { direction: 'NEUTRO', score: 0, probability: 50, factors: [], timestamp: Date.now(), isSniperReady: false };
  }

  const closes = confirmedCandles.map(c => c.close);

  const factors: AnalysisFactor[] = [];
  let callScore = 0;
  let putScore = 0;

  // --- 1. FILTRO DE LATERALIZAÇÃO ---
  const bb = calculateBollingerBands(closes, 20, 2);
  let isSqueezed = false;
  
  if (bb) {
    const bandwidth = (bb.upper - bb.lower) / bb.middle;
    if (bandwidth < 0.0008) { 
        isSqueezed = true;
        factors.push({ label: '⚠️ Mercado Lateral (Perigoso)', weight: -100, status: 'NEUTRAL' });
    }
  }

  // --- 2. FILTRO DE TENDÊNCIA MACRO ---
  const ema20 = calculateEMA(closes, 20);
  const ema50 = calculateEMA(closes, 50);
  
  const curEma20 = ema20[ema20.length - 1] || 0;
  const curEma50 = ema50[ema50.length - 1] || 0;

  let trend: 'UP' | 'DOWN' | 'FLAT' = 'FLAT';

  if (curEma20 > curEma50 && lastClosed.close > curEma50) {
      trend = 'UP';
      callScore += 20;
      factors.push({ label: 'Tendência Macro de ALTA (Sniper)', weight: 20, status: 'POSITIVE' });
  } else if (curEma20 < curEma50 && lastClosed.close < curEma50) {
      trend = 'DOWN';
      putScore += 20;
      factors.push({ label: 'Tendência Macro de BAIXA (Sniper)', weight: 20, status: 'NEGATIVE' });
  } else {
      factors.push({ label: 'Tendência Indefinida', weight: 0, status: 'NEUTRAL' });
  }

  if (isSqueezed) {
      return { direction: 'NEUTRO', score: 0, probability: 50, factors, timestamp: Date.now(), isSniperReady: false };
  }

  // --- 3. GATILHOS ---
  const rsi = calculateRSI(closes, 14);
  
  if (trend === 'UP') {
      if (rsi < 40) { 
          callScore += 30;
          factors.push({ label: 'Oportunidade: Pullback de Alta (RSI)', weight: 30, status: 'POSITIVE' });
      }
      if (bb && lastClosed.low <= bb.lower) {
          callScore += 35;
          factors.push({ label: 'Preço barato na tendência (Banda Inf)', weight: 35, status: 'POSITIVE' });
      }
      if (lastClosed.close > lastClosed.open) callScore += 10; 
  }

  if (trend === 'DOWN') {
      if (rsi > 60) {
          putScore += 30;
          factors.push({ label: 'Oportunidade: Pullback de Baixa (RSI)', weight: 30, status: 'NEGATIVE' });
      }
      if (bb && lastClosed.high >= bb.upper) {
          putScore += 35;
          factors.push({ label: 'Preço caro na tendência (Banda Sup)', weight: 35, status: 'NEGATIVE' });
      }
      if (lastClosed.close < lastClosed.open) putScore += 10;
  }

  let direction: 'CALL' | 'PUT' | 'NEUTRO' = 'NEUTRO';
  let finalScore = 0;
  const SNIPER_THRESHOLD = 50; 

  if (trend === 'UP' && callScore >= SNIPER_THRESHOLD) {
      direction = 'CALL';
      finalScore = callScore;
  } else if (trend === 'DOWN' && putScore >= SNIPER_THRESHOLD) {
      direction = 'PUT';
      finalScore = putScore;
  }

  let probability = 50 + (finalScore * 0.5);
  if (direction === 'NEUTRO') probability = 50;
  if (probability > 95) probability = 95;

  return {
    direction,
    score: finalScore,
    probability: Math.round(probability),
    factors,
    timestamp: Date.now(),
    isSniperReady: probability >= 75
  };
}
