export const CATEGORIES = ['Food', 'Travel', 'Rent', 'Shopping', 'Utilities', 'Health', 'Education', 'Entertainment', 'Other'] as const;
export type Category = typeof CATEGORIES[number];

export const PAYMENT_MODES = ['Cash', 'Credit Card', 'Debit Card', 'UPI', 'Bank Transfer', 'Other'] as const;
export type PaymentMode = typeof PAYMENT_MODES[number];

export interface Expense {
  id: string;
  amount: number;
  category: Category;
  date: string;
  paymentMode: PaymentMode;
  notes: string;
  createdAt: string;
}

export interface Budget {
  category: Category;
  limit: number;
  month: string;
}

export interface Insight {
  id: string;
  type: 'info' | 'warning' | 'success' | 'danger';
  title: string;
  message: string;
  category?: Category;
}

export interface BadSpendingAlert {
  id: string;
  severity: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  suggestion: string;
  detectedAt: string;
}

export interface SpendingRisk {
  level: 'Low' | 'Medium' | 'High';
  score: number;
  factors: string[];
}

export const CATEGORY_COLORS: Record<Category, string> = {
  Food: '#10B981',
  Travel: '#3B82F6',
  Rent: '#8B5CF6',
  Shopping: '#F59E0B',
  Utilities: '#6366F1',
  Health: '#EC4899',
  Education: '#14B8A6',
  Entertainment: '#F97316',
  Other: '#6B7280',
};

export const CATEGORY_ICONS: Record<Category, string> = {
  Food: '🍔',
  Travel: '✈️',
  Rent: '🏠',
  Shopping: '🛍️',
  Utilities: '💡',
  Health: '🏥',
  Education: '📚',
  Entertainment: '🎬',
  Other: '📦',
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount);
