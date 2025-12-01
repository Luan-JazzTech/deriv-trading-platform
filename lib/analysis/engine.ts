
import { calculateEMA, calculateRSI, checkEngulfing } from './indicators';

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface AnalysisFactor {
  label: string;
  weight: number; // Peso na decisão final (0-100)
  status: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  value?: string | number;
}

export interface AnalysisResult {
  direction: 'CALL' | 'PUT' | 'NEUTRO';
  score: number; // 0 a 100
  factors: AnalysisFactor[];
  timestamp: number;
}

export function analyzeMarket(candles: Candle[]): AnalysisResult {
  if (candles.length < 20) {
    return { direction: 'NEUTRO', score: 0, factors: [], timestamp: Date.now() };
  }

  const closes = candles.map(c => c.close);
  const lastCandle = candles[candles.length - 1];
  const prevCandle = candles[candles.length - 2];

  const factors: AnalysisFactor[] = [];
  let bullishScore = 0;
  let bearishScore = 0;

  // 1. Analisar Tendência (EMA 20 vs EMA 50)
  // Como é simulação rápida, usaremos períodos curtos: EMA 9 vs EMA 21
  const emaFastArr = calculateEMA(closes, 9);
  const emaSlowArr = calculateEMA(closes, 21);
  const lastFast = emaFastArr[emaFastArr.length - 1];
  const lastSlow = emaSlowArr[emaSlowArr.length - 1];

  if (lastFast > lastSlow) {
    bullishScore += 30;
    factors.push({ label: 'Tendência (EMA 9 > 21)', weight: 30, status: 'POSITIVE' });
  } else {
    bearishScore += 30;
    factors.push({ label: 'Tendência (EMA 9 < 21)', weight: 30, status: 'NEGATIVE' });
  }

  // 2. Analisar RSI
  const rsi = calculateRSI(closes, 14);
  if (rsi < 30) {
    bullishScore += 25; // Sobrevenda -> Possível Reversão Alta
    factors.push({ label: `RSI Sobrevendido (${rsi.toFixed(1)})`, weight: 25, status: 'POSITIVE' });
  } else if (rsi > 70) {
    bearishScore += 25; // Sobrecompra -> Possível Reversão Baixa
    factors.push({ label: `RSI Sobrecomprado (${rsi.toFixed(1)})`, weight: 25, status: 'NEGATIVE' });
  } else {
    factors.push({ label: `RSI Neutro (${rsi.toFixed(1)})`, weight: 0, status: 'NEUTRAL' });
  }

  // 3. Padrão de Candle (Engolfo)
  const pattern = checkEngulfing(prevCandle.open, prevCandle.close, lastCandle.open, lastCandle.close);
  if (pattern === 'BULLISH') {
    bullishScore += 20;
    factors.push({ label: 'Padrão Engolfo de Alta', weight: 20, status: 'POSITIVE' });
  } else if (pattern === 'BEARISH') {
    bearishScore += 20;
    factors.push({ label: 'Padrão Engolfo de Baixa', weight: 20, status: 'NEGATIVE' });
  }

  // 4. Decisão Final
  // Se Score > 60, temos um sinal
  let direction: 'CALL' | 'PUT' | 'NEUTRO' = 'NEUTRO';
  let finalScore = 0;

  if (bullishScore > bearishScore) {
    finalScore = bullishScore;
    if (finalScore >= 50) direction = 'CALL';
  } else {
    finalScore = bearishScore;
    if (finalScore >= 50) direction = 'PUT';
  }

  // Normaliza score máximo visual
  if (finalScore > 99) finalScore = 99;

  return {
    direction,
    score: finalScore,
    factors,
    timestamp: Date.now()
  };
}
