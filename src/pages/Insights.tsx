import { motion } from 'framer-motion';
import { AlertTriangle, TrendingDown, TrendingUp, Info, ShieldAlert, Lightbulb } from 'lucide-react';
import { useExpenses } from '@/lib/ExpenseContext';

const severityColors = { low: 'text-primary', medium: 'text-accent', high: 'text-destructive' };
const severityBg = { low: 'bg-primary/10', medium: 'bg-accent/10', high: 'bg-destructive/10' };

export default function Insights() {
  const { insights, badSpendingAlerts, spendingRisk, healthScore, badSpendingMode } = useExpenses();

  const riskColor = spendingRisk.level === 'Low' ? 'text-primary' : spendingRisk.level === 'Medium' ? 'text-accent' : 'text-destructive';

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Insights</h1>
        <p className="text-sm text-muted-foreground">Intelligent analysis of your spending patterns</p>
      </div>

      {/* Score Cards */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="glass-card p-5 score-gradient">
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert size={18} className="text-primary" />
            <h3 className="font-semibold text-sm">Financial Health Score</h3>
          </div>
          <p className="text-4xl font-bold mb-2">{healthScore.score}<span className="text-lg text-muted-foreground">/100</span></p>
          <ul className="space-y-1">
            {healthScore.factors.map((f, i) => (
              <li key={i} className="text-xs text-muted-foreground">• {f}</li>
            ))}
          </ul>
        </div>

        <div className="glass-card p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} className={riskColor} />
            <h3 className="font-semibold text-sm">Spending Risk</h3>
          </div>
          <p className={`text-4xl font-bold mb-2 ${riskColor}`}>{spendingRisk.level}</p>
          <p className="text-xs text-muted-foreground">
            {badSpendingMode
              ? `${badSpendingAlerts.length} active alert${badSpendingAlerts.length !== 1 ? 's' : ''} detected`
              : 'Enable Bad Spending Detector for alerts'}
          </p>
        </div>
      </div>

      {/* AI Insights */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Pattern Analysis</h2>
        {insights.length > 0 ? (
          <div className="space-y-3">
            {insights.map(i => (
              <div key={i.id} className={`insight-card-${i.type}`}>
                <div className="flex items-start gap-3">
                  {i.type === 'danger' ? <AlertTriangle size={16} className="mt-0.5 text-destructive shrink-0" /> :
                   i.type === 'warning' ? <AlertTriangle size={16} className="mt-0.5 text-accent shrink-0" /> :
                   i.type === 'success' ? <TrendingDown size={16} className="mt-0.5 text-primary shrink-0" /> :
                   <Info size={16} className="mt-0.5 text-muted-foreground shrink-0" />}
                  <div>
                    <p className="text-sm font-medium">{i.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{i.message}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-card p-8 text-center text-muted-foreground text-sm">
            Add more expenses to generate insights
          </div>
        )}
      </div>

      {/* Bad Spending Alerts */}
      {badSpendingMode && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <ShieldAlert size={18} className="text-accent" />
            Bad Spending Alerts
          </h2>
          {badSpendingAlerts.length > 0 ? (
            <div className="space-y-3">
              {badSpendingAlerts.map(a => (
                <div key={a.id} className={`glass-card p-4 border-l-4 ${
                  a.severity === 'high' ? 'border-l-destructive' :
                  a.severity === 'medium' ? 'border-l-accent' : 'border-l-primary'
                }`}>
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${severityBg[a.severity]} ${severityColors[a.severity]}`}>
                        {a.severity.toUpperCase()}
                      </span>
                      <h4 className="text-sm font-medium">{a.title}</h4>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{a.message}</p>
                  <div className="flex items-start gap-2 p-2 rounded-lg bg-muted/50">
                    <Lightbulb size={14} className="text-accent mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground">{a.suggestion}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card p-8 text-center text-sm">
              <p className="text-primary font-medium mb-1">✓ No bad spending detected</p>
              <p className="text-muted-foreground">Your spending habits look healthy!</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
