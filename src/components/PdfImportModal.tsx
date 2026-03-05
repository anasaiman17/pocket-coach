import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useExpenses } from '@/lib/ExpenseContext';
import { Category, PaymentMode } from '@/lib/types';
import * as pdfjsLib from 'pdfjs-dist';

// Set worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ParsedExpense {
  date: string;
  amount: number;
  category: Category;
  paymentMode: PaymentMode;
  notes: string;
}

function guessCategory(text: string): Category {
  const t = text.toLowerCase();
  if (/swiggy|zomato|restaurant|cafe|food|pizza|burger|kfc|mcdonalds|dominos|blinkit|grocer|bigbasket/.test(t)) return 'Food';
  if (/uber|ola|rapido|petrol|fuel|metro|bus|cab|auto|taxi|train|flight|irctc|indigo|spicejet/.test(t)) return 'Travel';
  if (/amazon|flipkart|myntra|shopping|mall|store|cloth|fashion|ajio|meesho/.test(t)) return 'Shopping';
  if (/hospital|pharmacy|medicine|doctor|clinic|health|apollo|medplus/.test(t)) return 'Health';
  if (/netflix|spotify|hotstar|prime|youtube|game|entertainment|movie|cinema|pvr/.test(t)) return 'Entertainment';
  if (/electricity|water|gas|internet|airtel|jio|bsnl|vodafone|utility|bill/.test(t)) return 'Utilities';
  if (/rent|maintenance|society|housing/.test(t)) return 'Rent';
  if (/school|college|tuition|education|course|udemy|coursera/.test(t)) return 'Education';
  return 'Other';
}

function guessPaymentMode(text: string): PaymentMode {
  const t = text.toLowerCase();
  if (/upi|gpay|phonepe|paytm|bhim/.test(t)) return 'UPI';
  if (/credit/.test(t)) return 'Credit Card';
  if (/debit/.test(t)) return 'Debit Card';
  if (/net ?banking|neft|imps|rtgs/.test(t)) return 'Bank Transfer';
  if (/cash/.test(t)) return 'Cash';
  return 'UPI';
}

const MONTH_MAP: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function tryParseDate(raw: string): string | null {
  const cleaned = raw.trim();

  // "01 Feb, 2026" or "1 Feb 2026" — GPay's actual format
  const m1 = cleaned.match(/^(\d{1,2})\s+([A-Za-z]{3}),?\s+(\d{4})$/);
  if (m1) {
    const mon = MONTH_MAP[m1[2].toLowerCase()];
    if (mon) return `${m1[3]}-${mon}-${m1[1].padStart(2, '0')}`;
  }

  // "Feb 01, 2026" or "Feb 1 2026"
  const m2 = cleaned.match(/^([A-Za-z]{3})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m2) {
    const mon = MONTH_MAP[m2[1].toLowerCase()];
    if (mon) return `${m2[3]}-${mon}-${m2[2].padStart(2, '0')}`;
  }

  // Numeric formats DD-MM-YYYY / DD/MM/YYYY
  const m3 = cleaned.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})$/);
  if (m3) return `${m3[3]}-${m3[2]}-${m3[1]}`;

  // YYYY-MM-DD
  const m4 = cleaned.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})$/);
  if (m4) return `${m4[1]}-${m4[2]}-${m4[3]}`;

  return null;
}

/**
 * Parses GPay PDF text.
 * pdfjs extracts each page as space-joined tokens in one line.
 * GPay rows look like:
 *   "... 01 Feb, 2026 11:07 AM Paid to slice ₹9,434 Paid by Indian Overseas Bank 4756 ..."
 *
 * We tokenize the full text and look for date tokens followed by Paid/Received + merchant + amount.
 */
function extractExpensesFromText(text: string): ParsedExpense[] {
  const results: ParsedExpense[] = [];

  // GPay date pattern: "01 Feb, 2026" — two tokens "01" + "Feb," + "2026"
  // We search using regex on the whole text (pdfjs joins with spaces)
  // Pattern: DD Mon, YYYY [time] [Paid to|Received from] merchant ₹amount
  const txnPattern =
    /(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4})\s+\d{1,2}:\d{2}\s+[AP]M\s+(Paid to|Paid by|Received from|Received by)\s+([^₹\n]+?)\s+₹([\d,]+(?:\.\d{1,2})?)/gi;

  let match: RegExpExecArray | null;
  while ((match = txnPattern.exec(text)) !== null) {
    const [, rawDate, direction, merchantRaw, amountRaw] = match;
    // Only import "Paid to" (money sent = expense). Skip "Paid by" (bank leg), "Received from" (income).
    if (!/^Paid to$/i.test(direction.trim())) continue;

    const dateStr = tryParseDate(rawDate.trim());
    if (!dateStr) continue;

    const amount = parseFloat(amountRaw.replace(/,/g, ''));
    if (isNaN(amount) || amount <= 0) continue;

    const merchant = merchantRaw.replace(/UPI Transaction ID:.*$/i, '').trim();

    results.push({
      date: dateStr,
      amount,
      category: guessCategory(merchant),
      paymentMode: 'UPI',
      notes: merchant.slice(0, 80),
    });
  }

  // Fallback: generic single-line with date + ₹amount (for other bank PDFs)
  if (results.length === 0) {
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
    const datePattern = /\b(\d{1,2}\s+[A-Za-z]{3},?\s+\d{4}|[A-Za-z]{3}\s+\d{1,2},?\s+\d{4}|\d{2}[-\/]\d{2}[-\/]\d{4})\b/;
    const amtPattern = /₹\s*([\d,]+(?:\.\d{1,2})?)/;
    for (const line of lines) {
      const dm = line.match(datePattern);
      const am = line.match(amtPattern);
      if (!dm || !am) continue;
      const isCredit = /received|credit/i.test(line);
      if (isCredit) continue;
      const dateStr = tryParseDate(dm[1]);
      const amount = parseFloat(am[1].replace(/,/g, ''));
      if (!dateStr || isNaN(amount) || amount <= 0) continue;
      results.push({
        date: dateStr,
        amount,
        category: guessCategory(line),
        paymentMode: guessPaymentMode(line),
        notes: line.slice(0, 80),
      });
    }
  }

  return results;
}

export default function PdfImportModal({ open, onOpenChange }: Props) {
  const { addExpense } = useExpenses();
  const [step, setStep] = useState<'upload' | 'preview' | 'done'>('upload');
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [parsed, setParsed] = useState<ParsedExpense[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep('upload');
    setError('');
    setParsed([]);
    setImportedCount(0);
    setLoading(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const processPdf = async (file: File) => {
    setLoading(true);
    setError('');
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      const expenses = extractExpensesFromText(fullText);
      if (expenses.length === 0) {
        setError('No transactions found. The PDF may use an unsupported format or be image-based (scanned).');
      } else {
        setParsed(expenses);
        setStep('preview');
      }
    } catch (e) {
      setError('Failed to parse PDF. Make sure it is a text-based PDF, not a scanned image.');
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.pdf')) {
      setError('Please upload a PDF file.');
      return;
    }
    processPdf(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = () => {
    parsed.forEach(exp => addExpense({
      date: exp.date,
      amount: exp.amount,
      category: exp.category,
      paymentMode: exp.paymentMode,
      notes: exp.notes,
    }));
    setImportedCount(parsed.length);
    setStep('done');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText size={18} className="text-primary" />
            Import from PDF
          </DialogTitle>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {step === 'upload' && (
            <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload a GPay, PhonePe, Paytm, or bank statement PDF. Only <strong>Debit</strong> transactions are imported. Works with text-based PDFs (not scanned images).</p>
              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
              >
                {loading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 size={36} className="animate-spin text-primary" />
                    <p className="text-sm text-muted-foreground">Parsing PDF…</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-4 rounded-full bg-primary/10">
                      <Upload size={28} className="text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Drop PDF here or click to browse</p>
                      <p className="text-sm text-muted-foreground mt-1">GPay, PhonePe, Paytm statements & bank PDFs</p>
                    </div>
                  </div>
                )}
              </div>
              <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }} />
              {error && (
                <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                  <AlertCircle size={16} className="mt-0.5 shrink-0" />
                  {error}
                </div>
              )}
            </motion.div>
          )}

          {step === 'preview' && (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-4 min-h-0">
              <p className="text-sm text-muted-foreground">Found <span className="font-semibold text-foreground">{parsed.length}</span> transactions. Review before importing.</p>
              <div className="overflow-y-auto flex-1 rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      <th className="text-left p-2 font-medium">Date</th>
                      <th className="text-right p-2 font-medium">Amount</th>
                      <th className="text-left p-2 font-medium">Category</th>
                      <th className="text-left p-2 font-medium hidden sm:table-cell">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((row, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="p-2 text-muted-foreground">{row.date}</td>
                        <td className="p-2 text-right font-medium">₹{row.amount.toLocaleString()}</td>
                        <td className="p-2">{row.category}</td>
                        <td className="p-2 text-muted-foreground hidden sm:table-cell truncate max-w-[180px]">{row.notes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={reset}>Back</Button>
                <Button onClick={handleImport}>Import {parsed.length} Transactions</Button>
              </div>
            </motion.div>
          )}

          {step === 'done' && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center gap-4 py-8 text-center">
              <CheckCircle size={48} className="text-primary" />
              <div>
                <p className="text-lg font-semibold">Import Complete!</p>
                <p className="text-sm text-muted-foreground mt-1">{importedCount} transactions added successfully.</p>
              </div>
              <Button onClick={handleClose}>Done</Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
