import { useState, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, Edit, Download, Upload, Search, FileUp, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useExpenses } from '@/lib/ExpenseContext';
import { formatCurrency, CATEGORY_ICONS, Category } from '@/lib/types';
import ExpenseForm from '@/components/ExpenseForm';
import CsvImportModal from '@/components/CsvImportModal';
import PdfImportModal from '@/components/PdfImportModal';
import { format, parseISO } from 'date-fns';
import type { Expense } from '@/lib/types';

export default function Expenses() {
  const { expenses, deleteExpense, exportData, importData } = useExpenses();
  const [formOpen, setFormOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | undefined>();
  const [search, setSearch] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const s = search.toLowerCase();
    return [...expenses]
      .filter(e => !s || e.category.toLowerCase().includes(s) || e.notes.toLowerCase().includes(s) || e.paymentMode.toLowerCase().includes(s))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, search]);

  const handleEdit = (e: Expense) => {
    setEditingExpense(e);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingExpense(undefined);
    setFormOpen(true);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = ev => importData(ev.target?.result as string);
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Expenses</h1>
          <p className="text-sm text-muted-foreground">{expenses.length} total transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportData}><Download size={14} className="mr-1.5" />Export</Button>
          <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload size={14} className="mr-1.5" />Import JSON</Button>
          <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}><FileUp size={14} className="mr-1.5" />Import CSV</Button>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <Button size="sm" onClick={handleAdd}><Plus size={14} className="mr-1.5" />Add Expense</Button>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by category, notes, or payment..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground">
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Category</th>
                <th className="text-right p-3 font-medium">Amount</th>
                <th className="text-left p-3 font-medium hidden md:table-cell">Payment</th>
                <th className="text-left p-3 font-medium hidden lg:table-cell">Notes</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => (
                <tr key={e.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="p-3 text-muted-foreground">{format(parseISO(e.date), 'MMM d, yy')}</td>
                  <td className="p-3">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{CATEGORY_ICONS[e.category as Category]}</span>
                      <span>{e.category}</span>
                    </span>
                  </td>
                  <td className="p-3 text-right font-semibold">{formatCurrency(e.amount)}</td>
                  <td className="p-3 text-muted-foreground hidden md:table-cell">{e.paymentMode}</td>
                  <td className="p-3 text-muted-foreground hidden lg:table-cell max-w-[200px] truncate">{e.notes || '—'}</td>
                  <td className="p-3 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => handleEdit(e)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                        <Edit size={14} />
                      </button>
                      <button onClick={() => deleteExpense(e.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No expenses found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ExpenseForm open={formOpen} onOpenChange={setFormOpen} expense={editingExpense} />
      <CsvImportModal open={csvOpen} onOpenChange={setCsvOpen} />
    </motion.div>
  );
}
