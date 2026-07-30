import { User, Investment, Transaction, WillData, BudgetCategory, Loan, TransactionType, Insurance } from "../types";

export interface PortfolioAudit {
    crucialInsight: string;
    summary: string;
    riskLevel: 'Low' | 'Medium' | 'High';
    healthScore: number;
    suggestedAllocation: { name: string, value: number }[];
    diversificationInsights: { category: string, status: 'good' | 'warning' | 'alert', message: string }[];
    topActionItems: string[];
    marketComparison?: {
        competitor: string;
        yourEdge: string;
        competitorFeature: string;
    };
}

export interface BudgetAudit {
    summary: string;
    leakageScore: number;
    savingsRate: number;
    idealSavingsRate: number;
    topLeaks: { category: string, amount: number, tip: string }[];
    rule503020Comparison: { 
        current: { need: number, want: number, saving: number }, 
        target: { need: number, want: number, saving: number } 
    };
}

const callServerAI = async (action: string, ...args: any[]): Promise<any> => {
    try {
        const response = await fetch("/api/gemini", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ action, args })
        });
        
        if (!response.ok) {
            const errExt = await response.json();
            throw new Error(errExt.error || "AI Server Error");
        }
        
        const data = await response.json();
        return data.result;
    } catch (e: any) {
        console.error(`Gemini Client Service error [Action: ${action}]:`, e);
        throw e;
    }
};

export const analyzePortfolio = async (investments: Investment[], lang?: string): Promise<PortfolioAudit | string> => {
    return callServerAI("analyzePortfolio", investments, lang);
};

export const analyzeBudget = async (budgets: BudgetCategory[], transactions: Transaction[], lang?: string): Promise<BudgetAudit | string> => {
    return callServerAI("analyzeBudget", budgets, transactions, lang);
};

export const generateWill = async (data: WillData): Promise<string> => {
    return callServerAI("generateWill", data);
};

export const parseVoiceTransaction = async (audioBase64: string): Promise<{amount: number, category: string, description: string} | null> => {
    try {
        return await callServerAI("parseVoiceTransaction", audioBase64);
    } catch (e) {
        return null;
    }
};

export const extractStatementTransactions = async (fileBase64: string, mimeType: string): Promise<Transaction[]> => {
    try {
        return await callServerAI("extractStatementTransactions", fileBase64, mimeType);
    } catch (e) {
        return [];
    }
};

export const extractMutualFundInvestments = async (fileBase64: string, mimeType: string): Promise<Investment[]> => {
    try {
        return await callServerAI("extractMutualFundInvestments", fileBase64, mimeType);
    } catch (e) {
        return [];
    }
};

export const parseSmsTransaction = async (smsText: string): Promise<Partial<Transaction> | null> => {
    try {
        return await callServerAI("parseSmsTransaction", smsText);
    } catch (e) {
        return null;
    }
};

export const parsePdfStatement = async (text: string): Promise<Omit<Investment, 'id'>[]> => {
    try {
        return await callServerAI("parsePdfStatement", text);
    } catch (e) {
        return [];
    }
};

export const getFinancialAdvice = async (
    query: string, 
    context: { investments: Investment[], budgets: BudgetCategory[], loans: Loan[] },
    lang?: string
): Promise<string> => {
    try {
        return await callServerAI("getFinancialAdvice", query, context, lang);
    } catch (e) {
        return lang === 'hi' ? "मैं अभी ऑफलाइन हूँ। कृपया कुछ मिनटों बाद फिर से प्रयास करें।" : "AI is offline right now. Please try again soon.";
    }
};

export const getPriorityAction = async (context: { 
    investments: Investment[], 
    budgets: BudgetCategory[], 
    loans: Loan[],
    goals: any[]
}, lang?: string): Promise<{ title: string, description: string, type: 'danger' | 'warning' | 'success' | 'info' } | null> => {
    try {
        return await callServerAI("getPriorityAction", context, lang);
    } catch (e) {
        return null;
    }
};

export const getMarketPulse = async (): Promise<{nifty: number, niftyChange: number, sensex: number, sensexChange: number, prediction: string} | null> => {
    try {
        return await callServerAI("getMarketPulse");
    } catch (e) {
        return null;
    }
};

export const syncMarketPrices = async (investments: Investment[]): Promise<{ id: string, currentValue: number, benchmarkName?: string, benchmarkReturn?: number, annualizedReturn?: number }[]> => {
    try {
        return await callServerAI("syncMarketPrices", investments);
    } catch (e) {
        return [];
    }
};

export const getLifeLevelUpAdvice = async (context: { 
    investments: Investment[], 
    budgets: BudgetCategory[], 
    loans: Loan[],
    insurance: Insurance[],
    netWorth: number,
    safetyNetMonths: number
}, lang?: string): Promise<{ 
    currentLevel: string, 
    nextLevel: string, 
    progress: number, 
    requirements: string[], 
    aiAdvice: string,
    badgeColor: string
} | null> => {
    try {
        return await callServerAI("getLifeLevelUpAdvice", context, lang);
    } catch (e) {
        return null;
    }
};
