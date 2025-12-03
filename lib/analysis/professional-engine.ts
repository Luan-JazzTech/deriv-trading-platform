// lib/analysis/professional-engine.ts
/**
 * MOTOR DE ANÁLISE PROFISSIONAL
 * 
 * Combina múltiplos indicadores técnicos para gerar sinais de alta qualidade.
 * Sistema de pontuação baseado em confluência de indicadores.
 */

import {
    Candle,
    calculateRSI,
    getRSISignal,
    calculateEMA,
    getEMACrossSignal,
    calculateMACD,
    getMACDSignal,
    MACDResult,
    calculateBollingerBands,
    getBollingerSignal,
    BollingerBands,
    calculateStochastic,
    getStochasticSignal,
    StochasticResult,
    detectTrend,
    Trend,
    findSupportResistance,
    SupportResistance,
    calculateATR
} from './indicators';

export interface ProfessionalAnalysisResult {
    // Sinal Final
    direction: 'CALL' | 'PUT' | 'NEUTRAL';
    confidence: number; // 0-100
    score: number; // 0-100
    
    // Indicadores Individuais
    indicators: {
        rsi: {
            value: number;
            signal: 'CALL' | 'PUT' | 'NEUTRAL';
            score: number;
        };
        macd: {
            value: MACDResult;
            signal: 'CALL' | 'PUT' | 'NEUTRAL';
            score: number;
        };
        bollinger: {
            value: BollingerBands;
            signal: 'CALL' | 'PUT' | 'NEUTRAL';
            score: number;
        };
        ema: {
            ema20: number;
            ema50: number;
            signal: 'CALL' | 'PUT' | 'NEUTRAL';
            score: number;
        };
        stochastic: {
            value: StochasticResult;
            signal: 'CALL' | 'PUT' | 'NEUTRAL';
            score: number;
        };
        trend: {
            value: Trend;
            score: number;
        };
    };
    
    // Análise Adicional
    supportResistance: SupportResistance;
    volatility: number; // ATR
    
    // Metadados
    timestamp: number;
    candles: number; // Quantidade de candles analisados
    
    // Recomendações
    entryPrice: number;
    stopLoss?: number;
    takeProfit?: number;
    
    // Razão do Sinal
    reason: string[];
}

/**
 * PESOS DOS INDICADORES (Total: 100 pontos)
 */
const WEIGHTS = {
    RSI: 20,           // 0-20 pontos
    MACD: 20,          // 0-20 pontos
    BOLLINGER: 15,     // 0-15 pontos
    EMA: 15,           // 0-15 pontos
    STOCHASTIC: 15,    // 0-15 pontos
    TREND: 15          // 0-15 pontos
};

/**
 * ANALISAR MERCADO DE FORMA PROFISSIONAL
 */
export function analyzeProfessional(candles: Candle[]): ProfessionalAnalysisResult {
    // Validação básica
    if (!candles || candles.length < 50) {
        return createNeutralAnalysis(candles);
    }

    const currentPrice = candles[candles.length - 1].close;
    const prevCandles = candles.slice(0, -1);
    
    // ========================================
    // CALCULAR TODOS OS INDICADORES
    // ========================================
    
    // RSI
    const rsi = calculateRSI(candles, 14);
    const rsiSignalData = getRSISignal(rsi);
    const rsiScore = rsiSignalData.strength * WEIGHTS.RSI;
    
    // MACD
    const macd = calculateMACD(candles);
    const prevMACD = calculateMACD(prevCandles);
    const macdSignalData = getMACDSignal(macd, prevMACD);
    const macdScore = macdSignalData.strength * WEIGHTS.MACD;
    
    // Bollinger Bands
    const bollinger = calculateBollingerBands(candles);
    const bollingerSignalData = getBollingerSignal(currentPrice, bollinger);
    const bollingerScore = bollingerSignalData.strength * WEIGHTS.BOLLINGER;
    
    // EMA
    const ema20 = calculateEMA(candles, 20);
    const ema50 = calculateEMA(candles, 50);
    const prevEma20 = calculateEMA(prevCandles, 20);
    const prevEma50 = calculateEMA(prevCandles, 50);
    const emaSignalData = getEMACrossSignal(ema20, ema50, prevEma20, prevEma50);
    const emaScore = emaSignalData.strength * WEIGHTS.EMA;
    
    // Stochastic
    const stochastic = calculateStochastic(candles);
    const stochasticSignalData = getStochasticSignal(stochastic);
    const stochasticScore = stochasticSignalData.strength * WEIGHTS.STOCHASTIC;
    
    // Trend
    const trend = detectTrend(candles);
    const trendScore = getTrendScore(trend, WEIGHTS.TREND);
    const trendSignal = getTrendSignal(trend);
    
    // Support & Resistance
    const sr = findSupportResistance(candles);
    
    // Volatilidade (ATR)
    const volatility = calculateATR(candles);
    
    // ========================================
    // CALCULAR SCORE TOTAL
    // ========================================
    
    const signals = {
        rsi: { signal: rsiSignalData.signal, score: rsiScore },
        macd: { signal: macdSignalData.signal, score: macdScore },
        bollinger: { signal: bollingerSignalData.signal, score: bollingerScore },
        ema: { signal: emaSignalData.signal, score: emaScore },
        stochastic: { signal: stochasticSignalData.signal, score: stochasticScore },
        trend: { signal: trendSignal, score: trendScore }
    };
    
    const finalSignal = calculateFinalSignal(signals);
    
    // ========================================
    // CALCULAR CONFIDENCE
    // ========================================
    
    const confidence = calculateConfidence(signals, finalSignal.direction);
    
    // ========================================
    // GERAR RAZÕES
    // ========================================
    
    const reasons = generateReasons(signals, finalSignal.direction, {
        rsi,
        macd,
        bollinger,
        ema20,
        ema50,
        trend,
        stochastic
    });
    
    // ========================================
    // RETORNAR ANÁLISE COMPLETA
    // ========================================
    
    return {
        direction: finalSignal.direction,
        confidence,
        score: finalSignal.totalScore,
        
        indicators: {
            rsi: {
                value: rsi,
                signal: rsiSignalData.signal,
                score: rsiScore
            },
            macd: {
                value: macd,
                signal: macdSignalData.signal,
                score: macdScore
            },
            bollinger: {
                value: bollinger,
                signal: bollingerSignalData.signal,
                score: bollingerScore
            },
            ema: {
                ema20,
                ema50,
                signal: emaSignalData.signal,
                score: emaScore
            },
            stochastic: {
                value: stochastic,
                signal: stochasticSignalData.signal,
                score: stochasticScore
            },
            trend: {
                value: trend,
                score: trendScore
            }
        },
        
        supportResistance: sr,
        volatility,
        
        timestamp: Date.now(),
        candles: candles.length,
        
        entryPrice: currentPrice,
        stopLoss: calculateStopLoss(currentPrice, finalSignal.direction, volatility),
        takeProfit: calculateTakeProfit(currentPrice, finalSignal.direction, volatility),
        
        reason: reasons
    };
}

/**
 * CALCULAR SINAL FINAL BASEADO EM TODOS OS INDICADORES
 */
function calculateFinalSignal(signals: Record<string, { signal: string; score: number }>): {
    direction: 'CALL' | 'PUT' | 'NEUTRAL';
    totalScore: number;
} {
    let callScore = 0;
    let putScore = 0;
    let neutralCount = 0;
    
    Object.values(signals).forEach(s => {
        if (s.signal === 'CALL') callScore += s.score;
        else if (s.signal === 'PUT') putScore += s.score;
        else neutralCount++;
    });
    
    const totalScore = Math.max(callScore, putScore);
    
    // Se muitos indicadores estão neutros, retornar neutro
    if (neutralCount >= 4) {
        return { direction: 'NEUTRAL', totalScore: 0 };
    }
    
    // Se a diferença é muito pequena, retornar neutro
    if (Math.abs(callScore - putScore) < 10) {
        return { direction: 'NEUTRAL', totalScore: 0 };
    }
    
    // Retornar direção com maior score
    if (callScore > putScore) {
        return { direction: 'CALL', totalScore: callScore };
    } else if (putScore > callScore) {
        return { direction: 'PUT', totalScore: putScore };
    }
    
    return { direction: 'NEUTRAL', totalScore: 0 };
}

/**
 * CALCULAR CONFIDENCE (Percentual de indicadores concordando)
 */
function calculateConfidence(
    signals: Record<string, { signal: string; score: number }>,
    finalDirection: string
): number {
    if (finalDirection === 'NEUTRAL') return 0;
    
    const agreeing = Object.values(signals).filter(s => s.signal === finalDirection).length;
    const total = Object.values(signals).length;
    
    return Math.round((agreeing / total) * 100);
}

/**
 * GERAR RAZÕES HUMANAS PARA O SINAL
 */
function generateReasons(
    signals: Record<string, { signal: string; score: number }>,
    direction: string,
    indicators: any
): string[] {
    if (direction === 'NEUTRAL') {
        return ['Mercado sem direção clara', 'Aguardando confluência de indicadores'];
    }
    
    const reasons: string[] = [];
    
    // RSI
    if (signals.rsi.signal === direction) {
        if (indicators.rsi < 30) reasons.push(`RSI oversold (${indicators.rsi.toFixed(0)})`);
        else if (indicators.rsi > 70) reasons.push(`RSI overbought (${indicators.rsi.toFixed(0)})`);
    }
    
    // MACD
    if (signals.macd.signal === direction) {
        if (direction === 'CALL') reasons.push('MACD cruzou para cima');
        else reasons.push('MACD cruzou para baixo');
    }
    
    // Bollinger
    if (signals.bollinger.signal === direction) {
        if (direction === 'CALL') reasons.push('Preço tocou banda inferior');
        else reasons.push('Preço tocou banda superior');
    }
    
    // EMA
    if (signals.ema.signal === direction) {
        if (direction === 'CALL') reasons.push('EMA20 acima de EMA50 (bullish)');
        else reasons.push('EMA20 abaixo de EMA50 (bearish)');
    }
    
    // Trend
    if (signals.trend.signal === direction) {
        reasons.push(`Tendência ${indicators.trend.toLowerCase()}`);
    }
    
    return reasons.slice(0, 3); // Máximo 3 razões
}

/**
 * CALCULAR STOP LOSS BASEADO EM ATR
 */
function calculateStopLoss(entryPrice: number, direction: string, atr: number): number {
    const multiplier = 1.5; // 1.5x ATR
    
    if (direction === 'CALL') {
        return entryPrice - (atr * multiplier);
    } else {
        return entryPrice + (atr * multiplier);
    }
}

/**
 * CALCULAR TAKE PROFIT BASEADO EM ATR
 */
function calculateTakeProfit(entryPrice: number, direction: string, atr: number): number {
    const multiplier = 2.5; // 2.5x ATR (R:R de 1.67:1)
    
    if (direction === 'CALL') {
        return entryPrice + (atr * multiplier);
    } else {
        return entryPrice - (atr * multiplier);
    }
}

/**
 * GET TREND SCORE
 */
function getTrendScore(trend: Trend, maxScore: number): number {
    switch (trend) {
        case 'STRONG_BULLISH':
        case 'STRONG_BEARISH':
            return maxScore;
        case 'BULLISH':
        case 'BEARISH':
            return maxScore * 0.7;
        case 'SIDEWAYS':
            return 0;
        default:
            return 0;
    }
}

/**
 * GET TREND SIGNAL
 */
function getTrendSignal(trend: Trend): 'CALL' | 'PUT' | 'NEUTRAL' {
    if (trend === 'STRONG_BULLISH' || trend === 'BULLISH') return 'CALL';
    if (trend === 'STRONG_BEARISH' || trend === 'BEARISH') return 'PUT';
    return 'NEUTRAL';
}

/**
 * CRIAR ANÁLISE NEUTRA (quando não há dados suficientes)
 */
function createNeutralAnalysis(candles: Candle[]): ProfessionalAnalysisResult {
    const currentPrice = candles.length > 0 ? candles[candles.length - 1].close : 0;
    
    return {
        direction: 'NEUTRAL',
        confidence: 0,
        score: 0,
        
        indicators: {
            rsi: { value: 50, signal: 'NEUTRAL', score: 0 },
            macd: { value: { macd: 0, signal: 0, histogram: 0 }, signal: 'NEUTRAL', score: 0 },
            bollinger: { 
                value: { upper: currentPrice, middle: currentPrice, lower: currentPrice, bandwidth: 0 }, 
                signal: 'NEUTRAL', 
                score: 0 
            },
            ema: { ema20: currentPrice, ema50: currentPrice, signal: 'NEUTRAL', score: 0 },
            stochastic: { value: { k: 50, d: 50 }, signal: 'NEUTRAL', score: 0 },
            trend: { value: 'SIDEWAYS', score: 0 }
        },
        
        supportResistance: { supports: [], resistances: [] },
        volatility: 0,
        
        timestamp: Date.now(),
        candles: candles.length,
        
        entryPrice: currentPrice,
        
        reason: ['Dados insuficientes para análise', 'Aguardando mais candles']
    };
}

/**
 * VALIDAR SE SINAL É FORTE O SUFICIENTE
 */
export function isSignalStrong(analysis: ProfessionalAnalysisResult, minScore: number = 60, minConfidence: number = 66): boolean {
    return (
        analysis.direction !== 'NEUTRAL' &&
        analysis.score >= minScore &&
        analysis.confidence >= minConfidence
    );
}

/**
 * EXEMPLO DE USO:
 * 
 * const analysis = analyzeProfessional(candles);
 * 
 * if (isSignalStrong(analysis, 70, 75)) {
 *     console.log(`Sinal FORTE: ${analysis.direction}`);
 *     console.log(`Score: ${analysis.score}/100`);
 *     console.log(`Confidence: ${analysis.confidence}%`);
 *     console.log(`Razões: ${analysis.reason.join(', ')}`);
 *     
 *     // Executar trade
 *     executeTrade(analysis.direction, analysis.entryPrice);
 * }
 */
