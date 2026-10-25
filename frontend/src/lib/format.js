export const dateTime = (iso) => {
  if (!iso) return '-';
  let s = String(iso).replace(" ", "T");
  // kalau tidak ada Z atau + di akhir, anggap UTC
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
