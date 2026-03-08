import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useExpenses } from '@/lib/ExpenseContext';
import { CATEGORIES, CATEGORY_ICONS, formatCurrency, Category } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { format, isSameMonth, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function safeParseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(dateStr);
}

function getMostRecentMonth(expenses: { date: string }[]): Date {
  if (!expenses.length) return new Date();
  const sorted = [...expenses].sort((a, b) =>
    safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime()
  );
  return safeParseDate(sorted[0].date);
}

export default function Budgets() {
  const { expenses, budgets, setBudget } = useExpenses();

  const defaultMonth = useMemo(() => getMostRecentMonth(expenses), [expenses]);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const activeMonth = selectedMonth ?? defaultMonth;
  const month = format(activeMonth, 'yyyy-MM');

  const isCurrentMonth = isSameMonth(activeMonth, new Date());
  const prevMonth = () => setSelectedMonth(subMonths(activeMonth, 1));
  const nextMonth = () => {
    const next = addMonths(activeMonth, 1);
    if (next <= new Date()) setSelectedMonth(next);
  };

  const spending = useMemo(() => {
    const filtered = expenses.filter(e => isSameMonth(safeParseDate(e.date), activeMonth));
    return filtered.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [expenses, activeMonth]);

  const getBudgetForCategory = (cat: string) =>
    budgets.find(b => b.category === cat && b.month === month)?.limit || 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Budgets</h1>
          <p className="text-sm text-muted-foreground">Set and track monthly spending limits</p>
        </div>
        {/* Month Picker */}
        <div className="flex items-center gap-1 glass-card px-2 py-1 rounded-lg self-start sm:self-auto">
          <button onClick={prevMonth} className="p-1 rounded hover:bg-muted transition-colors">
            <ChevronLeft size={16} className="text-muted-foreground" />
          </button>
          <span className="text-sm font-medium px-2 min-w-[110px] text-center">
            {format(activeMonth, 'MMMM yyyy')}
          </span>
          <button onClick={nextMonth} disabled={isCurrentMonth} className="p-1 rounded hover:bg-muted transition-colors disabled:opacity-30">
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CATEGORIES.map(cat => {
          const budget = getBudgetForCategory(cat);
          const spent = Math.round((spending[cat] || 0) * 100) / 100;
          const ratio = budget > 0 ? (spent / budget) * 100 : 0;
          const overBudget = ratio > 100;

          return (
            <div key={cat} className={`glass-card p-5 ${overBudget ? 'border-destructive/40' : ''}`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{CATEGORY_ICONS[cat as Category]}</span>
                  <h3 className="font-semibold text-sm">{cat}</h3>
                </div>
                {overBudget && <span className="text-xs text-destructive font-medium">Over budget</span>}
              </div>

              <div className="flex items-baseline justify-between mb-2">
                <span className="text-lg font-bold">{formatCurrency(spent)}</span>
                <span className="text-xs text-muted-foreground">
                  / {budget > 0 ? formatCurrency(budget) : '—'}
                </span>
              </div>

              <Progress
                value={Math.min(ratio, 100)}
                className={`h-2 mb-3 ${overBudget ? '[&>div]:bg-destructive' : ''}`}
              />

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Budget ₹</span>
                <Input
                  type="number"
                  min="0"
                  step="10"
                  value={budget || ''}
                  onChange={e => setBudget(cat, parseFloat(e.target.value) || 0, month)}
                  placeholder="Set budget"
                  className="h-8 text-sm"
                />
              </div>

              {budget > 0 && (
                <p className="text-xs text-muted-foreground mt-2">
                  {overBudget
                    ? `${formatCurrency(spent - budget)} over limit`
                    : `${formatCurrency(budget - spent)} remaining`}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}
