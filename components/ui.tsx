import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ children, className = '', ...props }) => (
    <div className={`bg-surface border border-border rounded-xl p-6 shadow-sm ${className}`} {...props}>
        {children}
    </div>
);

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' }> = ({ children, className = '', variant = 'primary', ...props }) => {
    const base = "px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
    const variants = {
        primary: "bg-primary hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/30",
        secondary: "bg-accent hover:bg-purple-500 text-white",
        outline: "border border-border hover:bg-surface text-gray-300",
        ghost: "hover:bg-white/5 text-gray-400 hover:text-white",
        danger: "bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
    };
    return <button className={`${base} ${variants[variant]} ${className}`} {...props}>{children}</button>;
};

export const Input: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { label?: string }> = ({ label, className = '', ...props }) => (
    <div className="flex flex-col gap-1.5 w-full">
        {label && <label className="text-sm text-gray-400 font-medium">{label}</label>}
        <input 
            className={`bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors ${className}`}
            {...props}
        />
    </div>
);

export const Select: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }> = ({ label, children, className = '', ...props }) => (
    <div className="flex flex-col gap-1.5 w-full">
        {label && <label className="text-sm text-gray-400 font-medium">{label}</label>}
        <select 
            className={`bg-background border border-border rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors appearance-none ${className}`}
            {...props}
        >
            {children}
        </select>
    </div>
);

export const Badge: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${className}`}>
        {children}
    </span>
);

export const Modal: React.FC<{ isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }> = ({ isOpen, onClose, title, children }) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                    <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto"
                    >
                        <div className="flex justify-between items-center p-6 border-b border-border">
                            <h3 className="text-xl font-semibold text-white">{title}</h3>
                            <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
                        </div>
                        <div className="p-6">
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
