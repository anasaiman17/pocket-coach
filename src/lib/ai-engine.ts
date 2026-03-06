import { Expense, Budget, Insight, BadSpendingAlert, SpendingRisk, Category, CATEGORIES } from './types';
import { format, parseISO, isWeekend, subMonths, isSameMonth, differenceInHours } from 'date-fns';

// Safely parse both 'yyyy-MM-dd' and full ISO strings without timezone shift
function safeParseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  // If it's just a date (yyyy-MM-dd or dd/MM/yyyy etc.), parse as local midnight
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return parseISO(dateStr);
}

function currentMonthExpenses(expenses: Expense[]): Expense[] {
  const now = new Date();
  return expenses.filter(e => isSameMonth(safeParseDate(e.date), now));
}

function previousMonthExpenses(expenses: Expense[]): Expense[] {
  return expenses.filter(e => isSameMonth(safeParseDate(e.date), subMonths(new Date(), 1)));
}

function categoryTotals(expenses: Expense[]): Record<string, number> {
  return expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);
}

function total(expenses: Expense[]): number {
  return expenses.reduce((s, e) => s + e.amount, 0);
}

export function generateInsights(expenses: Expense[], budgets: Budget[]): Insight[] {
  const insights: Insight[] = [];
  const curr = currentMonthExpenses(expenses);
  const prev = previousMonthExpenses(expenses);
  const currTotals = categoryTotals(curr);
  const prevTotals = categoryTotals(prev);
  const currTotal = total(curr);
  const prevTotal = total(prev);
  const month = format(new Date(), 'yyyy-MM');

  if (prevTotal > 0) {
    const change = ((currTotal - prevTotal) / prevTotal) * 100;
    if (Math.abs(change) > 10) {
      insights.push({
        id: 'monthly-change',
        type: change > 0 ? 'warning' : 'success',
        title: change > 0 ? 'Spending Increased' : 'Spending Decreased',
        message: `Your spending ${change > 0 ? 'increased' : 'decreased'} by ${Math.abs(Math.round(change))}% compared to last month.`,
      });
    }
  }

  CATEGORIES.forEach(cat => {
    const c = currTotals[cat] || 0;
    const p = prevTotals[cat] || 0;
    if (p > 0 && c > 0) {
      const change = ((c - p) / p) * 100;
      if (change > 20) {
        insights.push({
          id: `cat-${cat}`,
          type: 'warning',
          title: `${cat} Spending Up`,
          message: `You spent ${Math.round(change)}% more on ${cat} this month compared to last month.`,
          category: cat,
        });
      }
    }
  });

  const weekendTotal = curr.filter(e => isWeekend(safeParseDate(e.date))).reduce((s, e) => s + e.amount, 0);
  if (currTotal > 0 && weekendTotal / currTotal > 0.4) {
    insights.push({
      id: 'weekend',
      type: 'warning',
      title: 'High Weekend Spending',
      message: `Weekend spending accounts for ${Math.round(weekendTotal / currTotal * 100)}% of your total this month.`,
    });
  }

  budgets.filter(b => b.month === month).forEach(b => {
    const spent = currTotals[b.category] || 0;
    const ratio = spent / b.limit;
    if (ratio > 1) {
      insights.push({
        id: `over-${b.category}`,
        type: 'danger',
        title: `${b.category} Over Budget`,
        message: `You've exceeded your ${b.category} budget by ${Math.round((ratio - 1) * 100)}%.`,
        category: b.category,
      });
    } else if (ratio > 0.8) {
      insights.push({
        id: `near-${b.category}`,
        type: 'warning',
        title: `${b.category} Near Limit`,
        message: `You've used ${Math.round(ratio * 100)}% of your ${b.category} budget.`,
        category: b.category,
      });
    }
  });

  const top = Object.entries(currTotals).sort((a, b) => b[1] - a[1])[0];
  if (top && currTotal > 0) {
    insights.push({
      id: 'top-cat',
      type: 'info',
      title: `Top Category: ${top[0]}`,
      message: `${top[0]} is your highest category at ${Math.round(top[1] / currTotal * 100)}% of total spending.`,
      category: top[0] as Category,
    });
  }

  return insights;
}

export function calculateHealthScore(expenses: Expense[], budgets: Budget[]): { score: number; factors: string[] } {
  let score = 70;
  const factors: string[] = [];
  const curr = currentMonthExpenses(expenses);
  const prev = previousMonthExpenses(expenses);
  const currTotals = categoryTotals(curr);
  const currTotal = total(curr);
  const prevTotal = total(prev);
  const month = format(new Date(), 'yyyy-MM');
  const mb = budgets.filter(b => b.month === month);

  let over = 0;
  mb.forEach(b => {
    if ((currTotals[b.category] || 0) <= b.limit) score += 3;
    else { over++; score -= 5; }
  });
  if (over === 0 && mb.length > 0) factors.push('All categories within budget ✓');
  if (over > 0) factors.push(`${over} categor${over > 1 ? 'ies' : 'y'} over budget`);

  if (prevTotal > 0) {
    const change = (currTotal - prevTotal) / prevTotal;
    if (change < -0.05) { score += 10; factors.push('Spending trending down ✓'); }
    else if (change > 0.2) { score -= 10; factors.push('Spending increased significantly'); }
  }

  const wr = curr.filter(e => isWeekend(safeParseDate(e.date))).reduce((s, e) => s + e.amount, 0) / (currTotal || 1);
  if (wr > 0.45) { score -= 5; factors.push('Weekend overspending detected'); }
  if (factors.length === 0) factors.push('Looking good! Keep it up.');

  return { score: Math.max(0, Math.min(100, score)), factors };
}

export function detectBadSpending(expenses: Expense[], budgets: Budget[]): BadSpendingAlert[] {
  const alerts: BadSpendingAlert[] = [];
  const curr = currentMonthExpenses(expenses);
  const currTotals = categoryTotals(curr);
  const currTotal = total(curr);
  const nonEssential = ['Shopping', 'Entertainment', 'Other'];
  const month = format(new Date(), 'yyyy-MM');

  const sorted = [...curr].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const groups: Record<string, Expense[]> = {};
  sorted.forEach(e => { (groups[e.category] ??= []).push(e); });

  Object.entries(groups).forEach(([cat, exps]) => {
    if (nonEssential.includes(cat) && exps.length >= 3) {
      let impulse = 0;
      for (let i = 1; i < exps.length; i++) {
        if (Math.abs(differenceInHours(parseISO(exps[i].date), parseISO(exps[i - 1].date))) < 72) impulse++;
      }
      if (impulse >= 2) {
        alerts.push({
          id: `impulse-${cat}`, severity: 'high',
          title: `Impulse ${cat} Spending`,
          message: `You made ${impulse + 1} ${cat} purchases within short time spans this month.`,
          suggestion: `Try the 24-hour rule: wait a day before making non-essential ${cat} purchases.`,
          detectedAt: new Date().toISOString(),
        });
      }
    }
  });

  nonEssential.forEach(cat => {
    const ct = currTotals[cat] || 0;
    if (currTotal > 0 && ct / currTotal > 0.35) {
      alerts.push({
        id: `addiction-${cat}`, severity: 'medium',
        title: `High ${cat} Dependency`,
        message: `${Math.round(ct / currTotal * 100)}% of your spending goes to ${cat}.`,
        suggestion: `Set a stricter budget for ${cat} and find free alternatives.`,
        detectedAt: new Date().toISOString(),
      });
    }
  });

  budgets.filter(b => b.month === month).forEach(b => {
    const spent = currTotals[b.category] || 0;
    if (spent > b.limit * 1.2) {
      alerts.push({
        id: `budget-${b.category}`, severity: 'high',
        title: `${b.category} Budget Exceeded`,
        message: `Spent ₹${Math.round(spent)} against a ₹${b.limit} budget — ${Math.round((spent / b.limit - 1) * 100)}% over.`,
        suggestion: `Pause ${b.category} spending for the rest of the month.`,
        detectedAt: new Date().toISOString(),
      });
    }
  });

  const small = curr.filter(e => e.amount < 15);
  const smallTotal = small.reduce((s, e) => s + e.amount, 0);
  if (currTotal > 0 && smallTotal / currTotal > 0.15 && small.length > 8) {
    alerts.push({
      id: 'leakage', severity: 'low',
      title: 'Budget Leakage Detected',
      message: `${small.length} small purchases add up to ₹${Math.round(smallTotal)} (${Math.round(smallTotal / currTotal * 100)}% of total).`,
      suggestion: 'Consolidate small buys into planned shopping trips.',
      detectedAt: new Date().toISOString(),
    });
  }

  return alerts;
}

export function calculateSpendingRisk(expenses: Expense[], budgets: Budget[]): SpendingRisk {
  const alerts = detectBadSpending(expenses, budgets);
  const high = alerts.filter(a => a.severity === 'high').length;
  const med = alerts.filter(a => a.severity === 'medium').length;
  let score = Math.min(high * 30 + med * 15 + alerts.length * 5, 100);
  return {
    level: score > 60 ? 'High' : score > 30 ? 'Medium' : 'Low',
    score,
    factors: alerts.map(a => a.title),
  };
}

export function getMonthlyTotals(expenses: Expense[]): { month: string; amount: number }[] {
  const groups: Record<string, number> = {};
  expenses.forEach(e => {
    const m = format(parseISO(e.date), 'MMM yy');
    groups[m] = (groups[m] || 0) + e.amount;
  });
  return Object.entries(groups).map(([month, amount]) => ({ month, amount: Math.round(amount) }));
}

export function getCategoryBreakdown(expenses: Expense[]): { name: string; value: number }[] {
  const t = categoryTotals(expenses);
  return Object.entries(t).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value);
}
