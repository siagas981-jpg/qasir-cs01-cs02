import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function exportExcel(rows, filename, sheetName = "Laporan") {
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Info: "Tidak ada data" }]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export function exportPDF({ title, subtitle, head, body, filename }) {
  const doc = new jsPDF();
  doc.setFontSize(14);
  doc.text(title, 14, 16);
  if (subtitle) {
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(subtitle, 14, 22);
    doc.setTextColor(0);
  }
  autoTable(doc, {
    head: [head],
    body: body.length ? body : [head.map(() => "—")],
    startY: subtitle ? 26 : 22,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129] },
    alternateRowStyles: { fillColor: [245, 247, 250] },
  });
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
