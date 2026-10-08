import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { toDateStr, PERIOD_LABELS } from "@/lib/reports";

export const shortId = (id) => `#${String(id).slice(0, 8)}`;

export const formatShort = (n) => {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}jt`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}rb`;
  return String(v);
};

export function PageHeader({ outlet, title, subtitle }) {
  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{outlet?.name}</p>
      <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">{title}</h1>
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

export function RangeBar({ range, showPresets = true, children }) {
  const { preset, setPreset, from, to, setFrom, setTo } = range;
  return (
    <div className="flex flex-wrap items-end gap-3 mb-5">
      {showPresets && (
        <div className="space-y-1.5">
          <Label className="text-xs">Periode</Label>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-[150px] bg-white" data-testid="range-preset"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k} data-testid={`range-preset-${k}`}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1.5">
        <Label className="text-xs">Dari</Label>
        <Input type="date" className="w-[160px] bg-white" value={toDateStr(from)} onChange={(e) => e.target.value && setFrom(new Date(e.target.value))} data-testid="range-from" />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Sampai</Label>
        <Input type="date" className="w-[160px] bg-white" value={toDateStr(to)} onChange={(e) => e.target.value && setTo(new Date(e.target.value))} data-testid="range-to" />
      </div>
      {children}
    </div>
  );
}

export function ExportButtons({ onExcel, onPDF, idPrefix = "report" }) {
  return (
    <div className="flex items-end gap-2 ml-auto">
      <Button variant="outline" onClick={onExcel} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50" data-testid={`${idPrefix}-export-excel`}>
        <FileSpreadsheet className="h-4 w-4" /> Excel
      </Button>
      <Button variant="outline" onClick={onPDF} className="gap-2 border-rose-200 text-rose-700 hover:bg-rose-50" data-testid={`${idPrefix}-export-pdf`}>
        <FileText className="h-4 w-4" /> PDF
      </Button>
    </div>
  );
}

export function StatCard({ label, value, accent = "slate", testId }) {
  const accents = {
    slate: "from-slate-50 to-white border-slate-200 text-slate-900",
    emerald: "from-emerald-50 to-white border-emerald-200 text-emerald-700",
    rose: "from-rose-50 to-white border-rose-200 text-rose-700",
    amber: "from-amber-50 to-white border-amber-200 text-amber-700",
    sky: "from-sky-50 to-white border-sky-200 text-sky-700",
  };
  return (
    <div className={`rounded-xl border bg-gradient-to-b ${accents[accent]} px-5 py-4 min-w-[180px]`} data-testid={testId}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-2xl font-extrabold font-mono mt-1">{value}</p>
    </div>
  );
}

export function TableShell({ children, testId }) {
  return (
    <div className="rounded-xl border bg-white overflow-x-auto">
      <table className="w-full text-sm" data-testid={testId}>{children}</table>
    </div>
  );
}
