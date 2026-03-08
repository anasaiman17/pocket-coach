import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, BarChart, Bar, Legend } from 'recharts';
import { useExpenses } from '@/lib/ExpenseContext';
import { formatCurrency, CATEGORY_COLORS, Category } from '@/lib/types';
import { getMonthlyTotals, getCategoryBreakdown } from '@/lib/ai-engine';
import { parseISO, isSameMonth, format, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function safeParseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return parseISO(dateStr);
}

function getMostRecentMonth(expenses: { date: string }[]): Date {
  if (!expenses.length) return new Date();
  const sorted = [...expenses].sort((a, b) =>
    safeParseDate(b.date).getTime() - safeParseDate(a.date).getTime()
  );
  return safeParseDate(sorted[0].date);
}

const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' };

export default function Analytics() {
  const { expenses, budgets } = useExpenses();

  const defaultMonth = useMemo(() => getMostRecentMonth(expenses), [expenses]);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  // When new data arrives (e.g. after import), if no manual selection reset to latest month
  const activeMonth = selectedMonth ?? defaultMonth;

  const currentMonth = useMemo(
    () => expenses.filter(e => isSameMonth(safeParseDate(e.date), activeMonth)),
    [expenses, activeMonth]
  );

  const categoryData = useMemo(() => getCategoryBreakdown(currentMonth), [currentMonth]);
  const trendData = useMemo(() => getMonthlyTotals(expenses), [expenses]);
  const month = format(activeMonth, 'yyyy-MM');

  const budgetVsActual = useMemo(() => {
    const totals = currentMonth.reduce((acc, e) => {
      acc[e.category] = (acc[e.category] || 0) + e.amount;
      return acc;
    }, {} as Record<string, number>);
    return budgets
      .filter(b => b.month === month)
      .map(b => ({ category: b.category, budget: b.limit, actual: Math.round(totals[b.category] || 0) }));
  }, [currentMonth, budgets, month]);

  const dayOfWeek = useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const totals = Array(7).fill(0);
    currentMonth.forEach(e => { totals[safeParseDate(e.date).getDay()] += e.amount; });
    return days.map((day, i) => ({ day, amount: Math.round(totals[i]) }));
  }, [currentMonth]);

  const prevMonth = () => setSelectedMonth(subMonths(activeMonth, 1));
  const nextMonth = () => {
    const next = addMonths(activeMonth, 1);
    if (next <= new Date()) setSelectedMonth(next);
  };
  const isCurrentMonth = isSameMonth(activeMonth, new Date());

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-sm text-muted-foreground">Visual breakdown of your spending</p>
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

      <div className="grid md:grid-cols-2 gap-4">
        {/* Category Breakdown */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Category Breakdown</h3>
          {categoryData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {categoryData.map(e => <Cell key={e.name} fill={CATEGORY_COLORS[e.name as Category] || '#6B7280'} />)}
                </Pie>
                <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                <Legend formatter={(v: string) => <span className="text-xs text-muted-foreground">{v}</span>} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">No data for {format(activeMonth, 'MMMM yyyy')}</p>
          )}
        </div>

        {/* Monthly Trend */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
              <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#aGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Budget vs Actual */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Budget vs Actual</h3>
          {budgetVsActual.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={budgetVsActual} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                <YAxis type="category" dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                <Bar dataKey="budget" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} barSize={12} name="Budget" />
                <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={12} name="Actual" />
                <Legend formatter={(v: string) => <span className="text-xs text-muted-foreground">{v}</span>} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-16">Set budgets to see comparison</p>
          )}
        </div>

        {/* Day of Week */}
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Spending by Day of Week</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={dayOfWeek}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
              <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={32}>
                {dayOfWeek.map((d, i) => (
                  <Cell key={d.day} fill={i === 0 || i === 6 ? 'hsl(var(--accent))' : 'hsl(var(--primary))'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
