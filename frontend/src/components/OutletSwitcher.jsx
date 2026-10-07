import { MapPin } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";

export function OutletSwitcher() {
  const { isOwner, outlets, activeOutletId, setActiveOutletId, activeOutlet } = useAuth();
  if (!isOwner) {
    return (
      <span data-testid="outlet-current-label" className="inline-flex items-center gap-1.5 text-sm font-semibold">
        <MapPin className="h-4 w-4 text-emerald-600" /> {activeOutlet?.name || "Belum ada outlet"}
      </span>
    );
  }
  return (
    <Select value={activeOutletId || ""} onValueChange={setActiveOutletId}>
      <SelectTrigger data-testid="outlet-switcher-dropdown" className="h-9 w-full md:w-[210px] font-semibold">
        <MapPin className="h-4 w-4 text-emerald-600 mr-1" />
        <SelectValue placeholder="Pilih outlet" />
      </SelectTrigger>
      <SelectContent className="backdrop-blur-xl bg-background/95">
        {outlets.map((o) => (
          <SelectItem key={o.id} value={o.id} data-testid={`outlet-option-${o.id}`}>{o.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
