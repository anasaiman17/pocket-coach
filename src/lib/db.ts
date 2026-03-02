import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { Expense, Budget } from './types';

interface AEISchema extends DBSchema {
  expenses: {
    key: string;
    value: Expense;
    indexes: { 'by-date': string; 'by-category': string };
  };
  budgets: {
    key: string; // "category-month"
    value: Budget;
    indexes: { 'by-month': string };
  };
  settings: {
    key: string;
    value: { key: string; value: any };
  };
}

let dbPromise: Promise<IDBPDatabase<AEISchema>> | null = null;

export function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<AEISchema>('aei-database', 1, {
      upgrade(db) {
        // Expenses store
        const expenseStore = db.createObjectStore('expenses', { keyPath: 'id' });
        expenseStore.createIndex('by-date', 'date');
        expenseStore.createIndex('by-category', 'category');

        // Budgets store
        const budgetStore = db.createObjectStore('budgets', { keyPath: 'id' });
        budgetStore.createIndex('by-month', 'month');

        // Settings store
        db.createObjectStore('settings', { keyPath: 'key' });
      },
    });
  }
  return dbPromise;
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function dbLoadExpenses(): Promise<Expense[]> {
  const db = await getDB();
  return db.getAll('expenses');
}

export async function dbSaveExpense(expense: Expense): Promise<void> {
  const db = await getDB();
  await db.put('expenses', expense);
}

export async function dbDeleteExpense(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('expenses', id);
}

export async function dbSaveAllExpenses(expenses: Expense[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('expenses', 'readwrite');
  await tx.store.clear();
  await Promise.all(expenses.map(e => tx.store.put(e)));
  await tx.done;
}

// ── Budgets ───────────────────────────────────────────────────────────────────

export async function dbLoadBudgets(): Promise<Budget[]> {
  const db = await getDB();
  return db.getAll('budgets');
}

export async function dbSaveBudget(budget: Budget): Promise<void> {
  const db = await getDB();
  // Use composite key as id
  const record = { ...budget, id: `${budget.category}-${budget.month}` };
  await db.put('budgets', record as any);
}

export async function dbSaveAllBudgets(budgets: Budget[]): Promise<void> {
  const db = await getDB();
  const tx = db.transaction('budgets', 'readwrite');
  await tx.store.clear();
  await Promise.all(budgets.map(b => tx.store.put({ ...b, id: `${b.category}-${b.month}` } as any)));
  await tx.done;
}

// ── Settings ──────────────────────────────────────────────────────────────────

export async function dbLoadSetting<T>(key: string, defaultValue: T): Promise<T> {
  const db = await getDB();
  const record = await db.get('settings', key);
  return record ? record.value : defaultValue;
}

export async function dbSaveSetting(key: string, value: any): Promise<void> {
  const db = await getDB();
  await db.put('settings', { key, value });
}

// ── Migration from localStorage ───────────────────────────────────────────────

export async function migrateFromLocalStorage(): Promise<boolean> {
  const legacyExpenses = localStorage.getItem('aei-expenses');
  const legacyBudgets = localStorage.getItem('aei-budgets');
  const legacySettings = localStorage.getItem('aei-settings');

  if (!legacyExpenses && !legacyBudgets) return false;

  try {
    if (legacyExpenses) {
      const expenses: Expense[] = JSON.parse(legacyExpenses);
      if (expenses.length > 0) await dbSaveAllExpenses(expenses);
    }
    if (legacyBudgets) {
      const budgets: Budget[] = JSON.parse(legacyBudgets);
      if (budgets.length > 0) await dbSaveAllBudgets(budgets);
    }
    if (legacySettings) {
      const settings = JSON.parse(legacySettings);
      for (const [k, v] of Object.entries(settings)) {
        await dbSaveSetting(k, v);
      }
    }
    // Clear legacy data after migration
    localStorage.removeItem('aei-expenses');
    localStorage.removeItem('aei-budgets');
    localStorage.removeItem('aei-settings');
    return true;
  } catch (e) {
    console.error('Migration failed:', e);
    return false;
  }
}
