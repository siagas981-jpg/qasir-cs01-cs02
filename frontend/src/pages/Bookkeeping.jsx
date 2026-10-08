import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Trash2, Wallet, TrendingUp, TrendingDown, Receipt } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { rupiah, parseRupiah, dateTime } from "@/lib/format";
import { useDateRange, fetchSales, fetchPurchases, toDateStr } from "@/lib/reports";
import { fetchExpenses, addExpense, deleteExpense, fetchProfitSummary, fetchProfitSeries, EXPENSE_CATEGORIES } from "@/lib/bookkeeping";
import { exportExcel, exportPDF } from "@/lib/exporters";
import { PageHeader, RangeBar, ExportButtons, StatCard, TableShell, shortId, formatShort } from "@/components/reports/parts";

function IncomeTab({ outletId }) {
  const range = useDateRange("all");
  const { data = [], isLoading } = useQuery({
    queryKey: ["bk-income", outletId, range.from, range.to],
    queryFn: () => fetchSales(outletId, range.from, range.to), enabled: !!outletId,
  });
  const total = data.reduce((s, r) => s + (r.total || 0), 0);
  const toRows = () => data.map((r) => ({ Tanggal: dateTime(r.created_at), Nota: shortId(r.id), Jumlah: r.total }));
  const onExcel = () => exportExcel(toRows(), "pemasukan", "Pemasukan");
  const onPDF = () => exportPDF({ title: "Pemasukan (Penjualan)", subtitle: `${toDateStr(range.from)} s/d ${toDateStr(range.to)} · Total ${rupiah(total)}`, head: ["Tanggal", "Nota", "Jumlah"], body: data.map((r) => [dateTime(r.created_at), shortId(r.id), rupiah(r.total)]), filename: "pemasukan" });

  return (
    <div>
      <RangeBar range={range}><ExportButtons onExcel={onExcel} onPDF={onPDF} idPrefix="income" /></RangeBar>
      <div className="mb-5"><StatCard label="Total Pemasukan" value={rupiah(total)} accent="emerald" testId="income-total" /></div>
      <TableShell testId="income-table">
        <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
          <th className="p-4">Tanggal</th><th className="p-4">Nota</th><th className="p-4 text-right">Jumlah</th>
        </tr></thead>
        <tbody>
          {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={3}>Memuat…</td></tr>}
          {!isLoading && data.length === 0 && <tr><td className="p-8 text-center text-muted-foreground" colSpan={3}>Belum ada pemasukan pada periode ini.</td></tr>}
          {data.map((r) => (
            <tr key={r.id} className="border-b last:border-b-0 hover:bg-slate-50" data-testid={`income-row-${r.id}`}>
              <td className="p-4 whitespace-nowrap text-slate-500">{dateTime(r.created_at)}</td>
              <td className="p-4 font-mono">{shortId(r.id)}</td>
              <td className="p-4 text-right font-mono font-bold text-emerald-700">{rupiah(r.total)}</td>
            </tr>
          ))}
        </tbody>
      </TableShell>
    </div>
  );
}

function ExpenseForm({ outletId, userId, onDone }) {
  const [f, setF] = useState({ date: toDateStr(new Date()), category: EXPENSE_CATEGORIES[0], amount: 0, description: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.amount <= 0) return toast.error("Jumlah harus lebih dari 0");
    setBusy(true);
    try {
      await addExpense({ outlet_id: outletId, date: f.date, category: f.category, amount: f.amount, description: f.description || null, created_by: userId });
      toast.success("Pengeluaran ditambahkan");
      onDone();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5"><Label>Tanggal</Label><Input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} data-testid="expense-date-input" /></div>
      <div className="space-y-1.5">
        <Label>Kategori</Label>
        <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
          <SelectTrigger data-testid="expense-category-select"><SelectValue /></SelectTrigger>
          <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c} data-testid={`expense-category-${c}`}>{c}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5"><Label>Jumlah</Label><Input inputMode="numeric" className="font-mono" value={rupiah(f.amount)} onChange={(e) => setF({ ...f, amount: parseRupiah(e.target.value) })} data-testid="expense-amount-input" /></div>
      <div className="space-y-1.5"><Label>Keterangan</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} data-testid="expense-description-input" /></div>
      <Button type="submit" disabled={busy} className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white" data-testid="expense-submit-button">Simpan Pengeluaran</Button>
    </form>
  );
}

function ExpenseTab({ outletId, userId }) {
  const range = useDateRange("all");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: purchases = [] } = useQuery({ queryKey: ["bk-purch", outletId, range.from, range.to], queryFn: () => fetchPurchases(outletId, range.from, range.to), enabled: !!outletId });
  const { data: expenses = [], isLoading } = useQuery({ queryKey: ["bk-exp", outletId, range.from, range.to], queryFn: () => fetchExpenses(outletId, range.from, range.to), enabled: !!outletId });

  const rows = useMemo(() => {
    const a = purchases.map((p) => ({ key: `p-${p.id}`, sortable: new Date(p.created_at), dateLabel: dateTime(p.created_at), source: "Pembelian", label: p.name, amount: p.nilai, description: p.notes || "", manual: false }));
    const b = expenses.map((e) => ({ key: `e-${e.id}`, id: e.id, sortable: new Date(e.date), dateLabel: new Date(e.date).toLocaleDateString("id-ID", { dateStyle: "medium" }), source: "Operasional", label: e.category, amount: e.amount, description: e.description || "", manual: true }));
    return [...a, ...b].sort((x, y) => y.sortable - x.sortable);
  }, [purchases, expenses]);
  const total = rows.reduce((s, r) => s + r.amount, 0);

  const onDelete = async (id) => {
    if (!window.confirm("Hapus pengeluaran ini?")) return;
    try { await deleteExpense(id); toast.success("Dihapus"); qc.invalidateQueries({ queryKey: ["bk-exp", outletId] }); }
    catch (e) { toast.error(e.message); }
  };
  const refresh = () => { setOpen(false); qc.invalidateQueries({ queryKey: ["bk-exp", outletId] }); };

  const toRows = () => rows.map((r) => ({ Tanggal: r.dateLabel, Sumber: r.source, "Kategori/Produk": r.label, Jumlah: r.amount, Keterangan: r.description }));
  const onExcel = () => exportExcel(toRows(), "pengeluaran", "Pengeluaran");
  const onPDF = () => exportPDF({ title: "Pengeluaran", subtitle: `${toDateStr(range.from)} s/d ${toDateStr(range.to)} · Total ${rupiah(total)}`, head: ["Tanggal", "Sumber", "Kategori/Produk", "Jumlah", "Keterangan"], body: rows.map((r) => [r.dateLabel, r.source, r.label, rupiah(r.amount), r.description]), filename: "pengeluaran" });

  return (
    <div>
      <RangeBar range={range}>
        <Button onClick={() => setOpen(true)} className="bg-rose-600 hover:bg-rose-700 text-white gap-1" data-testid="add-expense-button"><Plus className="h-4 w-4" /> Pengeluaran Manual</Button>
        <ExportButtons onExcel={onExcel} onPDF={onPDF} idPrefix="expense" />
      </RangeBar>
      <div className="mb-5"><StatCard label="Total Pengeluaran" value={rupiah(total)} accent="rose" testId="expense-total" /></div>
      <TableShell testId="expense-table">
        <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
          <th className="p-4">Tanggal</th><th className="p-4">Sumber</th><th className="p-4">Kategori / Produk</th>
          <th className="p-4 text-right">Jumlah</th><th className="p-4">Keterangan</th><th className="p-4" />
        </tr></thead>
        <tbody>
          {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={6}>Memuat…</td></tr>}
          {!isLoading && rows.length === 0 && <tr><td className="p-8 text-center text-muted-foreground" colSpan={6}>Belum ada pengeluaran pada periode ini.</td></tr>}
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-b-0 hover:bg-slate-50" data-testid={`expense-row-${r.key}`}>
              <td className="p-4 whitespace-nowrap text-slate-500">{r.dateLabel}</td>
              <td className="p-4"><Badge variant="outline" className={r.manual ? "border-rose-200 bg-rose-50 text-rose-700" : "border-amber-200 bg-amber-50 text-amber-700"}>{r.source}</Badge></td>
              <td className="p-4 font-semibold">{r.label}</td>
              <td className="p-4 text-right font-mono font-bold text-rose-600">{rupiah(r.amount)}</td>
              <td className="p-4 text-slate-600">{r.description || "—"}</td>
              <td className="p-4 text-right">
                {r.manual && <button onClick={() => onDelete(r.id)} title="Hapus" className="p-2 rounded-md hover:bg-rose-600 hover:text-white" data-testid={`expense-delete-${r.id}`}><Trash2 className="h-4 w-4" /></button>}
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-background" data-testid="expense-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Tambah Pengeluaran Manual</DialogTitle>
            <DialogDescription>Biaya operasional seperti sewa, gaji, listrik, dll.</DialogDescription>
          </DialogHeader>
          <ExpenseForm outletId={outletId} userId={userId} onDone={refresh} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProfitTab({ outletId }) {
  const range = useDateRange("all");
  const { data: sum, isLoading } = useQuery({ queryKey: ["bk-profit", outletId, range.from, range.to], queryFn: () => fetchProfitSummary(outletId, range.from, range.to), enabled: !!outletId });
  const { data: series = [] } = useQuery({ queryKey: ["bk-profit-series", outletId], queryFn: () => fetchProfitSeries(outletId, 6), enabled: !!outletId });
  const s = sum || { pemasukan: 0, hpp: 0, pengeluaran: 0, laba: 0 };
  const profit = s.laba >= 0;

  const onExcel = () => exportExcel([
    { Komponen: "Pemasukan", Jumlah: s.pemasukan },
    { Komponen: "HPP", Jumlah: s.hpp },
    { Komponen: "Pengeluaran", Jumlah: s.pengeluaran },
    { Komponen: "Laba/Rugi", Jumlah: s.laba },
  ], "laba-rugi", "LabaRugi");
  const onPDF = () => exportPDF({ title: "Laporan Laba Rugi", subtitle: `${toDateStr(range.from)} s/d ${toDateStr(range.to)}`, head: ["Komponen", "Jumlah"], body: [["Pemasukan", rupiah(s.pemasukan)], ["HPP (Harga Pokok)", rupiah(s.hpp)], ["Pengeluaran", rupiah(s.pengeluaran)], ["Laba / Rugi", rupiah(s.laba)]], filename: "laba-rugi" });

  return (
    <div>
      <RangeBar range={range}><ExportButtons onExcel={onExcel} onPDF={onPDF} idPrefix="profit" /></RangeBar>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Pemasukan" value={rupiah(s.pemasukan)} accent="emerald" testId="profit-pemasukan" />
        <StatCard label="HPP" value={rupiah(s.hpp)} accent="amber" testId="profit-hpp" />
        <StatCard label="Pengeluaran" value={rupiah(s.pengeluaran)} accent="rose" testId="profit-pengeluaran" />
        <StatCard label={profit ? "Laba" : "Rugi"} value={rupiah(s.laba)} accent={profit ? "sky" : "rose"} testId="profit-laba" />
      </div>

      <div className="rounded-xl border bg-white p-4 mb-2">
        <div className="flex items-center gap-2 mb-3">
          {profit ? <TrendingUp className="h-4 w-4 text-emerald-600" /> : <TrendingDown className="h-4 w-4 text-rose-600" />}
          <p className="text-sm font-semibold">Laba Rugi per Bulan (6 bulan terakhir)</p>
        </div>
        <div className="h-72" data-testid="profit-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={formatShort} tick={{ fontSize: 12 }} width={48} />
              <Tooltip formatter={(v) => rupiah(v)} cursor={{ fill: "rgba(100,116,139,0.06)" }} />
              <Legend />
              <Bar dataKey="pemasukan" name="Pemasukan" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="pengeluaran" name="Pengeluaran" fill="#f43f5e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="laba" name="Laba" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      {isLoading && <p className="text-sm text-muted-foreground">Menghitung…</p>}
      <p className="text-xs text-muted-foreground mt-2">Laba / Rugi = Pemasukan − Pengeluaran − HPP. HPP dihitung dari harga modal produk yang terjual.</p>
    </div>
  );
}

export default function Bookkeeping() {
  const { activeOutletId, activeOutlet, user } = useAuth();
  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <PageHeader outlet={activeOutlet} title="Pembukuan" subtitle="Pemasukan, pengeluaran, dan laba rugi — otomatis dari data penjualan & pembelian." />
      <Tabs defaultValue="income">
        <TabsList className="mb-6" data-testid="bookkeeping-tabs">
          <TabsTrigger value="income" data-testid="tab-income"><Wallet className="h-4 w-4 mr-1.5" /> Pemasukan</TabsTrigger>
          <TabsTrigger value="expense" data-testid="tab-expense"><Receipt className="h-4 w-4 mr-1.5" /> Pengeluaran</TabsTrigger>
          <TabsTrigger value="profit" data-testid="tab-profit"><TrendingUp className="h-4 w-4 mr-1.5" /> Laba Rugi</TabsTrigger>
        </TabsList>
        <TabsContent value="income"><IncomeTab outletId={activeOutletId} /></TabsContent>
        <TabsContent value="expense"><ExpenseTab outletId={activeOutletId} userId={user?.id} /></TabsContent>
        <TabsContent value="profit"><ProfitTab outletId={activeOutletId} /></TabsContent>
      </Tabs>
    </div>
  );
}
