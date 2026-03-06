import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useExpenses } from '@/lib/ExpenseContext';
import { CATEGORIES, PAYMENT_MODES, Category, PaymentMode } from '@/lib/types';
import { parse } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ColumnMap = {
  date: string;
  amount: string;
  category: string;
  paymentMode: string;
  notes: string;
};

const NONE = '__none__';

const DATE_FORMATS = [
  'yyyy-MM-dd', 'dd/MM/yyyy', 'MM/dd/yyyy', 'dd-MM-yyyy',
  'MM-dd-yyyy', 'dd MMM yyyy', 'MMM dd yyyy', 'd/M/yyyy',
];

function tryParseDate(raw: string): string | null {
  const trimmed = raw.trim();
  for (const fmt of DATE_FORMATS) {
    try {
      const d = parse(trimmed, fmt, new Date());
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
    } catch {}
  }
  // fallback: native Date parse
  const d = new Date(trimmed);
  if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  return null;
}

function guessCategory(raw: string): Category {
  const v = raw.toLowerCase();
  if (!v || v === 'other') return 'Other';
  for (const cat of CATEGORIES) {
    if (v.includes(cat.toLowerCase())) return cat;
  }
  // keyword guessing
  if (/(food|eat|restaurant|cafe|grocery|swiggy|zomato)/i.test(v)) return 'Food';
  if (/(travel|uber|ola|cab|flight|bus|metro|fuel|petrol)/i.test(v)) return 'Travel';
  if (/(rent|lease|house|apartment)/i.test(v)) return 'Rent';
  if (/(shop|amazon|flipkart|cloth|fashion)/i.test(v)) return 'Shopping';
  if (/(electric|water|gas|internet|phone|bill|utility)/i.test(v)) return 'Utilities';
  if (/(health|doctor|medicine|hospital|pharma)/i.test(v)) return 'Health';
  if (/(edu|course|school|college|book|tuition)/i.test(v)) return 'Education';
  if (/(movie|netflix|game|spotify|entertainment)/i.test(v)) return 'Entertainment';
  return 'Other';
}

function guessPaymentMode(raw: string): PaymentMode {
  const v = raw.toLowerCase();
  if (!v) return 'Other';
  if (/(upi|gpay|phonepe|paytm)/i.test(v)) return 'UPI';
  if (/(credit)/i.test(v)) return 'Credit Card';
  if (/(debit)/i.test(v)) return 'Debit Card';
  if (/(cash)/i.test(v)) return 'Cash';
  if (/(transfer|neft|imps|rtgs)/i.test(v)) return 'Bank Transfer';
  for (const pm of PAYMENT_MODES) {
    if (v.includes(pm.toLowerCase())) return pm;
  }
  return 'Other';
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split('\n').filter(Boolean);
  if (lines.length < 2) return { headers: [], rows: [] };
  const parse = (line: string) => {
    const result: string[] = [];
    let cur = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQ = !inQ; continue; }
      if (c === ',' && !inQ) { result.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    result.push(cur.trim());
    return result;
  };
  return { headers: parse(lines[0]), rows: lines.slice(1).map(parse) };
}

function autoMap(headers: string[]): Partial<ColumnMap> {
  const h = headers.map(h => h.toLowerCase().trim());
  const find = (...keys: string[]) => {
    for (const k of keys) {
      const i = h.findIndex(hh => hh.includes(k));
      if (i !== -1) return headers[i];
    }
    return undefined;
  };
  return {
    date: find('date', 'txn date', 'transaction date', 'value date', 'posting date', 'time'),
    amount: find('debit', 'withdrawal', 'amount', 'dr', 'credit', 'sum', 'inr', 'rs', 'value'),
    category: find('narration', 'description', 'particulars', 'remarks', 'category', 'cat', 'type', 'desc', 'detail'),
    paymentMode: find('payment', 'mode', 'method', 'channel', 'instrument'),
    notes: find('note', 'narration', 'description', 'remark', 'memo', 'detail', 'ref'),
  };
}

const FIELD_LABELS: Record<keyof ColumnMap, string> = {
  date: 'Date *',
  amount: 'Amount *',
  category: 'Category (or auto-detect)',
  paymentMode: 'Payment Mode (or auto-detect)',
  notes: 'Notes',
};

export default function CsvImportModal({ open, onOpenChange }: Props) {
  const { addExpense } = useExpenses();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<'upload' | 'map' | 'done'>('upload');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [colMap, setColMap] = useState<Partial<ColumnMap>>({});
  const [importCount, setImportCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const reset = () => { setStep('upload'); setHeaders([]); setRows([]); setColMap({}); setErrors([]); };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setErrors(['Please upload a CSV file.']); return;
    }
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      const { headers, rows } = parseCSV(text);
      if (!headers.length) { setErrors(['Could not parse the CSV. Make sure it has a header row.']); return; }
      setHeaders(headers);
      setRows(rows);
      setColMap(autoMap(headers));
      setErrors([]);
      setStep('map');
    };
    reader.readAsText(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handleImport = () => {
    const errs: string[] = [];
    let count = 0;
    for (const row of rows) {
      // skip completely empty rows
      if (row.every(cell => !cell.trim())) continue;
      const get = (col?: string) => (col && col !== NONE) ? (row[headers.indexOf(col)] ?? '') : '';
      const rawDate = get(colMap.date);
      const rawAmount = get(colMap.amount);
      const date = tryParseDate(rawDate);
      // strip currency symbols, spaces, commas; take absolute value so debits with "-" sign still import
      const amount = Math.abs(parseFloat(rawAmount.replace(/[^0-9.-]/g, '')));
      if (!date || isNaN(amount) || amount === 0) { errs.push(`Skipped row: invalid date "${rawDate}" or amount "${rawAmount}"`); continue; }
      const rawCat = get(colMap.category);
      const rawPay = get(colMap.paymentMode);
      const notes = get(colMap.notes);
      addExpense({
        amount,
        category: guessCategory(rawCat),
        date,
        paymentMode: guessPaymentMode(rawPay),
        notes: notes || rawCat || '',
      });
      count++;
    }
    setImportCount(count);
    setErrors(errs.slice(0, 5));
    setStep('done');
  };

  const canImport = colMap.date && colMap.date !== NONE && colMap.amount && colMap.amount !== NONE;

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import from CSV</DialogTitle>
          <DialogDescription>
            Export a transaction CSV from your bank or UPI app and upload it here.
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
              <div
                className={`mt-2 border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'}`}
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <Upload size={32} className="text-muted-foreground" />
                <p className="text-sm font-medium">Drop your CSV here or <span className="text-primary underline">browse</span></p>
                <p className="text-xs text-muted-foreground">Supports any bank/UPI export • Headers required</p>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              </div>
              {errors.map((err, i) => (
                <p key={i} className="mt-2 text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{err}</p>
              ))}
              <div className="mt-4 rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">How to export:</p>
                <p>• <strong>GPay / PhonePe</strong>: Profile → Transactions → Export</p>
                <p>• <strong>Paytm</strong>: Passbook → Download Statement</p>
                <p>• <strong>Bank Netbanking</strong>: Account → Statement → Download CSV</p>
              </div>
            </motion.div>
          )}

          {step === 'map' && (
            <motion.div key="map" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-3 mt-2">
              <p className="text-xs text-muted-foreground">
                Found <strong>{rows.length}</strong> rows · Map your CSV columns below (required fields marked *)
              </p>
              <div className="space-y-2">
                {(Object.keys(FIELD_LABELS) as (keyof ColumnMap)[]).map(field => (
                  <div key={field} className="flex items-center gap-3">
                    <span className="text-xs w-40 shrink-0 text-muted-foreground">{FIELD_LABELS[field]}</span>
                    <Select value={colMap[field] ?? NONE} onValueChange={v => setColMap(prev => ({ ...prev, [field]: v }))}>
                      <SelectTrigger className="h-8 text-xs flex-1">
                        <SelectValue placeholder="— not mapped —" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>— not mapped —</SelectItem>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              {/* preview */}
              <div className="rounded-lg border border-border overflow-auto max-h-32 text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/60">
                      {[colMap.date, colMap.amount, colMap.category, colMap.notes].filter(Boolean).map(h => (
                        <th key={h} className="p-1.5 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 3).map((row, i) => (
                      <tr key={i} className="border-t border-border/50">
                        {[colMap.date, colMap.amount, colMap.category, colMap.notes].filter(Boolean).map(h => (
                          <td key={h} className="p-1.5 text-muted-foreground truncate max-w-[100px]">{row[headers.indexOf(h!)]}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" size="sm" onClick={reset} className="flex-1">Back</Button>
                <Button size="sm" disabled={!canImport} onClick={handleImport} className="flex-1">
                  Import {rows.length} rows
                </Button>
              </div>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-3 py-6 text-center">
              <CheckCircle2 size={48} className="text-primary" />
              <p className="text-lg font-semibold">Imported {importCount} expenses!</p>
              {errors.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className="text-warning font-medium">{errors.length} rows skipped:</p>
                  {errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
              <Button size="sm" onClick={() => { reset(); onOpenChange(false); }} className="mt-2">Done</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
