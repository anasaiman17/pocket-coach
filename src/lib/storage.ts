import { Expense, Budget, Category, PaymentMode, CATEGORIES } from './types';
import { subMonths, format } from 'date-fns';

const EXPENSES_KEY = 'aei-expenses';
const BUDGETS_KEY = 'aei-budgets';
const SETTINGS_KEY = 'aei-settings';

export function loadExpenses(): Expense[] {
  try { return JSON.parse(localStorage.getItem(EXPENSES_KEY) || '[]'); }
  catch { return []; }
}

export function saveExpenses(expenses: Expense[]) {
  localStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
}

export function loadBudgets(): Budget[] {
  try { return JSON.parse(localStorage.getItem(BUDGETS_KEY) || '[]'); }
  catch { return []; }
}

export function saveBudgets(budgets: Budget[]) {
  localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
}

export function loadSettings(): Record<string, any> {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); }
  catch { return {}; }
}

export function saveSettings(settings: Record<string, any>) {
  const current = loadSettings();
  localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...current, ...settings }));
}

export function initializeSampleData() {
  const now = new Date();
  const currentMonth = format(now, 'yyyy-MM');
  const expenses: Expense[] = [];
  const paymentModes: PaymentMode[] = ['Cash', 'Credit Card', 'Debit Card', 'UPI'];

  const templates: { category: Category; amounts: number[] }[] = [
    { category: 'Food', amounts: [12.5, 24, 8.75, 15.3, 35, 42.1, 18, 9.5, 22.8, 31] },
    { category: 'Shopping', amounts: [45, 89.99, 125, 35.5, 199.99, 67] },
    { category: 'Travel', amounts: [25, 52.5, 15, 85, 120] },
    { category: 'Utilities', amounts: [95, 48, 62.3] },
    { category: 'Entertainment', amounts: [15, 32, 25, 55, 22] },
    { category: 'Health', amounts: [30, 75, 28] },
    { category: 'Education', amounts: [22, 45] },
    { category: 'Rent', amounts: [1200] },
  ];

  for (let monthOffset = 2; monthOffset >= 0; monthOffset--) {
    const monthDate = subMonths(now, monthOffset);
    const maxDay = monthOffset === 0 ? now.getDate() : 28;
    const multiplier = monthOffset === 0 ? 0.35 : 1;
    const shoppingInflation = 1 + (2 - monthOffset) * 0.25;

    templates.forEach(({ category, amounts }) => {
      const count = Math.max(1, Math.ceil(amounts.length * multiplier));
      for (let i = 0; i < count; i++) {
        const day = Math.min(1 + ((i * 4 + monthOffset * 3 + 1) % maxDay), maxDay);
        let amount = amounts[i % amounts.length];
        if (category === 'Shopping') amount *= shoppingInflation;
        amount = Math.round(amount * 100) / 100;

        const d = new Date(monthDate.getFullYear(), monthDate.getMonth(), day);
        expenses.push({
          id: crypto.randomUUID(),
          amount,
          category,
          date: format(d, 'yyyy-MM-dd'),
          paymentMode: paymentModes[(i + monthOffset) % paymentModes.length],
          notes: '',
          createdAt: new Date().toISOString(),
        });
      }
    });
  }

  const budgets: Budget[] = [
    { category: 'Food', limit: 350, month: currentMonth },
    { category: 'Shopping', limit: 250, month: currentMonth },
    { category: 'Travel', limit: 200, month: currentMonth },
    { category: 'Entertainment', limit: 120, month: currentMonth },
    { category: 'Utilities', limit: 200, month: currentMonth },
    { category: 'Health', limit: 100, month: currentMonth },
    { category: 'Education', limit: 80, month: currentMonth },
    { category: 'Rent', limit: 1300, month: currentMonth },
  ];

  return { expenses, budgets };
}
