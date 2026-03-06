import { Expense, formatCurrency } from './types';
import { parseISO, format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isWeekend, startOfWeek, endOfWeek, subMonths, isSameMonth, getWeek, getYear } from 'date-fns';

// Safely parse both 'yyyy-MM-dd' and full ISO strings without timezone shift
function safeParseDate(dateStr: string): Date {
  if (!dateStr) return new Date(NaN);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return parseISO(dateStr);
}

// ── Daily ──────────────────────────────────────────
export interface DailyBreakdown {
  days: { date: string; label: string; amount: number; isToday: boolean; isWeekend: boolean }[];
  today: number;
  totalThisMonth: number;
  todayVsAvg: number;
  topCategories: { name: string; amount: number; percent: number }[];
  insights: string[];
}

export function getDailyBreakdown(expenses: Expense[]): DailyBreakdown {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const allDays = eachDayOfInterval({ start: monthStart, end: now > monthEnd ? monthEnd : now });

  const thisMonth = expenses.filter(e => isSameMonth(parseISO(e.date), now));
  const dailyMap: Record<string, number> = {};
  thisMonth.forEach(e => {
    const d = format(parseISO(e.date), 'yyyy-MM-dd');
    dailyMap[d] = (dailyMap[d] || 0) + e.amount;
  });

  const days = allDays.map(d => {
    const key = format(d, 'yyyy-MM-dd');
    return {
      date: key,
      label: format(d, 'd'),
      amount: Math.round(dailyMap[key] || 0),
      isToday: isToday(d),
      isWeekend: isWeekend(d),
    };
  });

  const todayTotal = days.find(d => d.isToday)?.amount || 0;
  const totalThisMonth = thisMonth.reduce((s, e) => s + e.amount, 0);
  const daysWithSpending = days.filter(d => d.amount > 0);
  const avgDaily = daysWithSpending.length > 0 ? totalThisMonth / daysWithSpending.length : 0;
  const todayVsAvg = avgDaily > 0 ? Math.round(((todayTotal - avgDaily) / avgDaily) * 100) : 0;

  // Category breakdown for the month
  const catTotals: Record<string, number> = {};
  thisMonth.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
  const topCategories = Object.entries(catTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([name, amount]) => ({ name, amount: Math.round(amount), percent: Math.round((amount / totalThisMonth) * 100) }));

  // Insights
  const insights: string[] = [];
  const highestDay = [...days].sort((a, b) => b.amount - a.amount)[0];
  if (highestDay && highestDay.amount > 0) {
    insights.push(`Highest spending day: ${format(parseISO(highestDay.date), 'MMM d')} at ${formatCurrency(highestDay.amount)}.`);
  }
  const weekendSpend = thisMonth.filter(e => isWeekend(parseISO(e.date))).reduce((s, e) => s + e.amount, 0);
  const weekdaySpend = totalThisMonth - weekendSpend;
  if (totalThisMonth > 0) {
    insights.push(`Weekday spending: ${formatCurrency(weekdaySpend)} (${Math.round(weekdaySpend / totalThisMonth * 100)}%) vs Weekend: ${formatCurrency(weekendSpend)} (${Math.round(weekendSpend / totalThisMonth * 100)}%).`);
  }
  if (todayTotal > avgDaily * 1.5 && todayTotal > 0) {
    insights.push(`Today's spending is significantly above your daily average of ${formatCurrency(avgDaily)}.`);
  }
  const zeroSpendDays = days.filter(d => d.amount === 0 && !d.isToday).length;
  if (zeroSpendDays > 0) {
    insights.push(`You had ${zeroSpendDays} zero-spend day${zeroSpendDays > 1 ? 's' : ''} this month — keep it up!`);
  }

  return { days, today: todayTotal, totalThisMonth, todayVsAvg, topCategories, insights };
}

// ── Weekly ─────────────────────────────────────────
export interface WeeklyBreakdown {
  weeks: { label: string; total: number; weekday: number; weekend: number; count: number }[];
  thisWeekTotal: number;
  weekChange: number;
  insights: string[];
}

export function getWeeklyBreakdown(expenses: Expense[]): WeeklyBreakdown {
  const now = new Date();
  // Get expenses from last 8 weeks
  const eightWeeksAgo = subMonths(now, 2);
  const recent = expenses.filter(e => parseISO(e.date) >= eightWeeksAgo);

  const weekMap: Record<string, { total: number; weekday: number; weekend: number; count: number }> = {};

  recent.forEach(e => {
    const d = parseISO(e.date);
    const weekStart = startOfWeek(d, { weekStartsOn: 1 });
    const key = format(weekStart, 'MMM d');
    if (!weekMap[key]) weekMap[key] = { total: 0, weekday: 0, weekend: 0, count: 0 };
    weekMap[key].total += e.amount;
    weekMap[key].count++;
    if (isWeekend(d)) weekMap[key].weekend += e.amount;
    else weekMap[key].weekday += e.amount;
  });

  const weeks = Object.entries(weekMap)
    .map(([label, data]) => ({
      label,
      total: Math.round(data.total),
      weekday: Math.round(data.weekday),
      weekend: Math.round(data.weekend),
      count: data.count,
    }))
    .slice(-8);

  const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
  const thisWeekKey = format(thisWeekStart, 'MMM d');
  const thisWeekTotal = weekMap[thisWeekKey]?.total || 0;

  const lastWeekStart = startOfWeek(new Date(now.getTime() - 7 * 86400000), { weekStartsOn: 1 });
  const lastWeekKey = format(lastWeekStart, 'MMM d');
  const lastWeekTotal = weekMap[lastWeekKey]?.total || 0;
  const weekChange = lastWeekTotal > 0 ? Math.round(((thisWeekTotal - lastWeekTotal) / lastWeekTotal) * 100) : 0;

  // Insights
  const insights: string[] = [];
  const avgWeekly = weeks.length > 0 ? weeks.reduce((s, w) => s + w.total, 0) / weeks.length : 0;
  if (thisWeekTotal > avgWeekly * 1.3 && thisWeekTotal > 0) {
    insights.push(`This week's spending is ${Math.round(((thisWeekTotal - avgWeekly) / avgWeekly) * 100)}% above your weekly average.`);
  }
  const totalWeekend = weeks.reduce((s, w) => s + w.weekend, 0);
  const totalAll = weeks.reduce((s, w) => s + w.total, 0);
  if (totalAll > 0 && totalWeekend / totalAll > 0.35) {
    insights.push(`Weekend spending accounts for ${Math.round(totalWeekend / totalAll * 100)}% of your recent spending.`);
  }
  const bestWeek = [...weeks].sort((a, b) => a.total - b.total)[0];
  if (bestWeek && weeks.length > 1) {
    insights.push(`Your lowest spending week was ${bestWeek.label} at ${formatCurrency(bestWeek.total)}.`);
  }
  if (weekChange < -10) {
    insights.push(`Great job! Spending is down ${Math.abs(weekChange)}% compared to last week.`);
  }

  return { weeks, thisWeekTotal: Math.round(thisWeekTotal), weekChange, insights };
}

// ── Monthly ────────────────────────────────────────
export interface MonthlyBreakdown {
  months: { label: string; total: number }[];
  avgMonthlySpend: number;
  monthChange: number;
  categoryComparison: { category: string; thisMonth: number; lastMonth: number }[];
  insights: string[];
}

export function getMonthlyBreakdown(expenses: Expense[]): MonthlyBreakdown {
  const now = new Date();
  const monthMap: Record<string, number> = {};
  expenses.forEach(e => {
    const m = format(parseISO(e.date), 'MMM yy');
    monthMap[m] = (monthMap[m] || 0) + e.amount;
  });

  const months = Object.entries(monthMap)
    .map(([label, total]) => ({ label, total: Math.round(total) }));

  const thisMonthExps = expenses.filter(e => isSameMonth(parseISO(e.date), now));
  const lastMonthExps = expenses.filter(e => isSameMonth(parseISO(e.date), subMonths(now, 1)));
  const thisTotal = thisMonthExps.reduce((s, e) => s + e.amount, 0);
  const lastTotal = lastMonthExps.reduce((s, e) => s + e.amount, 0);
  const avgMonthlySpend = months.length > 0 ? months.reduce((s, m) => s + m.total, 0) / months.length : 0;
  const monthChange = lastTotal > 0 ? Math.round(((thisTotal - lastTotal) / lastTotal) * 100) : 0;

  // Category comparison
  const thisCats: Record<string, number> = {};
  const lastCats: Record<string, number> = {};
  thisMonthExps.forEach(e => { thisCats[e.category] = (thisCats[e.category] || 0) + e.amount; });
  lastMonthExps.forEach(e => { lastCats[e.category] = (lastCats[e.category] || 0) + e.amount; });
  const allCats = new Set([...Object.keys(thisCats), ...Object.keys(lastCats)]);
  const categoryComparison = Array.from(allCats)
    .map(category => ({
      category,
      thisMonth: Math.round(thisCats[category] || 0),
      lastMonth: Math.round(lastCats[category] || 0),
    }))
    .sort((a, b) => (b.thisMonth + b.lastMonth) - (a.thisMonth + a.lastMonth))
    .slice(0, 6);

  // Insights
  const insights: string[] = [];
  if (monthChange > 15) {
    insights.push(`Spending increased ${monthChange}% compared to last month. Consider reviewing non-essential categories.`);
  } else if (monthChange < -10) {
    insights.push(`Great progress! Spending decreased ${Math.abs(monthChange)}% from last month.`);
  }

  categoryComparison.forEach(cc => {
    if (cc.lastMonth > 0 && cc.thisMonth > cc.lastMonth * 1.5) {
      insights.push(`${cc.category} spending jumped ${Math.round(((cc.thisMonth - cc.lastMonth) / cc.lastMonth) * 100)}% vs last month.`);
    }
  });

  if (months.length >= 3) {
    const recent3 = months.slice(-3);
    const trend = recent3[2]?.total > recent3[0]?.total;
    if (trend) {
      insights.push('Your spending has been trending upward over the last 3 months.');
    } else {
      insights.push('Your spending has been stable or declining — nice work!');
    }
  }

  return { months, avgMonthlySpend: Math.round(avgMonthlySpend), monthChange, categoryComparison, insights };
}
