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
    <div className="w-full mb-4 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700 text-left">{outlet?.name}</p>
      <h1 className="font-heading text-2xl font-extrabold tracking-tight text-left">{title}</h1>
      {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 text-left">{subtitle}</p>}
    </div>
  );
}

export function RangeBar({ range, showPresets = true, children }) {
  const { preset, setPreset, from, to, setFrom, setTo } = range;
  return (
    <div className="flex flex-wrap items-end gap-2 mb-3 w-full">
      {showPresets && (
        <div className="space-y-1">
          <Label className="text-[10px]">Periode</Label>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-[130px] h-9 bg-white text-[11px]" data-testid="range-preset"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k} className="text-[11px]" data-testid={`range-preset-${k}`}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-[10px]">Dari</Label>
        <Input type="date" className="w-[140px] h-9 bg-white text-[11px]" value={toDateStr(from)} onChange={(e) => e.target.value && setFrom(new Date(e.target.value))} data-testid="range-from" />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px]">Sampai</Label>
        <Input type="date" className="w-[140px] h-9 bg-white text-[11px]" value={toDateStr(to)} onChange={(e) => e.target.value && setTo(new Date(e.target.value))} data-testid="range-to" />
      </div>
      {children}
    </div>
  );
}

export function ExportButtons({ onExcel, onPDF, idPrefix = "report" }) {
  return (
    <div className="flex items-end gap-2 ml-auto">
      <Button variant="outline" size="sm" onClick={onExcel} className="h-9 gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 text-[11px]" data-testid={`${idPrefix}-export-excel`}>
        <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
      </Button>
      <Button variant="outline" size="sm" onClick={onPDF} className="h-9 gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 text-[11px]" data-testid={`${idPrefix}-export-pdf`}>
        <FileText className="h-3.5 w-3.5" /> PDF
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
    <div className={`rounded-xl border bg-gradient-to-b ${accents[accent]} px-4 py-3 min-w-[150px]`} data-testid={testId}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 text-left">{label}</p>
      <p className="text-xl font-extrabold font-mono mt-1 text-left">{value}</p>
    </div>
  );
}

export function TableShell({ children, testId }) {
  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-[11px] text-left" data-testid={testId}>{children}</table>
      </div>
    </div>
  );
}
