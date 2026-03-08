import { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from 'react';
import { Expense, Budget, Insight, BadSpendingAlert, SpendingRisk } from './types';
import { initializeSampleData } from './storage';
import {
  dbLoadExpenses, dbSaveExpense, dbDeleteExpense, dbSaveAllExpenses,
  dbLoadBudgets, dbSaveBudget, dbSaveAllBudgets,
  dbLoadSetting, dbSaveSetting,
  migrateFromLocalStorage
} from './db';
import { generateInsights, calculateHealthScore, detectBadSpending, calculateSpendingRisk } from './ai-engine';

interface ExpenseContextType {
  expenses: Expense[];
  budgets: Budget[];
  badSpendingMode: boolean;
  insights: Insight[];
  healthScore: { score: number; factors: string[] };
  badSpendingAlerts: BadSpendingAlert[];
  spendingRisk: SpendingRisk;
  isLoading: boolean;
  addExpense: (e: Omit<Expense, 'id' | 'createdAt'>) => void;
  addExpensesBulk: (items: Omit<Expense, 'id' | 'createdAt'>[]) => void;
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
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgetsState] = useState<Budget[]>([]);
  const [badSpendingMode, setBadSpendingMode] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  // Load all data from IndexedDB on mount
  useEffect(() => {
    async function init() {
      // Migrate any legacy localStorage data first
      await migrateFromLocalStorage();

      const [storedExpenses, storedBudgets, storedBadMode, storedTheme] = await Promise.all([
        dbLoadExpenses(),
        dbLoadBudgets(),
        dbLoadSetting<boolean>('badSpendingMode', true),
        dbLoadSetting<'light' | 'dark'>('theme', 'dark'),
      ]);

      if (storedExpenses.length > 0) {
        setExpenses(storedExpenses);
        setBudgetsState(storedBudgets);
      } else {
        // Seed sample data
        const sample = initializeSampleData();
        await dbSaveAllExpenses(sample.expenses);
        await dbSaveAllBudgets(sample.budgets);
        setExpenses(sample.expenses);
        setBudgetsState(sample.budgets);
      }

      setBadSpendingMode(storedBadMode);
      setTheme(storedTheme);
      setIsLoading(false);
    }
    init();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    if (!isLoading) dbSaveSetting('theme', theme);
  }, [theme, isLoading]);

  useEffect(() => {
    if (!isLoading) dbSaveSetting('badSpendingMode', badSpendingMode);
  }, [badSpendingMode, isLoading]);

  const insights = useMemo(() => generateInsights(expenses, budgets), [expenses, budgets]);
  const healthScore = useMemo(() => calculateHealthScore(expenses, budgets), [expenses, budgets]);
  const badSpendingAlerts = useMemo(
    () => (badSpendingMode ? detectBadSpending(expenses, budgets) : []),
    [expenses, budgets, badSpendingMode]
  );
  const spendingRisk = useMemo(() => calculateSpendingRisk(expenses, budgets), [expenses, budgets]);

  const addExpense = useCallback((data: Omit<Expense, 'id' | 'createdAt'>) => {
    const expense: Expense = { ...data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    setExpenses(prev => [...prev, expense]);
    dbSaveExpense(expense);
  }, []);

  const addExpensesBulk = useCallback((items: Omit<Expense, 'id' | 'createdAt'>[]) => {
    const now = new Date().toISOString();
    const newExpenses: Expense[] = items.map(data => ({
      ...data,
      id: crypto.randomUUID(),
      createdAt: now,
    }));
    // Persist each new expense individually — safe against overwriting existing data
    newExpenses.forEach(e => dbSaveExpense(e));
    // Merge into state in a single atomic update so all pages re-render at once
    setExpenses(prev => [...prev, ...newExpenses]);
  }, []);

  const updateExpense = useCallback((id: string, data: Partial<Expense>) => {
    setExpenses(prev => {
      const updated = prev.map(e => (e.id === id ? { ...e, ...data } : e));
      const expense = updated.find(e => e.id === id);
      if (expense) dbSaveExpense(expense);
      return updated;
    });
  }, []);

  const deleteExpense = useCallback((id: string) => {
    setExpenses(prev => prev.filter(e => e.id !== id));
    dbDeleteExpense(id);
  }, []);

  const setBudget = useCallback((category: string, limit: number, month: string) => {
    setBudgetsState(prev => {
      const idx = prev.findIndex(b => b.category === category && b.month === month);
      let updated: Budget[];
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = { ...updated[idx], limit };
      } else {
        updated = [...prev, { category: category as any, limit, month }];
      }
      const budget = updated.find(b => b.category === category && b.month === month)!;
      dbSaveBudget(budget);
      return updated;
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

  const importData = useCallback(async (json: string) => {
    try {
      const d = JSON.parse(json);
      if (d.expenses) {
        await dbSaveAllExpenses(d.expenses);
        setExpenses(d.expenses);
      }
      if (d.budgets) {
        await dbSaveAllBudgets(d.budgets);
        setBudgetsState(d.budgets);
      }
    } catch (e) {
      console.error('Import failed:', e);
    }
  }, []);

  return (
    <Ctx.Provider value={{
      expenses, budgets, badSpendingMode, insights, healthScore, badSpendingAlerts, spendingRisk,
      isLoading,
      addExpense, addExpensesBulk, updateExpense, deleteExpense, setBudget,
      toggleBadSpendingMode: () => setBadSpendingMode(p => !p),
      exportData, importData, theme,
      toggleTheme: () => setTheme(p => (p === 'dark' ? 'light' : 'dark')),
    }}>
      {children}
    </Ctx.Provider>
  );
}
