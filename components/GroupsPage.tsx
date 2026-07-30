import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
    Users, Plus, Search, ChevronRight, Copy, Check, Info, 
    ArrowUpRight, ArrowDownLeft, Trash2, Calendar, Share2, Users2,
    DollarSign, User
} from 'lucide-react';
import { CollaborativeGroup, SharedExpense, TransactionType } from '../types';
import { 
    getMyGroups, createGroup, joinGroup, 
    getGroupTransactions, addGroupTransaction, 
    getCurrentUser, leaveGroup, deleteGroupTransaction
} from '../services/dataService';
import { Card, Button, Input, Badge } from './ui';
import { Language, translations } from '../translations';

interface GroupsPageProps {
    lang: Language;
}

const GroupsPage: React.FC<GroupsPageProps> = ({ lang }) => {
    const t = translations[lang];
    const [groups, setGroups] = useState<CollaborativeGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeGroup, setActiveGroup] = useState<CollaborativeGroup | null>(null);
    const [transactions, setTransactions] = useState<SharedExpense[]>([]);
    const [showCreate, setShowCreate] = useState(false);
    const [showJoin, setShowJoin] = useState(false);
    const [groupName, setGroupName] = useState('');
    const [inviteCode, setInviteCode] = useState('');
    const [copied, setCopied] = useState(false);
    
    // Transaction modal state
    const [showAddTxn, setShowAddTxn] = useState(false);
    const [txnAmount, setTxnAmount] = useState('');
    const [txnDesc, setTxnDesc] = useState('');
    const [txnCat, setTxnCat] = useState('Groceries');
    
    const [showSettle, setShowSettle] = useState(false);
    const [settleWith, setSettleWith] = useState<{id: string, name: string} | null>(null);
    const [settleAmount, setSettleAmount] = useState('');
    
    const currentUser = getCurrentUser();

    useEffect(() => {
        loadGroups();
    }, []);

    useEffect(() => {
        if (activeGroup) {
            loadGroupTransactions(activeGroup.id);
        }
    }, [activeGroup]);

    const loadGroups = async () => {
        setLoading(true);
        try {
            const data = await getMyGroups();
            setGroups(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadGroupTransactions = async (groupId: string) => {
        try {
            const data = await getGroupTransactions(groupId);
            setTransactions(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
        } catch (e) {
            console.error(e);
        }
    };

    const handleCreateGroup = async () => {
        if (!groupName) return;
        try {
            const newGroup = await createGroup(groupName);
            setGroups([newGroup, ...groups]);
            setShowCreate(false);
            setGroupName('');
            setActiveGroup(newGroup);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Failed to create group");
        }
    };

    const handleJoinGroup = async () => {
        if (!inviteCode) return;
        try {
            const group = await joinGroup(inviteCode);
            setGroups([group, ...groups]);
            setShowJoin(false);
            setInviteCode('');
            setActiveGroup(group);
        } catch (e) {
            alert(e instanceof Error ? e.message : "Failed to join group");
        }
    };

    const handleAddTxn = async () => {
        if (!activeGroup || !currentUser || !txnAmount || !txnDesc) return;
        
        const amountValue = parseFloat(txnAmount);
        // Default split: equal among all members
        const splitShare = amountValue / activeGroup.members.length;
        const splitWith = activeGroup.members.map(memberId => ({
            userId: memberId,
            share: splitShare
        }));

        try {
            await addGroupTransaction(activeGroup.id, {
                amount: amountValue,
                description: txnDesc,
                category: txnCat,
                date: new Date().toISOString(),
                type: TransactionType.EXPENSE,
                paidBy: currentUser.id,
                splitWith
            });
            setShowAddTxn(false);
            setTxnAmount('');
            setTxnDesc('');
            loadGroupTransactions(activeGroup.id);
        } catch (e) {
            console.error(e);
        }
    };

    const handleSettleUp = async () => {
        if (!activeGroup || !currentUser || !settleWith || !settleAmount) return;
        
        const amountValue = parseFloat(settleAmount);
        try {
            await addGroupTransaction(activeGroup.id, {
                amount: amountValue,
                description: `Settlement: ${currentUser.displayName} to ${settleWith.name}`,
                category: 'Settlement',
                date: new Date().toISOString(),
                type: TransactionType.EXPENSE,
                paidBy: currentUser.id,
                splitWith: [{ userId: settleWith.id, share: amountValue }]
            });
            setShowSettle(false);
            setSettleWith(null);
            setSettleAmount('');
            loadGroupTransactions(activeGroup.id);
        } catch (e) {
            console.error(e);
        }
    };

    const simplifyDebts = () => {
        if (!activeGroup || !currentUser) return [];
        const balances = calculateBalances();
        const debts: { from: string, to: string, amount: number }[] = [];
        
        // This is a naive debt simplifier for MVP
        // In real Splitwise, this uses a max flow min cut or greedy approach
        const members = activeGroup.members;
        const netBalances = members.map(m => ({ id: m, balance: balances[m] || 0 }))
            .sort((a, b) => a.balance - b.balance);

        let i = 0;
        let j = netBalances.length - 1;

        while (i < j) {
            const debtor = netBalances[i];
            const creditor = netBalances[j];
            const amount = Math.min(-debtor.balance, creditor.balance);

            if (amount > 1) { // Ignore small change
                debts.push({ from: debtor.id, to: creditor.id, amount });
            }

            debtor.balance += amount;
            creditor.balance -= amount;

            if (debtor.balance === 0) i++;
            if (creditor.balance === 0) j--;
        }
        return debts;
    };

    const handleLeaveGroup = async () => {
        if (!activeGroup || !confirm(`Are you sure you want to leave "${activeGroup.name}"?`)) return;
        try {
            await leaveGroup(activeGroup.id);
            setActiveGroup(null);
            loadGroups();
        } catch (e) {
            alert(e instanceof Error ? e.message : "Failed to leave group");
        }
    };

    const handleDeleteTxn = async (txnId: string) => {
        if (!activeGroup || !confirm("Delete this shared transaction?")) return;
        try {
            await deleteGroupTransaction(activeGroup.id, txnId);
            loadGroupTransactions(activeGroup.id);
        } catch (e) {
            console.error(e);
        }
    };

    const copyInvite = () => {
        if (!activeGroup) return;
        navigator.clipboard.writeText(activeGroup.inviteCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const calculateBalances = () => {
        if (!activeGroup || !currentUser) return {};
        const balances: Record<string, number> = {};
        
        activeGroup.members.forEach(m => balances[m] = 0);
        
        transactions.forEach(t => {
            // Paid by someone
            balances[t.paidBy] += t.amount;
            // Split among others
            t.splitWith.forEach(s => {
                balances[s.userId] -= s.share;
            });
        });
        
        return balances;
    };

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
                <Users size={32} className="text-primary opacity-20" />
            </motion.div>
        </div>
    );

    if (activeGroup) {
        const balances = calculateBalances();
        const myBalance = balances[currentUser?.id || ''] || 0;
        const simplifiedDebts = simplifyDebts();
        const myDebts = simplifiedDebts.filter(d => d.from === currentUser?.id || d.to === currentUser?.id);

        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <button onClick={() => setActiveGroup(null)} className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors">
                        <Users size={20} />
                        <span className="font-bold text-sm tracking-tight">All Groups</span>
                    </button>
                    <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-lg">
                        <Share2 size={14} className="text-indigo-400" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">{activeGroup.inviteCode}</span>
                        <button onClick={copyInvite} className="ml-1 text-gray-500 hover:text-white">
                            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        </button>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <Card className="relative overflow-hidden group border-indigo-500/10">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
                            <div className="relative p-6">
                                <h2 className="text-3xl font-black italic tracking-tighter mb-1">{activeGroup.name}</h2>
                                <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mb-6">Group Command Center</p>
                                
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Your Status</p>
                                        <div className="flex items-center gap-2">
                                            {myBalance >= 0 ? (
                                                <div className="flex items-center gap-2 text-emerald-400">
                                                    <ArrowUpRight size={16} />
                                                    <span className="text-lg font-black tracking-tight">Owed ₹{myBalance.toFixed(0)}</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-amber-500">
                                                    <ArrowDownLeft size={16} />
                                                    <span className="text-lg font-black tracking-tight">You owe ₹{Math.abs(myBalance).toFixed(0)}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="bg-white/5 rounded-2xl p-4 border border-white/5">
                                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mb-1">Total Spends</p>
                                        <p className="text-lg font-black tracking-tight italic">
                                            ₹{transactions.reduce((s, t) => s + t.amount, 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </Card>

                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1">Shared Feed</h3>
                            <Button size="sm" onClick={() => setShowAddTxn(true)} className="h-8 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-[10px] font-black uppercase tracking-widest">
                                <Plus size={14} className="mr-1" /> Add Bill
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {transactions.length === 0 ? (
                                <div className="text-center py-20 bg-white/[0.02] border border-white/5 rounded-3xl">
                                    <DollarSign size={40} className="mx-auto text-gray-700 mb-4 opacity-50" />
                                    <p className="text-gray-500 text-sm font-medium">No shared bills yet. Start splitting!</p>
                                </div>
                            ) : (
                                transactions.map(txn => (
                                    <div key={txn.id} className="bg-white/5 border border-white/5 rounded-2xl p-4 hover:border-indigo-500/20 transition-all">
                                        <div className="flex justify-between items-start">
                                            <div className="flex gap-4">
                                                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 font-bold">
                                                    {txn.category[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm">{txn.description}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                        Paid by {activeGroup.memberDetails?.[txn.paidBy]?.displayName || 'Member'} • {new Date(txn.date).toLocaleDateString()}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="text-right">
                                                    <p className="font-black text-lg">₹{txn.amount}</p>
                                                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                                                        Your share: ₹{(txn.splitWith.find(s => s.userId === currentUser?.id)?.share || 0).toFixed(0)}
                                                    </p>
                                                </div>
                                                {(txn.paidBy === currentUser?.id || activeGroup.createdBy === currentUser?.id) && (
                                                    <button onClick={() => handleDeleteTxn(txn.id)} className="text-gray-600 hover:text-rose-500 transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <Card>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4 px-1">Debt Settlements</h3>
                            {myDebts.length === 0 ? (
                                <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/10 text-center">
                                    <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">All Settled Up!</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {myDebts.map((debt, idx) => {
                                        const isOwed = debt.to === currentUser?.id;
                                        const otherId = isOwed ? debt.from : debt.to;
                                        const otherName = activeGroup.memberDetails?.[otherId]?.displayName || 'Member';
                                        
                                        return (
                                            <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                                <div>
                                                    <p className="text-xs font-bold">
                                                        {isOwed ? `${otherName} owes you` : `You owe ${otherName}`}
                                                    </p>
                                                    <p className="text-lg font-black tracking-tight">₹{debt.amount.toFixed(0)}</p>
                                                </div>
                                                {!isOwed && (
                                                    <Button size="sm" variant="outline" className="h-8 rounded-lg border-primary/20 text-primary text-[10px] font-black uppercase"
                                                        onClick={() => {
                                                            setSettleWith({ id: otherId, name: otherName });
                                                            setSettleAmount(debt.amount.toFixed(0));
                                                            setShowSettle(true);
                                                        }}
                                                    >
                                                        Settle
                                                    </Button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </Card>

                        <Card>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-4 px-1">Squad Members</h3>
                            <div className="space-y-4">
                                {activeGroup.members.map(memberId => {
                                    const details = activeGroup.memberDetails?.[memberId];
                                    const balance = balances[memberId] || 0;
                                    return (
                                        <div key={memberId} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs uppercase">
                                                    {details?.displayName?.[0] || 'U'}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold">{details?.displayName || 'User'}</p>
                                                    <p className="text-[8px] text-gray-500 uppercase font-black tracking-tighter">{memberId === activeGroup.createdBy ? 'Admin' : 'Member'}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`text-xs font-black ${balance >= 0 ? 'text-emerald-400' : 'text-amber-500'}`}>
                                                    {balance >= 0 ? `+₹${balance.toFixed(0)}` : `-₹${Math.abs(balance).toFixed(0)}`}
                                                </p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </Card>

                        <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/10 italic">
                            <div className="flex gap-3 text-indigo-400 mb-3 text-xs font-bold uppercase tracking-widest items-center">
                                <Info size={14} /> Intelligence Note
                            </div>
                            <p className="text-[11px] text-gray-500 leading-relaxed">
                                Collaborative spaces allow you to sync budgets with partners or roommates. Shared transactions will automatically reflect in your survival runway calculations.
                            </p>
                        </div>

                        <Card className="bg-rose-500/5 border-rose-500/10">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-rose-500 mb-4 px-1">Danger Zone</h3>
                            <Button 
                                variant="ghost" 
                                className="w-full justify-start text-rose-500 hover:bg-rose-500/10 h-10 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                onClick={handleLeaveGroup}
                            >
                                <Trash2 size={14} className="mr-2" /> 
                                {activeGroup && currentUser?.id === activeGroup.createdBy ? "Dissolve Group" : "Leave Group"}
                            </Button>
                        </Card>
                    </div>
                </div>

                {/* Settle Up Modal */}
                <AnimatePresence>
                    {showSettle && settleWith && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }} 
                                animate={{ opacity: 1, scale: 1 }}
                                className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl"
                            >
                                <h2 className="text-2xl font-black italic tracking-tighter mb-6">Settle Balance</h2>
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-400">
                                        You are paying <span className="text-white font-bold">{settleWith.name}</span> to settle your debt.
                                    </p>
                                    <Input 
                                        label="Amount (₹)"
                                        type="number"
                                        value={settleAmount}
                                        onChange={(e) => setSettleAmount(e.target.value)}
                                    />
                                    <div className="flex gap-3 pt-2">
                                        <Button variant="ghost" className="flex-1 font-bold" onClick={() => setShowSettle(false)}>Cancel</Button>
                                        <Button className="flex-1 font-bold" onClick={handleSettleUp}>Record Payment</Button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>

                {/* Add Transaction Modal */}
                <AnimatePresence>
                    {showAddTxn && (
                        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.9 }} 
                                animate={{ opacity: 1, scale: 1 }}
                                className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 overflow-hidden relative shadow-2xl"
                            >
                                <h2 className="text-2xl font-black italic tracking-tighter mb-6 underline decoration-primary/30 decoration-4 underline-offset-4">Record Shared Spend</h2>
                                <div className="space-y-4">
                                    <Input 
                                        label="What was it for?"
                                        placeholder="e.g. Electricity Bill, Dinner"
                                        value={txnDesc}
                                        onChange={(e) => setTxnDesc(e.target.value)}
                                    />
                                    <Input 
                                        label="Total Amount (₹)"
                                        type="number"
                                        placeholder="0.00"
                                        value={txnAmount}
                                        onChange={(e) => setTxnAmount(e.target.value)}
                                    />
                                    <div>
                                        <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest mb-1.5 block">Category</label>
                                        <select 
                                            value={txnCat}
                                            onChange={(e) => setTxnCat(e.target.value)}
                                            className="w-full h-11 bg-white/5 border border-white/10 rounded-xl px-4 text-sm font-bold focus:border-primary outline-none transition-all appearance-none"
                                        >
                                            <option value="Groceries">Groceries</option>
                                            <option value="Rent">Rent</option>
                                            <option value="Dining">Dining</option>
                                            <option value="Travel">Travel</option>
                                            <option value="Utilities">Utilities</option>
                                            <option value="Entertainment">Entertainment</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10">
                                        <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-2">Split Engine</p>
                                        <p className="text-xs text-gray-400">Total will be split equally among all <strong>{activeGroup.members.length} members</strong>.</p>
                                    </div>
                                    <div className="flex gap-3 pt-2">
                                        <Button variant="ghost" className="flex-1 font-bold" onClick={() => setShowAddTxn(false)}>Cancel</Button>
                                        <Button className="flex-1 font-bold" onClick={handleAddTxn}>Split Bill</Button>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-32">
            <div className="bg-indigo-500/10 p-6 lg:p-10 rounded-[2.5rem] border border-indigo-500/20 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                <div className="relative z-10 max-w-2xl">
                    <h1 className="text-4xl lg:text-5xl font-black italic tracking-tighter text-white mb-4">
                        Wealth is Better Shared.
                    </h1>
                    <p className="text-indigo-200/60 font-medium text-lg mb-8">
                        Collaborative Spaces allow you to track shared expenses, split bills with squad members, and sync financial flows in real-time.
                    </p>
                    <div className="flex flex-wrap gap-4">
                        <Button className="bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase tracking-widest px-8 rounded-2xl h-12" onClick={() => setShowCreate(true)}>
                            <Plus size={20} className="mr-2" /> Create Space
                        </Button>
                        <Button variant="outline" className="border-white/10 text-white font-black uppercase tracking-widest px-8 rounded-2xl h-12" onClick={() => setShowJoin(true)}>
                            <Users2 size={20} className="mr-2" /> Join Squad
                        </Button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {groups.length === 0 ? (
                    <div className="md:col-span-2 lg:col-span-3 py-20 text-center">
                        <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/5">
                            <Users size={32} className="text-gray-600" />
                        </div>
                        <h3 className="text-xl font-bold mb-2">No Active Spaces</h3>
                        <p className="text-gray-500 max-w-sm mx-auto">Create a space for your family, roommates, or partners to start collaborating.</p>
                    </div>
                ) : (
                    groups.map(group => (
                        <Card 
                            key={group.id} 
                            className="group cursor-pointer hover:border-indigo-500/40 transition-all duration-300 transform hover:-translate-y-1"
                            onClick={() => setActiveGroup(group)}
                        >
                            <div className="flex justify-between items-start mb-6">
                                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                    <Users size={24} />
                                </div>
                                <Badge className="bg-white/5 border-white/10 text-[10px] font-black uppercase">{group.members.length} members</Badge>
                            </div>
                            <h3 className="text-2xl font-black italic tracking-tighter mb-2 group-hover:text-indigo-400 transition-colors">{group.name}</h3>
                            <div className="flex items-center gap-2 text-gray-500 text-[10px] font-bold uppercase tracking-widest">
                                <span>Code: {group.inviteCode}</span>
                                <ChevronRight size={14} />
                            </div>
                        </Card>
                    ))
                )}
            </div>

            {/* Create Group Modal */}
            <AnimatePresence>
                {showCreate && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }} 
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl"
                        >
                            <h2 className="text-2xl font-black italic tracking-tighter mb-6">Forge New Space</h2>
                            <div className="space-y-4">
                                <Input 
                                    label="Space Name"
                                    placeholder="e.g. My Family, 204 B Squad"
                                    value={groupName}
                                    onChange={(e) => setGroupName(e.target.value)}
                                />
                                <div className="flex gap-3 pt-2">
                                    <Button variant="ghost" className="flex-1 font-bold" onClick={() => setShowCreate(false)}>Cancel</Button>
                                    <Button className="flex-1 font-bold" onClick={handleCreateGroup}>Create</Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Join Group Modal */}
            <AnimatePresence>
                {showJoin && (
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }} 
                            animate={{ opacity: 1, scale: 1 }}
                            className="w-full max-w-md bg-surface border border-white/10 rounded-3xl p-6 shadow-2xl"
                        >
                            <h2 className="text-2xl font-black italic tracking-tighter mb-6">Enter Squad Code</h2>
                            <div className="space-y-4">
                                <Input 
                                    label="Invite Code"
                                    placeholder="e.g. AB123XY"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value)}
                                />
                                <div className="flex gap-3 pt-2">
                                    <Button variant="ghost" className="flex-1 font-bold" onClick={() => setShowJoin(false)}>Cancel</Button>
                                    <Button className="flex-1 font-bold" onClick={handleJoinGroup}>Join Now</Button>
                                </div>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default GroupsPage;
