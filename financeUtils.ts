
/**
 * Calculates Absolute Return (%)
 * 
 * @param invested Cash outflow
 * @param current Cash inflow / current valuation
 */
export const BENCHMARK_DATA = {
    'Nifty 50': { '1y': 15.2, '3y': 18.5, '5y': 14.8, '10y': 13.5 },
    'Nifty Next 50': { '1y': 22.4, '3y': 20.1, '5y': 16.2, '10y': 14.8 },
    'Nifty Midcap 100': { '1y': 35.6, '3y': 22.4, '5y': 18.2, '10y': 16.5 },
    'Nifty Smallcap 250': { '1y': 48.2, '3y': 26.5, '5y': 20.1, '10y': 17.8 },
    'Gold (MCX)': { '1y': 12.4, '3y': 10.2, '5y': 11.5, '10y': 8.2 },
    'Fixed Deposit': { '1y': 7.1, '3y': 7.5, '5y': 7.5, '10y': 7.2 },
};

export const calculateAbsoluteReturn = (invested: number, current: number): number => {
    if (invested <= 0) return 0;
    const result = ((current - invested) / invested) * 100;
    if (isNaN(result) || !isFinite(result)) return 0;
    return parseFloat(result.toFixed(2));
};

export const getDefaultBenchmark = (type: string): { name: string, return: number } => {
    switch (type) {
        case 'Stock': return { name: 'Nifty 50', return: 14.2 };
        case 'Mutual Fund': return { name: 'Nifty 50 TRI', return: 15.1 };
        case 'Gold': return { name: 'Gold (MCX)', return: 9.2 };
        case 'FD': return { name: '1Y FD Rate', return: 7.1 };
        case 'Crypto': return { name: 'Bitcoin (BTC)', return: 65.4 };
        case 'Real Estate': return { name: 'NHB Residex', return: 7.5 };
        case 'PPF': return { name: 'PPF Rate', return: 7.1 };
        default: return { name: 'Inflation (CPI)', return: 6.0 };
    }
};

export const calculatePortfolioReturn = (investments: { investedAmount: number, currentValue: number }[]): number => {
    const validInvestments = investments.filter(i => i.investedAmount > 0);
    if (validInvestments.length === 0) return 0;
    
    const totalInvested = validInvestments.reduce((sum, i) => sum + i.investedAmount, 0);
    const totalCurrentValue = validInvestments.reduce((sum, i) => sum + i.currentValue, 0);
    
    if (totalInvested <= 0) return 0;

    return calculateAbsoluteReturn(totalInvested, totalCurrentValue);
};

export const calculatePortfolioAnnualizedReturn = (investments: { investedAmount: number, currentValue: number, purchaseDate: string | Date }[]): number => {
    const totalInvested = investments.reduce((sum, i) => sum + i.investedAmount, 0);
    if (totalInvested <= 0) return 0;
    
    let weightedAnnReturn = 0;
    investments.forEach(inv => {
        const annReturn = calculateAnnualizedReturn(inv.investedAmount, inv.currentValue, inv.purchaseDate);
        weightedAnnReturn += annReturn * (inv.investedAmount / totalInvested);
    });
    
    return parseFloat(weightedAnnReturn.toFixed(2));
};

export const calculateAnnualizedReturn = (invested: number, current: number, start: string | Date, end: string | Date = new Date()): number => {
    if (invested <= 0 || current < 0) return 0;
    
    const startDate = new Date(start);
    const endDate = new Date(end);
    
    const diffTime = endDate.getTime() - startDate.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    
    try {
        const cagr = Math.pow(current / invested, 365 / diffDays) - 1;
        const result = cagr * 100;
        
        if (isNaN(result) || !isFinite(result)) return 0;
        return parseFloat(result.toFixed(2));
    } catch (e) {
        return 0;
    }
};
