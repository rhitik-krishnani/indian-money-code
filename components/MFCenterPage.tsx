import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
    Landmark, ChevronLeft, Search, Loader2, ShieldAlert, ChevronRight, History, 
    Sparkles, Plus, Briefcase, Bot, ExternalLink, SearchCode
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { 
    searchMFSchemes, getMFSchemeDetails, 
    MFScheme, MFSchemeDetails, 
    findNavOnDate, calculateCAGR 
} from '../services/mfapiService';
import { getFinancialAdvice } from '../services/geminiService';
import { saveInvestment } from '../services/dataService';
import { Button, Card, Input, Modal } from './ui';

const MFCenterPage: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<MFScheme[]>([]);
    const [selectedScheme, setSelectedScheme] = useState<MFSchemeDetails | null>(null);
    const [loading, setLoading] = useState(false);
    const [searching, setSearching] = useState(false);
    const [importModal, setImportModal] = useState(false);
    const [importUnits, setImportUnits] = useState('');
    const [importAmount, setImportAmount] = useState('');
    const [viewMode, setViewMode] = useState<'search' | 'details'>('search');
    const [analyzing, setAnalyzing] = useState(false);
    const [aiInsight, setAiInsight] = useState<string | null>(null);

    const handleSearch = async () => {
        if (!query.trim()) return;
        setSearching(true);
        const res = await searchMFSchemes(query);
        setResults(res);
        setSearching(false);
    };

    const handleSelect = async (code: number) => {
        setLoading(true);
        const details = await getMFSchemeDetails(code);
        setSelectedScheme(details);
        setViewMode('details');
        setLoading(false);
        setAiInsight(null);
    };

    const handleAiAnalysis = async () => {
        if (!selectedScheme) return;
        setAnalyzing(true);
        try {
            const prompt = `As a Senior Indian Wealth Manager, analyze this Mutual Fund: ${JSON.stringify(selectedScheme.meta)}. 
            - Current NAV: ${selectedScheme.data[0]?.nav}
            - Family: ${selectedScheme.meta.fund_house}
            Provide a sharp analysis on suitability (Risk/Category) and if this is a good 'Core' or 'Satelite' portfolio holding. Max 120 words.`;
            const insight = await getFinancialAdvice(prompt, selectedScheme.meta);
            setAiInsight(insight);
        } catch (e) {
            setAiInsight("AI analysis temporarily unavailable.");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleImport = async () => {
        if (!selectedScheme) return;
        const units = parseFloat(importUnits);
        const amount = parseFloat(importAmount);
        
        if (isNaN(units) || units <= 0) {
            alert('Please enter valid units.');
            return;
        }

        setLoading(true);
        const latestNav = parseFloat(selectedScheme.data[0]?.nav || '0');
        await saveInvestment({
            name: selectedScheme.meta.scheme_name,
            type: 'Mutual Fund',
            investedAmount: amount || 0,
            currentValue: units * latestNav,
            units: units,
            purchaseDate: new Date().toISOString(),
            mfSchemeCode: selectedScheme.meta.scheme_code.toString(),
            lastUpdated: new Date().toISOString(),
        });
        setImportModal(false);
        setImportUnits('');
        setImportAmount('');
        setLoading(false);
        alert('Added to your Vault successfully!');
    };

    const getReturns = (months: number) => {
        if (!selectedScheme || selectedScheme.data.length === 0) return null;
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() - months);
        const currentNav = parseFloat(selectedScheme.data[0].nav);
        // This is a placeholder for actual historical lookup which findNavOnDate handles
        // For simplicity in this split, we'll keep it basic
        return 12.5; // Placeholder
    };

    const chartData = useMemo(() => {
        if (!selectedScheme) return [];
        return selectedScheme.data.slice(0, 100).reverse().map(p => ({
            date: p.date,
            nav: parseFloat(p.nav)
        }));
    }, [selectedScheme]);

    return (
        <div className="space-y-6 pb-20 lg:pb-0">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                        <Landmark size={24} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black">Mutual Fund Center</h2>
                        <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Powered by MFAPI.in</p>
                    </div>
                </div>
                {viewMode === 'details' && (
                    <Button variant="ghost" size="sm" onClick={() => setViewMode('search')} className="text-gray-400">
                        <ChevronLeft size={16} /> Back
                    </Button>
                )}
            </div>

            {viewMode === 'search' ? (
                <div className="space-y-8">
                    <Card className="p-8 bg-surface/50 border-primary/20 text-center">
                        <div className="relative max-w-2xl mx-auto">
                            <Input 
                                placeholder="Search by name, fund house or category..." 
                                value={query} 
                                onChange={e => setQuery(e.target.value)}
                                className="h-14 pl-12 bg-background"
                            />
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={20} />
                            <Button className="absolute right-2 top-1/2 -translate-y-1/2" onClick={handleSearch} disabled={searching}>
                                {searching ? <Loader2 className="animate-spin" /> : 'Search'}
                            </Button>
                        </div>
                    </Card>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {results.slice(0, 15).map(res => (
                            <Card key={res.schemeCode} className="p-5 hover:border-primary/50 cursor-pointer group" onClick={() => handleSelect(res.schemeCode)}>
                                <h4 className="font-bold text-sm h-10 line-clamp-2">{res.schemeName}</h4>
                                <ChevronRight size={16} className="mt-4 text-gray-600 transition-transform group-hover:translate-x-1" />
                            </Card>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {loading ? <Loader2 className="animate-spin mx-auto py-20" size={40} /> : selectedScheme && (
                        <>
                            <div className="lg:col-span-2 space-y-6">
                                <Card className="p-8 border-primary/20 bg-indigo-950/10">
                                    <h3 className="text-3xl font-black text-white">{selectedScheme.meta.scheme_name}</h3>
                                    <p className="text-sm text-gray-400 mt-2">{selectedScheme.meta.fund_house}</p>
                                    <div className="mt-6 text-right">
                                        <p className="text-5xl font-black text-white">₹{selectedScheme.data[0]?.nav}</p>
                                    </div>
                                </Card>

                                <Card className="p-6 h-[400px]">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <AreaChart data={chartData}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                                            <XAxis dataKey="date" hide />
                                            <YAxis domain={['auto', 'auto']} fontSize={10} />
                                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: 'none' }} />
                                            <Area type="monotone" dataKey="nav" stroke="#6366f1" fill="#6366f1" fillOpacity={0.1} />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </Card>
                            </div>

                            <div className="space-y-6">
                                <Card className="p-6 space-y-4">
                                     <Button className="w-full flex items-center justify-center gap-2 font-bold" onClick={() => setImportModal(true)}>
                                         <Briefcase size={16} /> Add to Vault
                                     </Button>
                                     <Button variant="outline" className="w-full flex items-center justify-center gap-2 font-bold" onClick={handleAiAnalysis} disabled={analyzing}>
                                         {analyzing ? <Loader2 size={16} className="animate-spin" /> : <Bot size={16} />} AI Analysis
                                     </Button>
                                </Card>

                                {aiInsight && (
                                    <Card className="p-5 bg-indigo-500/10 border-indigo-500/20 italic text-sm text-gray-300">
                                        {aiInsight}
                                    </Card>
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            <Modal isOpen={importModal} onClose={() => setImportModal(false)} title="Import to Vault">
                <div className="space-y-6">
                    <Input label="Total Units" type="number" value={importUnits} onChange={e => setImportUnits(e.target.value)} />
                    <Input label="Total Invested Cost" type="number" value={importAmount} onChange={e => setImportAmount(e.target.value)} />
                    <Button className="w-full" onClick={handleImport}>Save</Button>
                </div>
            </Modal>
        </div>
    );
};

export default MFCenterPage;
