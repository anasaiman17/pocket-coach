import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Activity, Target, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip } from 'recharts';
import { useExpenses } from '@/lib/ExpenseContext';
import { formatCurrency, CATEGORY_COLORS, CATEGORY_ICONS, Category } from '@/lib/types';
import { getMonthlyTotals, getCategoryBreakdown } from '@/lib/ai-engine';
import { format, parseISO, isSameMonth } from 'date-fns';

// Safely parse both 'yyyy-MM-dd' and full ISO strings without timezone shift
function safeParseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return parseISO(dateStr);
}
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const { expenses, healthScore, spendingRisk, insights, badSpendingAlerts, badSpendingMode } = useExpenses();

  const currentMonth = useMemo(() => {
    const now = new Date();
    return expenses.filter(e => isSameMonth(parseISO(e.date), now));
  }, [expenses]);

  const monthTotal = useMemo(() => currentMonth.reduce((s, e) => s + e.amount, 0), [currentMonth]);
  const categoryData = useMemo(() => getCategoryBreakdown(currentMonth), [currentMonth]);
  const trendData = useMemo(() => getMonthlyTotals(expenses), [expenses]);
  const recentExpenses = useMemo(
    () => [...expenses].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 5),
    [expenses]
  );

  const scoreColor = healthScore.score >= 70 ? 'hsl(var(--primary))' : healthScore.score >= 40 ? 'hsl(var(--accent))' : 'hsl(var(--destructive))';
  const riskColor = spendingRisk.level === 'Low' ? 'text-primary' : spendingRisk.level === 'Medium' ? 'text-accent' : 'text-destructive';
  const circumference = 2 * Math.PI * 38;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">{format(new Date(), 'MMMM yyyy')} Overview</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <DollarSign size={16} />
            <span>This Month</span>
          </div>
          <p className="text-2xl font-bold">{formatCurrency(monthTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">{currentMonth.length} transactions</p>
        </div>

        <div className="stat-card score-gradient">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <Activity size={16} />
            <span>Health Score</span>
          </div>
          <div className="flex items-center gap-3">
            <svg className="w-14 h-14 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="38" fill="none" strokeWidth="7" className="stroke-muted" />
              <circle cx="50" cy="50" r="38" fill="none" strokeWidth="7" strokeLinecap="round"
                style={{ stroke: scoreColor, strokeDasharray: `${(healthScore.score / 100) * circumference} ${circumference}` }}
              />
            </svg>
            <div>
              <p className="text-2xl font-bold">{healthScore.score}</p>
              <p className="text-xs text-muted-foreground">/100</p>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <Target size={16} />
            <span>Budget Status</span>
          </div>
          <p className="text-2xl font-bold">{insights.filter(i => i.type === 'danger').length}</p>
          <p className="text-xs text-muted-foreground mt-1">categories over budget</p>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
            <AlertTriangle size={16} />
            <span>Risk Level</span>
          </div>
          <p className={`text-2xl font-bold ${riskColor}`}>{spendingRisk.level}</p>
          <p className="text-xs text-muted-foreground mt-1">{badSpendingMode ? `${badSpendingAlerts.length} alerts` : 'Detector off'}</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Category Breakdown</h3>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3}>
                    {categoryData.map((entry) => (
                      <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name as Category] || '#6B7280'} />
                    ))}
                  </Pie>
                  <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {categoryData.slice(0, 5).map(d => (
                  <div key={d.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[d.name as Category] }} />
                      <span className="text-muted-foreground">{d.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>
          )}
        </div>

        <div className="glass-card p-5">
          <h3 className="text-sm font-semibold mb-4">Monthly Trend</h3>
          {trendData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={v => `$${v}`} />
                <RTooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
                <Area type="monotone" dataKey="amount" stroke="hsl(var(--primary))" fill="url(#trendGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-10">No data yet</p>
          )}
        </div>
      </div>

      {/* Insights Preview */}
      {insights.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold">Latest Insights</h3>
            <Link to="/insights" className="text-xs text-primary hover:underline">View all →</Link>
          </div>
          <div className="space-y-2">
            {insights.slice(0, 3).map(i => (
              <div key={i.id} className={`insight-card-${i.type}`}>
                <div className="flex items-start gap-2">
                  {i.type === 'warning' || i.type === 'danger' ? <AlertTriangle size={14} className="mt-0.5 text-accent shrink-0" /> :
                    i.type === 'success' ? <TrendingDown size={14} className="mt-0.5 text-primary shrink-0" /> :
                    <TrendingUp size={14} className="mt-0.5 text-muted-foreground shrink-0" />}
                  <div>
                    <p className="text-sm font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{i.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Expenses */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold">Recent Expenses</h3>
          <Link to="/expenses" className="text-xs text-primary hover:underline">View all →</Link>
        </div>
        <div className="space-y-2">
          {recentExpenses.map(e => (
            <div key={e.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
              <div className="flex items-center gap-3">
                <span className="text-lg">{CATEGORY_ICONS[e.category as Category]}</span>
                <div>
                  <p className="text-sm font-medium">{e.category}</p>
                  <p className="text-xs text-muted-foreground">{format(parseISO(e.date), 'MMM d, yyyy')}</p>
                </div>
              </div>
              <span className="text-sm font-semibold">{formatCurrency(e.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
