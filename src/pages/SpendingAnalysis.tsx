import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, AreaChart, Area, Cell, Legend } from 'recharts';
import { useExpenses } from '@/lib/ExpenseContext';
import { formatCurrency, CATEGORY_COLORS, Category } from '@/lib/types';
import { getDailyBreakdown, getWeeklyBreakdown, getMonthlyBreakdown } from '@/lib/spending-analysis';
import { CalendarDays, CalendarRange, Calendar, TrendingUp, TrendingDown, ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { parseISO, format, isSameMonth, addMonths, subMonths } from 'date-fns';

const tooltipStyle = { background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' };

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

function StatCard({ title, value, subtitle, icon: Icon, trend }: {
  title: string; value: string; subtitle: string;
  icon: React.ElementType; trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <div className="glass-card p-4 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-primary/10">
        <Icon size={18} className="text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{title}</p>
        <p className="text-lg font-bold mt-0.5">{value}</p>
        <div className="flex items-center gap-1 mt-1">
          {trend === 'up' && <TrendingUp size={12} className="text-destructive" />}
          {trend === 'down' && <TrendingDown size={12} className="text-emerald-500" />}
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

export default function SpendingAnalysis() {
  const { expenses } = useExpenses();
  const [activeTab, setActiveTab] = useState('daily');

  const defaultMonth = useMemo(() => getMostRecentMonth(expenses), [expenses]);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const activeMonth = selectedMonth ?? defaultMonth;

  const daily = useMemo(() => getDailyBreakdown(expenses, activeMonth), [expenses, activeMonth]);
  const weekly = useMemo(() => getWeeklyBreakdown(expenses, activeMonth), [expenses, activeMonth]);
  const monthly = useMemo(() => getMonthlyBreakdown(expenses, activeMonth), [expenses, activeMonth]);

  const dailyAvg = daily.days.length > 0 ? daily.totalThisMonth / Math.max(daily.days.length, 1) : 0;
  const weeklyAvg = weekly.weeks.length > 0 ? weekly.weeks.reduce((s, w) => s + w.total, 0) / weekly.weeks.length : 0;

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
          <h1 className="text-2xl font-bold">Spending Analysis</h1>
          <p className="text-sm text-muted-foreground">Daily, weekly & monthly breakdown of your spending</p>
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

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          title="Today's Spending"
          value={formatCurrency(daily.today)}
          subtitle={daily.todayVsAvg > 0 ? `${daily.todayVsAvg}% above avg` : `${Math.abs(daily.todayVsAvg)}% below avg`}
          icon={CalendarDays}
          trend={daily.todayVsAvg > 15 ? 'up' : daily.todayVsAvg < -15 ? 'down' : 'neutral'}
        />
        <StatCard
          title="This Week"
          value={formatCurrency(weekly.thisWeekTotal)}
          subtitle={weekly.weekChange > 0 ? `${weekly.weekChange}% vs last week` : `${Math.abs(weekly.weekChange)}% less`}
          icon={CalendarRange}
          trend={weekly.weekChange > 10 ? 'up' : weekly.weekChange < -10 ? 'down' : 'neutral'}
        />
        <StatCard
          title="This Month"
          value={formatCurrency(daily.totalThisMonth)}
          subtitle={`Daily avg: ${formatCurrency(dailyAvg)}`}
          icon={Calendar}
          trend="neutral"
        />
        <StatCard
          title="Monthly Avg"
          value={formatCurrency(monthly.avgMonthlySpend)}
          subtitle={monthly.monthChange > 0 ? `${monthly.monthChange}% vs last month` : `${Math.abs(monthly.monthChange)}% less`}
          icon={TrendingUp}
          trend={monthly.monthChange > 10 ? 'up' : monthly.monthChange < -10 ? 'down' : 'neutral'}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        {/* Daily Tab */}
        <TabsContent value="daily" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4">Daily Spending (This Month)</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={daily.days}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="amount" radius={[4, 4, 0, 0]} barSize={16}>
                    {daily.days.map((d, i) => (
                      <Cell key={i} fill={d.isToday ? 'hsl(var(--accent))' : d.isWeekend ? 'hsl(var(--primary)/0.5)' : 'hsl(var(--primary))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4">Daily Category Split</h3>
              <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                {daily.topCategories.map(cat => (
                  <div key={cat.name} className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: CATEGORY_COLORS[cat.name as Category] || '#6B7280' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between text-sm">
                        <span className="truncate">{cat.name}</span>
                        <span className="font-medium">{formatCurrency(cat.amount)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full mt-1">
                        <div className="h-full rounded-full transition-all" style={{ width: `${cat.percent}%`, backgroundColor: CATEGORY_COLORS[cat.name as Category] || '#6B7280' }} />
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground w-10 text-right">{cat.percent}%</span>
                  </div>
                ))}
                {daily.topCategories.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">No expenses this month</p>
                )}
              </div>
            </div>
          </div>

          {/* Daily Insights */}
          {daily.insights.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">Daily Insights</h3>
              <div className="space-y-2">
                {daily.insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Weekly Tab */}
        <TabsContent value="weekly" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4">Weekly Totals</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weekly.weeks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="total" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={28} name="Total" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4">Weekday vs Weekend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={weekly.weeks}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="weekday" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} barSize={14} name="Weekday" />
                  <Bar dataKey="weekend" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} barSize={14} name="Weekend" />
                  <Legend formatter={(v: string) => <span className="text-xs text-muted-foreground">{v}</span>} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {weekly.insights.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">Weekly Insights</h3>
              <div className="space-y-2">
                {weekly.insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Monthly Tab */}
        <TabsContent value="monthly" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4">Monthly Spending Trend</h3>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthly.months}>
                  <defs>
                    <linearGradient id="monthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#monthGrad)" strokeWidth={2} name="Total" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-4">Monthly Category Comparison</h3>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={monthly.categoryComparison} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `₹${v}`} />
                  <YAxis type="category" dataKey="category" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={tooltipStyle} />
                  <Bar dataKey="lastMonth" fill="hsl(var(--muted))" radius={[0, 4, 4, 0]} barSize={10} name="Last Month" />
                  <Bar dataKey="thisMonth" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={10} name="This Month" />
                  <Legend formatter={(v: string) => <span className="text-xs text-muted-foreground">{v}</span>} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {monthly.insights.length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold mb-3">Monthly Insights</h3>
              <div className="space-y-2">
                {monthly.insights.map((insight, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <ArrowRight size={14} className="text-primary mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{insight}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
