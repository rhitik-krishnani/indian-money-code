import type { VercelRequest, VercelResponse } from "@vercel/node";
import { GoogleGenAI, Type } from "@google/genai";
import { Investment, Transaction, WillData, BudgetCategory, Loan, TransactionType, Insurance } from "../types";

const getAI = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface CacheEntry {
  data: any;
  timestamp: number;
}
const aiCache: Record<string, CacheEntry> = {};

const getCached = (key: string, ttlMs: number) => {
  const entry = aiCache[key];
  if (entry && (Date.now() - entry.timestamp < ttlMs)) {
    return entry.data;
  }
  return null;
};

const setCache = (key: string, data: any) => {
  aiCache[key] = { data, timestamp: Date.now() };
};

const isRateLimitError = (e: any) => e?.message?.includes("429") || e?.message?.includes("RESOURCE_EXHAUSTED");

const analyzePortfolio = async (investments: Investment[], lang?: string): Promise<any> => {
  if (!process.env.GEMINI_API_KEY) return "AI Service Unavailable: Missing API Key";
  if (!investments || investments.length === 0) {
    return lang === 'hi' ? "आपका पोर्टफोलियो खाली है। विश्लेषण के लिए पहले कुछ संपत्तियां जोड़ें!" : "Your portfolio is empty. Add some assets first for a deep analysis!";
  }

  const portfolioHash = `portfolio_${investments.length}_${investments.reduce((acc, i) => acc + i.currentValue, 0)}_${lang}`;
  const cached = getCached(portfolioHash, 10 * 60 * 1000);
  if (cached) return cached;

  const ai = getAI();
  const prompt = `
  Analyze the following investment portfolio for an Indian retail investor.
  Language for Response: ${lang === 'hi' ? 'Hindi' : 'English'}
  Data: ${JSON.stringify(investments)}

  TASK:
  1. A CRUCIAL INSIGHT: One sentence (max 20 words) representing the absolute most important drill-down finding.
  2. A brief summary (Risk/Return balance).
  3. Score the health (0-100).
  4. Determine Overall Risk Level.
  5. Suggest an optimized allocation (e.g., Equity: 60%, Debt: 30%, Gold: 10%).
  6. Identify specific insights (e.g., "Tech sector is 40% - ALERT").
  7. List 3 specific, actionable suggestions.
  8. Compare this app's (Money Code) AI insights vs top Indian apps like INDmoney, Zerodha, or Groww.

  RETURN ONLY JSON:
  {
      "crucialInsight": "string",
      "summary": "markdown string",
      "riskLevel": "Low" | "Medium" | "High",
      "healthScore": number,
      "suggestedAllocation": [{ "name": "string", "value": number }],
      "diversificationInsights": [{ "category": "string", "status": "good" | "warning" | "alert", "message": "string" }],
      "topActionItems": ["string"],
      "marketComparison": {
          "competitor": "string",
          "yourEdge": "string",
          "competitorFeature": "string"
      }
  }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction: "You are a professional financial advisor called 'Indian Money Code AI'.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            crucialInsight: { type: Type.STRING },
            summary: { type: Type.STRING },
            riskLevel: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
            healthScore: { type: Type.NUMBER },
            suggestedAllocation: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, value: { type: Type.NUMBER } }, required: ["name", "value"] } },
            diversificationInsights: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, status: { type: Type.STRING, enum: ['good', 'warning', 'alert'] }, message: { type: Type.STRING } }, required: ["category", "status", "message"] } },
            topActionItems: { type: Type.ARRAY, items: { type: Type.STRING } },
            marketComparison: { type: Type.OBJECT, properties: { competitor: { type: Type.STRING }, yourEdge: { type: Type.STRING }, competitorFeature: { type: Type.STRING } }, required: ["competitor", "yourEdge", "competitorFeature"] }
          },
          required: ["crucialInsight", "summary", "riskLevel", "healthScore", "suggestedAllocation", "diversificationInsights", "topActionItems", "marketComparison"]
        }
      }
    });
    if (!response.text) return "AI Error: Empty response";
    const result = JSON.parse(response.text);
    setCache(portfolioHash, result);
    return result;
  } catch (e: any) {
    if (isRateLimitError(e)) return lang === 'hi' ? "AI अभी व्यस्त है। कृपया बाद में प्रयास करें।" : "The AI engine is currently busy. Please try again soon.";
    console.error("Portfolio Analysis Error:", e);
    return "Error analyzing portfolio.";
  }
};

const analyzeBudget = async (budgets: BudgetCategory[], transactions: Transaction[], lang?: string): Promise<any> => {
  if (!process.env.GEMINI_API_KEY) return "AI Service Unavailable: Missing API Key";

  const budgetHash = `budget_${budgets.length}_${transactions.length}_${lang}`;
  const cached = getCached(budgetHash, 10 * 60 * 1000);
  if (cached) return cached;

  const ai = getAI();
  const prompt = `
  You are a wise personal finance coach. Analyze these monthly budget categories and recent transactions.
  Language for Response: ${lang === 'hi' ? 'Hindi' : 'English'}

  Budgets: ${JSON.stringify(budgets)}
  Recent Transactions: ${JSON.stringify(transactions.slice(0, 50))}

  TASK:
  1. Score leakage (0-100, high = bad).
  2. Calculate current savings rate vs ideal.
  3. Identify top "leakage" categories with tips.
  4. Compare current 50/30/20 split vs ideal.

  RETURN ONLY JSON:
  {
      "summary": "markdown string",
      "leakageScore": number,
      "savingsRate": number,
      "idealSavingsRate": number,
      "topLeaks": [{ "category": "string", "amount": number, "tip": "string" }],
      "rule503020Comparison": {
          "current": { "need": number, "want": number, "saving": number },
          "target": { "need": number, "want": number, "saving": number }
      }
  }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: { type: Type.STRING },
            leakageScore: { type: Type.NUMBER },
            savingsRate: { type: Type.NUMBER },
            idealSavingsRate: { type: Type.NUMBER },
            topLeaks: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { category: { type: Type.STRING }, amount: { type: Type.NUMBER }, tip: { type: Type.STRING } }, required: ["category", "amount", "tip"] } },
            rule503020Comparison: { type: Type.OBJECT, properties: { current: { type: Type.OBJECT, properties: { need: { type: Type.NUMBER }, want: { type: Type.NUMBER }, saving: { type: Type.NUMBER } } }, target: { type: Type.OBJECT, properties: { need: { type: Type.NUMBER }, want: { type: Type.NUMBER }, saving: { type: Type.NUMBER } } } } }
          },
          required: ["summary", "leakageScore", "savingsRate", "idealSavingsRate", "topLeaks", "rule503020Comparison"]
        }
      }
    });
    if (!response.text) return "AI Error: Empty response";
    const result = JSON.parse(response.text);
    setCache(budgetHash, result);
    return result;
  } catch (e: any) {
    if (isRateLimitError(e)) return lang === 'hi' ? "AI बजेट विश्लेषण के लिए अभी व्यस्त है।" : "AI is currently busy for budget analysis.";
    console.error("Budget Analysis Error:", e);
    return "Error analyzing budget.";
  }
};

const generateWill = async (data: WillData): Promise<string> => {
  if (!process.env.GEMINI_API_KEY) return "AI Service Unavailable: Missing API Key";

  const ai = getAI();
  const prompt = `
  Draft a comprehensive, legally sound "Last Will and Testament" for an Indian citizen based on the following structured data.

  IMPORTANT: You must use the EXACT assets and beneficiaries provided below. Do NOT use placeholders.

  CONTEXT:
  - Testator: ${data.fullName}, Age: ${data.age}, S/o or D/o: ${data.fatherName}.
  - Religion: ${data.religion}
  - Address: ${data.address}
  - Executor: ${data.executorName} (${data.executorRelation}). Alternate: ${data.alternateExecutor}.

  ASSETS TO INCLUDE:
  ${JSON.stringify(data.assets)}

  BENEFICIARIES & DISTRIBUTION:
  ${JSON.stringify(data.beneficiaries)}

  INSTRUCTIONS:
  1. Structure the document formally with clauses.
  2. Be specific. Mention asset types and descriptions.
  3. Include a "Sound Mind" declaration.
  4. Include space for 2 Witnesses with signature lines.
  5. Use professional legal language but keep it clear.
  6. Start with: "**DRAFT FOR REVIEW ONLY. NOT A FINAL LEGAL DOCUMENT.**"
  7. Output in Markdown format.
  `;

  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
    return response.text || "Error generating will.";
  } catch (e: any) {
    if (isRateLimitError(e)) return "**ERROR: AI Service Busy.**\n\nPlease try again in 5 minutes.";
    console.error("Will Generation Error:", e);
    return "Error generating will.";
  }
};

const parseVoiceTransaction = async (audioBase64: string): Promise<any> => {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing API Key");

  const ai = getAI();
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [{ inlineData: { mimeType: 'audio/wav', data: audioBase64 } }, { text: "Listen to this audio log of a financial transaction. Extract the amount, category (e.g. Food, Transport, Utilities, Shopping), and a brief description." }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.OBJECT, properties: { amount: { type: Type.NUMBER }, category: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["amount", "category", "description"] }
      }
    });
    if (!response.text) return null;
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Voice parsing failed", e);
    return null;
  }
};

const extractStatementTransactions = async (fileBase64: string, mimeType: string): Promise<any[]> => {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing API Key");

  const ai = getAI();
  const prompt = `Analyze this Indian bank statement and extract ALL financial transactions.
  Look for: Date, Description/Narrative, and Amount (Debit/Credit).
  RULES:
  1. 'type' must be 'expense' if debit, 'income' if credit.
  2. 'category' should be a common personal finance category.
  3. 'amount' must be a positive number.
  4. 'date' should be in ISO format (YYYY-MM-DD).
  RETURN ONLY A JSON ARRAY.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [{ inlineData: { mimeType, data: fileBase64 } }, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, amount: { type: Type.NUMBER }, category: { type: Type.STRING }, description: { type: Type.STRING }, date: { type: Type.STRING }, type: { type: Type.STRING, enum: ['income', 'expense'] } }, required: ["amount", "category", "description", "date", "type"] } }
      }
    });
    if (!response.text) return [];
    return JSON.parse(response.text);
  } catch (e) {
    console.error("Statement extraction failed", e);
    return [];
  }
};

const extractMutualFundInvestments = async (fileBase64: string, mimeType: string): Promise<any[]> => {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing API Key");

  const ai = getAI();
  const prompt = `Analyze this Indian Mutual Fund Statement. Extract ALL current investment holdings.
  RETURN FORMAT: JSON Array with fields: name, type ('Stock'|'Mutual Fund'|'FD'|'Real Estate'|'Gold'|'Crypto'|'Bond'|'PPF'|'Other'), investedAmount, currentValue, units, purchaseDate, sipAmount, benchmarkName, benchmarkReturn, annualizedReturn.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts: [{ inlineData: { mimeType, data: fileBase64 } }, { text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, name: { type: Type.STRING }, type: { type: Type.STRING, enum: ['Stock', 'Mutual Fund', 'FD', 'Real Estate', 'Gold', 'Crypto', 'Bond', 'PPF', 'Other'] }, investedAmount: { type: Type.NUMBER }, currentValue: { type: Type.NUMBER }, units: { type: Type.NUMBER }, purchaseDate: { type: Type.STRING }, sipAmount: { type: Type.NUMBER }, benchmarkName: { type: Type.STRING }, benchmarkReturn: { type: Type.NUMBER }, annualizedReturn: { type: Type.NUMBER } }, required: ["name", "type", "investedAmount", "currentValue", "units"] } }
      }
    });
    if (!response.text) return [];
    return JSON.parse(response.text);
  } catch (e) {
    console.error("MF Statement extraction failed", e);
    return [];
  }
};

const parseSmsTransaction = async (smsText: string): Promise<any> => {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing API Key");

  const ai = getAI();
  const prompt = `Analyze this Indian Bank/Financial SMS and extract transaction details.
  SMS: "${smsText}"
  RETURN JSON: { amount: number, merchant: string, type: 'income' | 'expense', category: string, date: string, classification: 'Need' | 'Want' | 'Saving' }.
  If NOT a transaction, return empty object {}.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.OBJECT, properties: { amount: { type: Type.NUMBER }, merchant: { type: Type.STRING }, type: { type: Type.STRING, enum: ['income', 'expense'] }, category: { type: Type.STRING }, date: { type: Type.STRING }, classification: { type: Type.STRING, enum: ['Need', 'Want', 'Saving'] } } }
      }
    });
    if (!response.text) return null;
    const json = JSON.parse(response.text);
    if (!json.amount) return null;
    return json;
  } catch (e: any) {
    if (isRateLimitError(e)) {
      const amountMatch = smsText.match(/(?:Rs\.?|INR|₹)\s*([\d,]+(?:\.\d{2})?)/i);
      if (!amountMatch) return null;
      const amount = parseFloat(amountMatch[1].replace(/,/g, ''));
      const isDebit = /spent|paid|withdrawn|debited|transfer|sent/i.test(smsText);
      const isCredit = /received|credited|deposited/i.test(smsText);
      if (!isDebit && !isCredit) return null;
      return { amount, description: "Transaction Detected", type: isDebit ? 'expense' : 'income', category: "Other", date: new Date().toISOString().split('T')[0] };
    }
    console.error("SMS parsing failed", e);
    return null;
  }
};

const parsePdfStatement = async (text: string): Promise<any[]> => {
  if (!process.env.GEMINI_API_KEY) throw new Error("Missing API Key");

  const ai = getAI();
  const prompt = `Analyze this raw text from an Indian financial PDF statement. Extract current investment holdings.
  Raw Text: "${text.substring(0, 100000)}"
  RETURN FORMAT: JSON Array with fields: name, type, investedAmount, currentValue, units, purchaseDate, sipAmount.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, type: { type: Type.STRING, enum: ['Stock', 'Mutual Fund', 'FD', 'Real Estate', 'Gold', 'Crypto', 'Bond', 'PPF', 'Other'] }, investedAmount: { type: Type.NUMBER }, currentValue: { type: Type.NUMBER }, units: { type: Type.NUMBER }, purchaseDate: { type: Type.STRING }, sipAmount: { type: Type.NUMBER } }, required: ["name", "type", "investedAmount", "currentValue"] } }
      }
    });
    if (!response.text) return [];
    return JSON.parse(response.text);
  } catch (e) {
    console.error("PDF Parsing failed", e);
    return [];
  }
};

const getFinancialAdvice = async (query: string, context: { investments: Investment[], budgets: BudgetCategory[], loans: Loan[] }, lang?: string): Promise<string> => {
  if (!process.env.GEMINI_API_KEY) return lang === 'hi' ? "मैं अभी ऑफलाइन हूँ। कृपया अपनी API Key जांचें।" : "I'm offline right now. Please check your API Key.";

  const ai = getAI();
  const totalWealth = context.investments.reduce((sum, i) => sum + i.currentValue, 0);
  const totalDebt = context.loans.reduce((sum, i) => sum + i.outstanding, 0);
  const budgetUtilization = context.budgets.map(b => `${b.name}: ${Math.round((b.spent / b.allocated) * 100)}%`).join(', ');

  const prompt = `
  User Query: "${query}"
  Language for Response: ${lang === 'hi' ? 'Hindi' : 'English'}

  USER FINANCIAL CONTEXT:
  - Total Net Worth: ₹${totalWealth}
  - Total Debt: ₹${totalDebt}
  - Budget Status: ${budgetUtilization}
  - Investment Details: ${JSON.stringify(context.investments.map(i => ({ name: i.name, type: i.type, value: i.currentValue })))}
  - Loan Details: ${JSON.stringify(context.loans.map(l => ({ name: l.name, outstanding: l.outstanding, rate: l.interestRate })))}

  INSTRUCTIONS:
  - You are a helpful Indian financial assistant.
  - RESPOND IN THE REQUESTED LANGUAGE.
  - Use the context above to give personalized answers.
  - Be concise.
  - If talking about taxes, assume Indian Tax Laws (FY 2024-25).
  `;

  try {
    const response = await ai.models.generateContent({ model: 'gemini-2.0-flash', contents: prompt });
    return response.text || "Unable to generate advice at this moment.";
  } catch (e: any) {
    if (isRateLimitError(e)) return lang === 'hi' ? "क्षमा करें, AI अभी काफी व्यस्त है।" : "The AI engine is currently busy. Please try again in a few minutes.";
    return "Sorry, I encountered an error connecting to the financial brain.";
  }
};

const getPriorityAction = async (context: { investments: Investment[], budgets: BudgetCategory[], loans: Loan[], goals: any[] }, lang?: string): Promise<any> => {
  if (!process.env.GEMINI_API_KEY) return null;

  const ai = getAI();
  const totalWealth = context.investments.reduce((sum, i) => sum + i.currentValue, 0);
  const budgetAlerts = context.budgets.filter(b => (b.spent / b.allocated) > 0.8).map(b => b.name);
  const criticalLoans = context.loans.filter(l => l.interestRate > 12).map(l => l.name);

  const prompt = `
  Analyze this Indian investor's profile and provide the SINGLE MOST IMPORTANT priority action for today.
  Language for Response: ${lang === 'hi' ? 'Hindi' : 'English'}

  DATA:
  - Net Worth: ₹${totalWealth}
  - Critical Budgets (>80% used): ${budgetAlerts.join(', ') || 'None'}
  - High Interest Loans (>12%): ${criticalLoans.join(', ') || 'None'}
  - Goals: ${JSON.stringify(context.goals.map(g => ({ name: g.name, progress: Math.round((g.currentAmount / g.targetAmount) * 100) })))}

  RETURN ONLY JSON: { "title": "short title", "description": "max 25 words", "type": "danger|warning|success|info" }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.OBJECT, properties: { title: { type: Type.STRING }, description: { type: Type.STRING }, type: { type: Type.STRING, enum: ['danger', 'warning', 'success', 'info'] } }, required: ["title", "description", "type"] }
      }
    });
    if (!response.text) return null;
    return JSON.parse(response.text);
  } catch (e: any) {
    if (isRateLimitError(e)) return { title: "Wealth Preservation Mode", description: "Stick to your plan. Re-run analysis later.", type: "info" };
    return null;
  }
};

const getMarketPulse = async (): Promise<any> => {
  if (!process.env.GEMINI_API_KEY) return null;

  const cached = getCached('marketPulse', 15 * 60 * 1000);
  if (cached) return cached;

  const ai = getAI();
  const now = new Date();
  const prompt = `Find the LATEST real-time Indian stock market index values (NIFTY 50 and SENSEX).
  Current Time: ${now.toISOString()}
  Use Google Search to find the live or most recent closing price.
  RETURN ONLY VALID JSON: { "nifty": number, "niftyChange": number, "sensex": number, "sensexChange": number, "prediction": "string (max 12 words)" }`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: { type: Type.OBJECT, properties: { nifty: { type: Type.NUMBER }, niftyChange: { type: Type.NUMBER }, sensex: { type: Type.NUMBER }, sensexChange: { type: Type.NUMBER }, prediction: { type: Type.STRING } }, required: ["nifty", "niftyChange", "sensex", "sensexChange", "prediction"] }
      }
    });
    if (!response.text) throw new Error("Empty response");
    const data = JSON.parse(response.text);
    if (!data.nifty || data.nifty < 10000) throw new Error("Invalid Nifty value");
    setCache('marketPulse', data);
    return data;
  } catch (e: any) {
    return { nifty: 24850, niftyChange: 0.45, sensex: 81210, sensexChange: 0.38, prediction: "Market showing consolidation patterns." };
  }
};

const syncMarketPrices = async (investments: Investment[]): Promise<any[]> => {
  if (!process.env.GEMINI_API_KEY) return [];

  const ai = getAI();
  const prompt = `You are a market data synchronizer. Given the following Indian market investments, USE GOOGLE SEARCH to find their LATEST current market prices or NAV as of TODAY.
  Data: ${JSON.stringify(investments.map(i => ({ id: i.id, name: i.name, type: i.type, investedAmount: i.investedAmount, currentValue: i.currentValue, purchaseDate: i.purchaseDate, sipAmount: i.sipAmount, units: i.units })))}
  RETURN JSON ARRAY: [{ id: string, currentValue: number, benchmarkName?: string, benchmarkReturn?: number, annualizedReturn?: number }]`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { id: { type: Type.STRING }, currentValue: { type: Type.NUMBER }, benchmarkName: { type: Type.STRING }, benchmarkReturn: { type: Type.NUMBER }, annualizedReturn: { type: Type.NUMBER } }, required: ["id", "currentValue"] } }
      }
    });
    if (!response.text) return [];
    return JSON.parse(response.text);
  } catch (e) {
    return [];
  }
};

const getLifeLevelUpAdvice = async (context: { investments: Investment[], budgets: BudgetCategory[], loans: Loan[], insurance: Insurance[], netWorth: number, safetyNetMonths: number }, lang?: string): Promise<any> => {
  if (!process.env.GEMINI_API_KEY) return null;

  const contextHash = `levelup_${context.netWorth}_${context.investments.length}_${context.loans.length}`;
  const cached = getCached(contextHash, 30 * 60 * 1000);
  if (cached) return cached;

  const ai = getAI();
  const prompt = `
  Analyze this Indian investor's financial data to determine their "Wealth Level".
  Language for Response: ${lang === 'hi' ? 'Hindi' : 'English'}

  LEVELS: ROOKIE (<₹5L), BUILDER (₹5L-₹25L), OPTIMIZED (₹25L-₹1Cr), VANGUARD (₹1Cr-₹5Cr), ZENITH (>₹5Cr).

  USER DATA:
  - Net Worth: ₹${context.netWorth}
  - Safety Net: ${context.safetyNetMonths.toFixed(1)} months
  - Investments: ${context.investments.length} assets, Total ₹${context.investments.reduce((sum, i) => sum + i.currentValue, 0)}
  - Loans: ${context.loans.length} active, Total ₹${context.loans.reduce((sum, l) => sum + l.outstanding, 0)}
  - Insurance: ${context.insurance.length} policies.

  RETURN JSON: { "currentLevel": "string", "nextLevel": "string", "progress": number, "requirements": ["string","string","string"], "aiAdvice": "string (max 30 words)", "badgeColor": "string" }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: { type: Type.OBJECT, properties: { currentLevel: { type: Type.STRING }, nextLevel: { type: Type.STRING }, progress: { type: Type.NUMBER }, requirements: { type: Type.ARRAY, items: { type: Type.STRING } }, aiAdvice: { type: Type.STRING }, badgeColor: { type: Type.STRING } }, required: ["currentLevel", "nextLevel", "progress", "requirements", "aiAdvice", "badgeColor"] }
      }
    });
    if (!response.text) return null;
    const result = JSON.parse(response.text);
    setCache(contextHash, result);
    return result;
  } catch (e: any) {
    const isRookie = context.netWorth < 500000 || context.safetyNetMonths < 3;
    return {
      currentLevel: isRookie ? "ROOKIE" : "BUILDER",
      nextLevel: isRookie ? "BUILDER" : "OPTIMIZED",
      progress: Math.min(Math.round((context.netWorth / 500000) * 100), 100),
      requirements: ["Build 6 months emergency fund", "Start monthly SIP of ₹5,000+", "Get ₹1Cr+ Term Life Insurance"],
      aiAdvice: lang === 'hi' ? "बचत को अपनी पहली प्राथमिकता बनाएं।" : "Make consistent saving your top priority.",
      badgeColor: isRookie ? "gray" : "blue"
    };
  }
};

const allowedActions: Record<string, Function> = {
  analyzePortfolio,
  analyzeBudget,
  generateWill,
  parseVoiceTransaction,
  extractStatementTransactions,
  extractMutualFundInvestments,
  parseSmsTransaction,
  parsePdfStatement,
  getFinancialAdvice,
  getPriorityAction,
  getMarketPulse,
  syncMarketPrices,
  getLifeLevelUpAdvice
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { action, args } = req.body;
    if (!action) {
      return res.status(400).json({ error: "AI execution action is required" });
    }

    const fn = allowedActions[action];
    if (!fn) {
      return res.status(404).json({ error: `Engine action ${action} is not supported` });
    }

    console.log(`Executing serverless Gemini action: ${action}`);
    const result = await fn(...(args || []));
    res.json({ result });
  } catch (error: any) {
    console.error(`AI Server execution error for action ${req.body?.action}:`, error);
    res.status(500).json({ error: error.message || "Failed to execute AI action on server" });
  }
}
