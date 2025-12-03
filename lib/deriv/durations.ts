// lib/deriv/durations.ts
/**
 * DURAÇÕES CORRETAS POR ATIVO - API DERIV v2.0
 * Versão corrigida e testada - Sem erros de sintaxe
 */

export interface AssetDuration {
    type: 'tick' | 'second' | 'minute' | 'hour';
    min: number;
    max: number;
    recommended: number[];
    unit: 't' | 's' | 'm' | 'h';
}

export interface AssetInfo {
    id: string;
    name: string;
    type: 'synthetic' | 'forex' | 'crypto';
    decimals: number;
    group: string;
    duration: AssetDuration;
    minStake: number;
    maxStake: number;
    payout: number;
}

/**
 * MAPA COMPLETO DE ATIVOS - TESTADO E FUNCIONANDO
 */
export const DERIV_ASSETS: Record<string, AssetInfo> = {
    // VOLATILITY INDICES (1 second tick)
    '1HZ100V': {
        id: '1HZ100V',
        name: 'Volatility 100 (1s)',
        type: 'synthetic',
        decimals: 2,
        group: 'Derived Indices',
        duration: {
            type: 'tick',
            min: 5,
            max: 10,
            recommended: [5, 7, 10],
            unit: 't'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },
    '1HZ75V': {
        id: '1HZ75V',
        name: 'Volatility 75 (1s)',
        type: 'synthetic',
        decimals: 2,
        group: 'Derived Indices',
        duration: {
            type: 'tick',
            min: 5,
            max: 10,
            recommended: [5, 7, 10],
            unit: 't'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },
    '1HZ50V': {
        id: '1HZ50V',
        name: 'Volatility 50 (1s)',
        type: 'synthetic',
        decimals: 2,
        group: 'Derived Indices',
        duration: {
            type: 'tick',
            min: 5,
            max: 10,
            recommended: [5, 7, 10],
            unit: 't'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },
    '1HZ25V': {
        id: '1HZ25V',
        name: 'Volatility 25 (1s)',
        type: 'synthetic',
        decimals: 2,
        group: 'Derived Indices',
        duration: {
            type: 'tick',
            min: 5,
            max: 10,
            recommended: [5, 7, 10],
            unit: 't'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },
    '1HZ10V': {
        id: '1HZ10V',
        name: 'Volatility 10 (1s)',
        type: 'synthetic',
        decimals: 2,
        group: 'Derived Indices',
        duration: {
            type: 'tick',
            min: 5,
            max: 10,
            recommended: [5, 7, 10],
            unit: 't'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },

    // VOLATILITY INDICES (Normal - minutos)
    'R_100': {
        id: 'R_100',
        name: 'Volatility 100 Index',
        type: 'synthetic',
        decimals: 2,
        group: 'Derived Indices',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [1, 3, 5, 10, 15],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },
    'R_75': {
        id: 'R_75',
        name: 'Volatility 75 Index',
        type: 'synthetic',
        decimals: 2,
        group: 'Derived Indices',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [1, 3, 5, 10, 15],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },
    'R_50': {
        id: 'R_50',
        name: 'Volatility 50 Index',
        type: 'synthetic',
        decimals: 2,
        group: 'Derived Indices',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [1, 3, 5, 10, 15],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },
    'R_25': {
        id: 'R_25',
        name: 'Volatility 25 Index',
        type: 'synthetic',
        decimals: 2,
        group: 'Derived Indices',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [1, 3, 5, 10, 15],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },
    'R_10': {
        id: 'R_10',
        name: 'Volatility 10 Index',
        type: 'synthetic',
        decimals: 2,
        group: 'Derived Indices',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [1, 3, 5, 10, 15],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },

    // JUMP INDICES
    'JD10': {
        id: 'JD10',
        name: 'Jump 10 Index',
        type: 'synthetic',
        decimals: 2,
        group: 'Jump Indices',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [1, 5, 10, 15],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },
    'JD25': {
        id: 'JD25',
        name: 'Jump 25 Index',
        type: 'synthetic',
        decimals: 2,
        group: 'Jump Indices',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [1, 5, 10, 15],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },
    'JD50': {
        id: 'JD50',
        name: 'Jump 50 Index',
        type: 'synthetic',
        decimals: 2,
        group: 'Jump Indices',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [1, 5, 10, 15],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.95
    },

    // FOREX MAJORS
    'frxEURUSD': {
        id: 'frxEURUSD',
        name: 'EUR/USD',
        type: 'forex',
        decimals: 5,
        group: 'Forex Majors',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [5, 15, 30, 60],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.85
    },
    'frxGBPUSD': {
        id: 'frxGBPUSD',
        name: 'GBP/USD',
        type: 'forex',
        decimals: 5,
        group: 'Forex Majors',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [5, 15, 30, 60],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.85
    },
    'frxUSDJPY': {
        id: 'frxUSDJPY',
        name: 'USD/JPY',
        type: 'forex',
        decimals: 3,
        group: 'Forex Majors',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [5, 15, 30, 60],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.85
    },
    'frxAUDUSD': {
        id: 'frxAUDUSD',
        name: 'AUD/USD',
        type: 'forex',
        decimals: 5,
        group: 'Forex Majors',
        duration: {
            type: 'minute',
            min: 1,
            max: 1440,
            recommended: [5, 15, 30, 60],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.85
    },

    // CRYPTOCURRENCIES
    'cryBTCUSD': {
        id: 'cryBTCUSD',
        name: 'Bitcoin',
        type: 'crypto',
        decimals: 2,
        group: 'Cryptocurrencies',
        duration: {
            type: 'minute',
            min: 5,
            max: 1440,
            recommended: [15, 30, 60, 120],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.80
    },
    'cryETHUSD': {
        id: 'cryETHUSD',
        name: 'Ethereum',
        type: 'crypto',
        decimals: 2,
        group: 'Cryptocurrencies',
        duration: {
            type: 'minute',
            min: 5,
            max: 1440,
            recommended: [15, 30, 60, 120],
            unit: 'm'
        },
        minStake: 0.35,
        maxStake: 50000,
        payout: 0.80
    }
};

/**
 * FUNÇÕES AUXILIARES
 */

export function getAssetInfo(assetId: string): AssetInfo | undefined {
    return DERIV_ASSETS[assetId];
}

export function getRecommendedDuration(assetId: string, index: number = 0): { value: number; unit: string } | null {
    const asset = DERIV_ASSETS[assetId];
    if (!asset) return null;

    const duration = asset.duration.recommended[index] || asset.duration.recommended[0];
    return {
        value: duration,
        unit: asset.duration.unit
    };
}

export function isDurationValid(assetId: string, duration: number, unit: string): boolean {
    const asset = DERIV_ASSETS[assetId];
    if (!asset) return false;

    if (asset.duration.unit !== unit) return false;
    return duration >= asset.duration.min && duration <= asset.duration.max;
}

export function formatDurationForAPI(assetId: string, durationValue?: number): string {
    const asset = DERIV_ASSETS[assetId];
    if (!asset) {
        console.error(`Asset ${assetId} not found in DERIV_ASSETS`);
        return '5m'; // Fallback seguro
    }

    const duration = durationValue || asset.duration.recommended[0];
    
    // Validar duração
    if (duration < asset.duration.min || duration > asset.duration.max) {
        console.warn(`Duration ${duration} out of range for ${assetId}. Using recommended.`);
        return `${asset.duration.recommended[0]}${asset.duration.unit}`;
    }

    return `${duration}${asset.duration.unit}`;
}

export function getAllAssets(): AssetInfo[] {
    const assets: AssetInfo[] = [];
    for (const key in DERIV_ASSETS) {
        if (DERIV_ASSETS.hasOwnProperty(key)) {
            assets.push(DERIV_ASSETS[key]);
        }
    }
    return assets;
}

export function getAssetsByType(type: string): AssetInfo[] {
    const assets: AssetInfo[] = [];
    for (const key in DERIV_ASSETS) {
        if (DERIV_ASSETS.hasOwnProperty(key)) {
            const asset = DERIV_ASSETS[key];
            if (asset.type === type) {
                assets.push(asset);
            }
        }
    }
    return assets;
}

export function getAssetsByGroup(group: string): AssetInfo[] {
    const assets: AssetInfo[] = [];
    for (const key in DERIV_ASSETS) {
        if (DERIV_ASSETS.hasOwnProperty(key)) {
            const asset = DERIV_ASSETS[key];
            if (asset.group === group) {
                assets.push(asset);
            }
        }
    }
    return assets;
}
