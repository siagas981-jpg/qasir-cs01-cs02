export const rupiah = (n) => `Rp ${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;

export const parseRupiah = (s) => parseInt(String(s).replace(/\D/g, ""), 10) || 0;

export const dateTime = (iso) => {
  if (!iso) return '-';
  let s = String(iso).replace(" ", "T");
  if (!s.endsWith("Z") && !s.includes("+")) {
    s += "Z";
  }
  return new Date(s).toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " WITA";
};

export const formatWita = dateTime;
export const formatTanggal = dateTime;
