import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useExpenses } from '@/lib/ExpenseContext';
import { CATEGORIES, CATEGORY_ICONS, formatCurrency, Category } from '@/lib/types';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { format, parseISO, isSameMonth } from 'date-fns';

export default function Budgets() {
  const { expenses, budgets, setBudget } = useExpenses();
  const currentMonth = format(new Date(), 'yyyy-MM');
  const [month] = useState(currentMonth);

  const spending = useMemo(() => {
    const target = new Date(month + '-01');
    const filtered = expenses.filter(e => isSameMonth(parseISO(e.date), target));
    return filtered.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
  }, [expenses, month]);

  const getBudgetForCategory = (cat: string) =>
    budgets.find(b => b.category === cat && b.month === month)?.limit || 0;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Budgets</h1>
        <p className="text-sm text-muted-foreground">Set and track monthly budgets — {format(new Date(month + '-01'), 'MMMM yyyy')}</p>
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
                <span className="text-xs text-muted-foreground whitespace-nowrap">Budget $</span>
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
