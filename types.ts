
export interface User {
    id: string;
    email: string;
    displayName: string;
    isGuest?: boolean;
}

export enum TransactionType {
    INCOME = 'income',
    EXPENSE = 'expense'
}

export interface Transaction {
    id: string;
    amount: number;
    category: string;
    description: string;
    merchant?: string;
    date: string;
    type: TransactionType;
    classification?: 'Need' | 'Want' | 'Saving';
}

export interface BudgetCategory {
    id: string;
    name: string;
    allocated: number;
    spent: number;
    type: 'Need' | 'Want' | 'Saving';
}

export interface Subscription {
    id: string;
    name: string;
    amount: number;
    cycle: 'Monthly' | 'Yearly';
    nextDueDate: string;
    category: string;
}

export interface Investment {
    id: string;
    name: string;
    type: 'Stock' | 'Mutual Fund' | 'FD' | 'Real Estate' | 'Gold' | 'Crypto' | 'Bond' | 'PPF' | 'Other';
    investedAmount: number;
    currentValue: number;
    units?: number; // Total units/quantity held
    purchaseDate: string;
    goalId?: string; // Linked goal
    sipAmount?: number; // Monthly SIP if applicable
    mfSchemeCode?: string; // Code for mfapi.in integration
    lastUpdated?: string; // Last price sync
    benchmarkReturn?: number; // Annualized % return of benchmark
    benchmarkName?: string; // e.g. Nifty 50, Nifty Next 50
    annualizedReturn?: number; // Annualized % return of the investment itself
}

export type GoalCategory = 'Retirement' | 'Education' | 'Home' | 'Vehicle' | 'Marriage' | 'Vacation' | 'Emergency Fund' | 'Business' | 'Other';

export interface Goal {
    id: string;
    name: string;
    category: GoalCategory;
    targetAmount: number;
    targetDate: string;
    currentAmount: number; // Derived from linked investments
}

export interface Insurance {
    id: string;
    name: string;
    type: 'Life' | 'Health' | 'Vehicle' | 'Property' | 'Critical Illness' | 'Personal Accident';
    sumInsured: number;
    premium: number;
    premiumFrequency: 'Monthly' | 'Quarterly' | 'Yearly';
    renewDate: string;
    provider: string;
    policyNumber?: string;
    nominees?: string[];
    isAssetInsurance?: boolean; // For immovable assets
}

export interface Loan {
    id: string;
    name: string;
    principal: number;
    outstanding: number;
    interestRate: number; // Annual %
    tenureMonths: number;
    startDate: string;
    monthlyPrepayment?: number; // Optional recurring extra payment
}

export interface CollaborativeGroup {
    id: string;
    name: string;
    members: string[]; // Array of user IDs
    memberDetails?: Record<string, { displayName: string, email: string }>;
    createdBy: string;
    createdAt: string;
    inviteCode: string;
}

export interface SharedExpense extends Transaction {
    groupId: string;
    paidBy: string; // User ID who paid
    splitWith: { userId: string, share: number }[]; // Share can be percentage or ratio, let's use actual amount for simplicity or simplified split
}

export type ViewState = 'dashboard' | 'budget' | 'goals' | 'portfolio' | 'loans' | 'insurance' | 'calculators' | 'will-generator' | 'fire-center' | 'mf-center' | 'groups' | 'reports' | 'profile' | 'login' | 'signup' | 'admin-analytics' | 'marketing-studio';

// --- Will Generator Types ---
export interface WillAsset {
    id: string;
    type: string; // Real Estate, Bank Account, Jewelry, etc.
    description: string; // "Flat 302, Palm Heights"
}

export interface WillBeneficiary {
    id: string;
    name: string;
    relationship: string;
    allocation: string; // "50% of all assets" or "My Gold Watch"
}

export interface WillData {
    fullName: string;
    age: string;
    fatherName: string;
    address: string;
    religion: string; // Relevant for personal laws
    executorName: string;
    executorRelation: string;
    alternateExecutor: string;
    assets: WillAsset[];
    beneficiaries: WillBeneficiary[];
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'model';
    text: string;
    timestamp: Date;
}