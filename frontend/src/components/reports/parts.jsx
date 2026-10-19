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
    <div className="w-full mb-3 text-left">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">CS QASIR 01</p>
      <h1 className="text-[22px] font-extrabold tracking-tight text-left">{title}</h1>
      {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 text-left">{subtitle}</p>}
    </div>
  );
}

export function RangeBar({ range, showPresets = true, children }) {
  const { preset, setPreset, from, to, setFrom, setTo } = range;
  return (
    <div className="flex flex-wrap items-end gap-2 mb-3 w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-sm">
      {showPresets && (
        <div className="space-y-1">
          <Label className="text-[10px] text-slate-500">Periode</Label>
          <Select value={preset} onValueChange={setPreset}>
            <SelectTrigger className="w-[110px] h-8 bg-white text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>{Object.entries(PERIOD_LABELS).map(([k,v])=><SelectItem key={k} value={k} className="text-[11px]">{v}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-1">
        <Label className="text-[10px] text-slate-500">Dari</Label>
        <Input type="date" className="w-[130px] h-8 text-[11px]" value={toDateStr(from)} onChange={(e)=>e.target.value && setFrom(new Date(e.target.value))} />
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-slate-500">Sampai</Label>
        <Input type="date" className="w-[130px] h-8 text-[11px]" value={toDateStr(to)} onChange={(e)=>e.target.value && setTo(new Date(e.target.value))} />
      </div>
      <div className="flex items-end gap-2 ml-0 md:ml-2">{children}</div>
      <div className="ml-auto flex gap-2">
        {/* Excel PDF akan masuk sini via children kalau mau, tapi kita taruh di parent */}
      </div>
    </div>
  );
}

export function ExportButtons({ onExcel, onPDF, idPrefix }) {
  return (
    <div className="flex gap-1.5 ml-auto">
      <Button variant="outline" size="sm" onClick={onExcel} className="h-8 px-2.5 text-[11px] border-emerald-200 text-emerald-700 hover:bg-emerald-50"><FileSpreadsheet className="h-3.5 w-3.5 mr-1" />Excel</Button>
      <Button variant="outline" size="sm" onClick={onPDF} className="h-8 px-2.5 text-[11px] border-rose-200 text-rose-700 hover:bg-rose-50"><FileText className="h-3.5 w-3.5 mr-1" />PDF</Button>
    </div>
  );
}

export function StatCard({ label, value, accent="slate", testId }) {
  const accents = {
    slate: "from-slate-50 to-white border-slate-200 text-slate-900",
    emerald: "from-emerald-50 to-white border-emerald-200 text-emerald-700",
    amber: "from-amber-50 to-white border-amber-200 text-amber-700",
    sky: "from-sky-50 to-white border-sky-200 text-sky-700",
  };
  return (
    <div className={`rounded-lg border bg-gradient-to-b ${accents[accent]} px-3 py-2.5`} data-testid={testId}>
      <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70 text-left">{label}</p>
      <p className="text-[16px] font-extrabold font-mono mt-0.5 text-left">{value}</p>
    </div>
  );
}

export function TableShell({ children, testId }) {
  return (
    <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-[11px] text-left table-fixed" data-testid={testId}>{children}</table>
      </div>
    </div>
  );
}
