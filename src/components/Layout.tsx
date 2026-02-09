import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Receipt, BarChart3, Wallet, Brain, Sun, Moon, Shield, TrendingUp } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { useExpenses } from '@/lib/ExpenseContext';
import { Switch } from '@/components/ui/switch';
import { ReactNode } from 'react';

const nav = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/expenses', icon: Receipt, label: 'Expenses' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/spending', icon: TrendingUp, label: 'Analysis' },
  { to: '/budgets', icon: Wallet, label: 'Budgets' },
  { to: '/insights', icon: Brain, label: 'Insights' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const isMobile = useIsMobile();
  const { badSpendingMode, toggleBadSpendingMode, theme, toggleTheme } = useExpenses();

  const isActive = (to: string) => (to === '/' ? pathname === '/' : pathname.startsWith(to));

  if (isMobile) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-primary">AI Expense</h1>
          <div className="flex items-center gap-3">
            <button onClick={toggleTheme} className="text-muted-foreground hover:text-foreground transition-colors">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <div className="flex items-center gap-1.5">
              <Shield size={14} className={badSpendingMode ? 'text-accent' : 'text-muted-foreground'} />
              <Switch checked={badSpendingMode} onCheckedChange={toggleBadSpendingMode} className="scale-75" />
            </div>
          </div>
        </header>
        <main className="p-4 pb-24">{children}</main>
        <nav className="fixed bottom-0 left-0 right-0 z-40 bg-card/90 backdrop-blur-md border-t border-border flex justify-around py-2 px-1">
          {nav.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex flex-col items-center gap-0.5 px-2 py-1 rounded-lg transition-colors text-xs ${
                isActive(item.to) ? 'text-primary' : 'text-muted-foreground'
              }`}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-64 bg-sidebar border-r border-sidebar-border p-5 flex flex-col fixed h-full z-30">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-primary tracking-tight">AI Expense</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Intelligence Engine</p>
        </div>
        <nav className="flex-1 space-y-1">
          {nav.map(item => (
            <Link
              key={item.to}
              to={item.to}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive(item.to)
                  ? 'bg-primary/10 text-primary glow-primary'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <item.icon size={18} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="space-y-3 pt-4 border-t border-sidebar-border">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 text-sm text-sidebar-foreground">
              <Shield size={15} className={badSpendingMode ? 'text-accent' : ''} />
              <span>Bad Spend Detector</span>
            </div>
            <Switch checked={badSpendingMode} onCheckedChange={toggleBadSpendingMode} />
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full"
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>
      <main className="ml-64 flex-1 p-6 min-h-screen">{children}</main>
    </div>
  );
}
