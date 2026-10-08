export const rupiah = (n) => `Rp ${Math.round(Number(n) || 0).toLocaleString("id-ID")}`;

export const parseRupiah = (s) => parseInt(String(s).replace(/\D/g, ""), 10) || 0;

export const dateTime = (iso) =>
  new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
