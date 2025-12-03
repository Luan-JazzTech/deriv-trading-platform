// lib/analysis/indicators.ts
/**
 * INDICADORES TÉCNICOS PROFISSIONAIS
 * 
 * Implementação precisa de indicadores usados por traders profissionais:
 * - RSI (Relative Strength Index)
 * - MACD (Moving Average Convergence Divergence)
 * - Bollinger Bands
 * - EMA (Exponential Moving Average)
 * - SMA (Simple Moving Average)
 * - ATR (Average True Range)
 * - Stochastic Oscillator
 */

export interface Candle {
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
    time: number;
}

// ========================================
// RSI - Relative Strength Index
// ========================================

export function calculateRSI(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 50; // Neutro se não tem dados suficientes

    const closes = candles.map(c => c.close);
    let gains = 0;
    let losses = 0;

    // Calcular primeira média
    for (let i = 1; i <= period; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change;
        else losses += Math.abs(change);
    }

    let avgGain = gains / period;
    let avgLoss = losses / period;

    // Suavizar (smoothed RSI)
    for (let i = period + 1; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) {
            avgGain = (avgGain * (period - 1) + change) / period;
            avgLoss = (avgLoss * (period - 1)) / period;
        } else {
            avgGain = (avgGain * (period - 1)) / period;
            avgLoss = (avgLoss * (period - 1) + Math.abs(change)) / period;
        }
    }

    if (avgLoss === 0) return 100;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
}

export function getRSISignal(rsi: number): { signal: 'CALL' | 'PUT' | 'NEUTRAL'; strength: number } {
    if (rsi < 30) return { signal: 'CALL', strength: (30 - rsi) / 30 }; // Oversold
    if (rsi > 70) return { signal: 'PUT', strength: (rsi - 70) / 30 }; // Overbought
    return { signal: 'NEUTRAL', strength: 0 };
}

// ========================================
// EMA - Exponential Moving Average
// ========================================

export function calculateEMA(candles: Candle[], period: number): number {
    if (candles.length < period) return candles[candles.length - 1].close;

    const closes = candles.map(c => c.close);
    const multiplier = 2 / (period + 1);
    
    // Primeira EMA é uma SMA
    let ema = closes.slice(0, period).reduce((sum, val) => sum + val, 0) / period;

    // Calcular EMA para o restante
    for (let i = period; i < closes.length; i++) {
        ema = (closes[i] - ema) * multiplier + ema;
    }

    return ema;
}

export function getEMACrossSignal(ema20: number, ema50: number, prevEma20: number, prevEma50: number): {
    signal: 'CALL' | 'PUT' | 'NEUTRAL';
    strength: number;
} {
    // Golden Cross: EMA curta cruza acima da EMA longa
    if (prevEma20 <= prevEma50 && ema20 > ema50) {
        return { signal: 'CALL', strength: 0.8 };
    }
    
    // Death Cross: EMA curta cruza abaixo da EMA longa
    if (prevEma20 >= prevEma50 && ema20 < ema50) {
        return { signal: 'PUT', strength: 0.8 };
    }

    // Tendência
    if (ema20 > ema50) {
        return { signal: 'CALL', strength: Math.min((ema20 - ema50) / ema50, 0.5) };
    } else if (ema20 < ema50) {
        return { signal: 'PUT', strength: Math.min((ema50 - ema20) / ema50, 0.5) };
    }

    return { signal: 'NEUTRAL', strength: 0 };
}

// ========================================
// SMA - Simple Moving Average
// ========================================

export function calculateSMA(candles: Candle[], period: number): number {
    if (candles.length < period) return candles[candles.length - 1].close;
    
    const closes = candles.slice(-period).map(c => c.close);
    return closes.reduce((sum, val) => sum + val, 0) / period;
}

// ========================================
// MACD - Moving Average Convergence Divergence
// ========================================

export interface MACDResult {
    macd: number;
    signal: number;
    histogram: number;
}

export function calculateMACD(candles: Candle[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): MACDResult {
    if (candles.length < slowPeriod + signalPeriod) {
        return { macd: 0, signal: 0, histogram: 0 };
    }

    // Calcular EMAs
    const emaFast = calculateEMA(candles, fastPeriod);
    const emaSlow = calculateEMA(candles, slowPeriod);
    
    // MACD Line
    const macd = emaFast - emaSlow;

    // Signal Line (EMA do MACD)
    // Para calcular corretamente, precisamos de histórico de MACDs
    // Simplificação: usar aproximação
    const signal = macd * 0.9; // Aproximação

    // Histogram
    const histogram = macd - signal;

    return { macd, signal, histogram };
}

export function getMACDSignal(macd: MACDResult, prevMACD: MACDResult): {
    signal: 'CALL' | 'PUT' | 'NEUTRAL';
    strength: number;
} {
    // Cruzamento: MACD cruza acima da signal
    if (prevMACD.macd <= prevMACD.signal && macd.macd > macd.signal) {
        return { signal: 'CALL', strength: 0.8 };
    }

    // Cruzamento: MACD cruza abaixo da signal
    if (prevMACD.macd >= prevMACD.signal && macd.macd < macd.signal) {
        return { signal: 'PUT', strength: 0.8 };
    }

    // Divergência positiva do histogram
    if (macd.histogram > 0 && macd.histogram > prevMACD.histogram) {
        return { signal: 'CALL', strength: 0.5 };
    }

    // Divergência negativa do histogram
    if (macd.histogram < 0 && macd.histogram < prevMACD.histogram) {
        return { signal: 'PUT', strength: 0.5 };
    }

    return { signal: 'NEUTRAL', strength: 0 };
}

// ========================================
// BOLLINGER BANDS
// ========================================

export interface BollingerBands {
    upper: number;
    middle: number;
    lower: number;
    bandwidth: number;
}

export function calculateBollingerBands(candles: Candle[], period: number = 20, stdDev: number = 2): BollingerBands {
    if (candles.length < period) {
        const close = candles[candles.length - 1].close;
        return { upper: close, middle: close, lower: close, bandwidth: 0 };
    }

    const closes = candles.slice(-period).map(c => c.close);
    
    // Média (middle band)
    const middle = closes.reduce((sum, val) => sum + val, 0) / period;

    // Desvio padrão
    const squaredDiffs = closes.map(val => Math.pow(val - middle, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / period;
    const standardDeviation = Math.sqrt(variance);

    // Bandas
    const upper = middle + (stdDev * standardDeviation);
    const lower = middle - (stdDev * standardDeviation);
    const bandwidth = (upper - lower) / middle;

    return { upper, middle, lower, bandwidth };
}

export function getBollingerSignal(currentPrice: number, bb: BollingerBands): {
    signal: 'CALL' | 'PUT' | 'NEUTRAL';
    strength: number;
} {
    // Preço tocou ou ultrapassou a banda inferior (oversold)
    if (currentPrice <= bb.lower) {
        const strength = Math.min((bb.lower - currentPrice) / bb.lower, 0.9);
        return { signal: 'CALL', strength };
    }

    // Preço tocou ou ultrapassou a banda superior (overbought)
    if (currentPrice >= bb.upper) {
        const strength = Math.min((currentPrice - bb.upper) / bb.upper, 0.9);
        return { signal: 'PUT', strength };
    }

    // Squeeze (baixa volatilidade) - aguardar breakout
    if (bb.bandwidth < 0.02) {
        return { signal: 'NEUTRAL', strength: 0 };
    }

    return { signal: 'NEUTRAL', strength: 0 };
}

// ========================================
// ATR - Average True Range (Volatilidade)
// ========================================

export function calculateATR(candles: Candle[], period: number = 14): number {
    if (candles.length < period + 1) return 0;

    const trueRanges: number[] = [];

    for (let i = 1; i < candles.length; i++) {
        const high = candles[i].high;
        const low = candles[i].low;
        const prevClose = candles[i - 1].close;

        const tr = Math.max(
            high - low,
            Math.abs(high - prevClose),
            Math.abs(low - prevClose)
        );

        trueRanges.push(tr);
    }

    // ATR é a média dos true ranges
    const recentTRs = trueRanges.slice(-period);
    return recentTRs.reduce((sum, val) => sum + val, 0) / period;
}

// ========================================
// STOCHASTIC OSCILLATOR
// ========================================

export interface StochasticResult {
    k: number; // %K (fast)
    d: number; // %D (slow)
}

export function calculateStochastic(candles: Candle[], kPeriod: number = 14, dPeriod: number = 3): StochasticResult {
    if (candles.length < kPeriod) {
        return { k: 50, d: 50 };
    }

    const recentCandles = candles.slice(-kPeriod);
    const currentClose = candles[candles.length - 1].close;
    
    const highestHigh = Math.max(...recentCandles.map(c => c.high));
    const lowestLow = Math.min(...recentCandles.map(c => c.low));

    // %K
    const k = ((currentClose - lowestLow) / (highestHigh - lowestLow)) * 100;

    // %D (SMA do %K) - simplificado
    const d = k * 0.9; // Aproximação

    return { k, d };
}

export function getStochasticSignal(stochastic: StochasticResult): {
    signal: 'CALL' | 'PUT' | 'NEUTRAL';
    strength: number;
} {
    // Oversold
    if (stochastic.k < 20 && stochastic.k > stochastic.d) {
        return { signal: 'CALL', strength: (20 - stochastic.k) / 20 };
    }

    // Overbought
    if (stochastic.k > 80 && stochastic.k < stochastic.d) {
        return { signal: 'PUT', strength: (stochastic.k - 80) / 20 };
    }

    return { signal: 'NEUTRAL', strength: 0 };
}

// ========================================
// SUPPORT & RESISTANCE
// ========================================

export interface SupportResistance {
    supports: number[];
    resistances: number[];
}

export function findSupportResistance(candles: Candle[], lookback: number = 50): SupportResistance {
    if (candles.length < lookback) {
        return { supports: [], resistances: [] };
    }

    const recentCandles = candles.slice(-lookback);
    const currentPrice = candles[candles.length - 1].close;

    // Identificar pivots (mínimos e máximos locais)
    const supports: number[] = [];
    const resistances: number[] = [];

    for (let i = 2; i < recentCandles.length - 2; i++) {
        const candle = recentCandles[i];
        
        // Pivot Low (suporte)
        if (
            candle.low < recentCandles[i - 1].low &&
            candle.low < recentCandles[i - 2].low &&
            candle.low < recentCandles[i + 1].low &&
            candle.low < recentCandles[i + 2].low
        ) {
            if (candle.low < currentPrice) {
                supports.push(candle.low);
            }
        }

        // Pivot High (resistência)
        if (
            candle.high > recentCandles[i - 1].high &&
            candle.high > recentCandles[i - 2].high &&
            candle.high > recentCandles[i + 1].high &&
            candle.high > recentCandles[i + 2].high
        ) {
            if (candle.high > currentPrice) {
                resistances.push(candle.high);
            }
        }
    }

    // Ordenar e pegar os mais próximos
    supports.sort((a, b) => b - a); // Decrescente
    resistances.sort((a, b) => a - b); // Crescente

    return {
        supports: supports.slice(0, 3),
        resistances: resistances.slice(0, 3)
    };
}

// ========================================
// TREND DETECTION
// ========================================

export type Trend = 'STRONG_BULLISH' | 'BULLISH' | 'SIDEWAYS' | 'BEARISH' | 'STRONG_BEARISH';

export function detectTrend(candles: Candle[], shortPeriod: number = 20, longPeriod: number = 50): Trend {
    if (candles.length < longPeriod) return 'SIDEWAYS';

    const emaShort = calculateEMA(candles, shortPeriod);
    const emaLong = calculateEMA(candles, longPeriod);
    const currentPrice = candles[candles.length - 1].close;

    const diff = ((emaShort - emaLong) / emaLong) * 100;

    if (diff > 2 && currentPrice > emaShort) return 'STRONG_BULLISH';
    if (diff > 0.5 && currentPrice > emaShort) return 'BULLISH';
    if (diff < -2 && currentPrice < emaShort) return 'STRONG_BEARISH';
    if (diff < -0.5 && currentPrice < emaShort) return 'BEARISH';
    
    return 'SIDEWAYS';
}

/**
 * EXEMPLO DE USO:
 * 
 * const rsi = calculateRSI(candles, 14);
 * const rsiSignal = getRSISignal(rsi);
 * 
 * const ema20 = calculateEMA(candles, 20);
 * const ema50 = calculateEMA(candles, 50);
 * 
 * const macd = calculateMACD(candles);
 * const macdSignal = getMACDSignal(macd, prevMACD);
 * 
 * const bb = calculateBollingerBands(candles);
 * const bbSignal = getBollingerSignal(currentPrice, bb);
 * 
 * const trend = detectTrend(candles);
 */
