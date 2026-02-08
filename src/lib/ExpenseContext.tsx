import { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import { Expense, Budget, Insight, BadSpendingAlert, SpendingRisk } from './types';
import { loadExpenses, saveExpenses, loadBudgets, saveBudgets, loadSettings, saveSettings, initializeSampleData } from './storage';
import { generateInsights, calculateHealthScore, detectBadSpending, calculateSpendingRisk } from './ai-engine';

interface ExpenseContextType {
  expenses: Expense[];
  budgets: Budget[];
  badSpendingMode: boolean;
  insights: Insight[];
  healthScore: { score: number; factors: string[] };
  badSpendingAlerts: BadSpendingAlert[];
  spendingRisk: SpendingRisk;
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => void;
  updateExpense: (id: string, data: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  setBudget: (category: string, limit: number, month: string) => void;
  toggleBadSpendingMode: () => void;
  exportData: () => void;
  importData: (json: string) => void;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const Ctx = createContext<ExpenseContextType | null>(null);

export function useExpenses() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useExpenses must be used within ExpenseProvider');
  return c;
}

export function ExpenseProvider({ children }: { children: ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const stored = loadExpenses();
    if (stored.length > 0) return stored;
    const sample = initializeSampleData();
    saveExpenses(sample.expenses);
    saveBudgets(sample.budgets);
    return sample.expenses;
  });
  const [budgets, setBudgetsState] = useState<Budget[]>(() => loadBudgets());
  const [badSpendingMode, setBadSpendingMode] = useState(() => loadSettings().badSpendingMode ?? true);
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    (localStorage.getItem('aei-theme') as 'light' | 'dark') || 'dark'
  );

  useEffect(() => { saveExpenses(expenses); }, [expenses]);
  useEffect(() => { saveBudgets(budgets); }, [budgets]);
  useEffect(() => { saveSettings({ badSpendingMode }); }, [badSpendingMode]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    localStorage.setItem('aei-theme', theme);
  }, [theme]);

  const insights = useMemo(() => generateInsights(expenses, budgets), [expenses, budgets]);
  const healthScore = useMemo(() => calculateHealthScore(expenses, budgets), [expenses, budgets]);
  const badSpendingAlerts = useMemo(
    () => (badSpendingMode ? detectBadSpending(expenses, budgets) : []),
    [expenses, budgets, badSpendingMode]
  );
  const spendingRisk = useMemo(() => calculateSpendingRisk(expenses, budgets), [expenses, budgets]);

  const addExpense = useCallback((data: Omit<Expense, 'id' | 'createdAt'>) => {
    setExpenses(prev => [...prev, { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() }]);
  }, []);

  const updateExpense = useCallback((id: string, data: Partial<Expense>) => {
    setExpenses(prev => prev.map(e => (e.id === id ? { ...e, ...data } : e)));
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
  }, []);

  const setBudget = useCallback((category: string, limit: number, month: string) => {
    setBudgetsState(prev => {
      const idx = prev.findIndex(b => b.category === category && b.month === month);
      if (idx >= 0) {
        const u = [...prev];
        u[idx] = { ...u[idx], limit };
        return u;
      }
      return [...prev, { category: category as any, limit, month }];
    });
  }, []);

  const exportData = useCallback(() => {
    const blob = new Blob([JSON.stringify({ expenses, budgets }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [expenses, budgets]);

  const importData = useCallback((json: string) => {
    try {
      const d = JSON.parse(json);
      if (d.expenses) setExpenses(d.expenses);
      if (d.budgets) setBudgetsState(d.budgets);
    } catch (e) {
      console.error('Import failed:', e);
    }
  }, []);

  return (
    <Ctx.Provider value={{
      expenses, budgets, badSpendingMode, insights, healthScore, badSpendingAlerts, spendingRisk,
      addExpense, updateExpense, deleteExpense, setBudget,
      toggleBadSpendingMode: () => setBadSpendingMode(p => !p),
      exportData, importData, theme,
      toggleTheme: () => setTheme(p => (p === 'dark' ? 'light' : 'dark')),
    }}>
      {children}
    </Ctx.Provider>
  );
}
