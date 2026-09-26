import * as XLSX from "xlsx";
import { CardItem } from "@/types/extractor";

export interface ExportOptions {
  onlyReviewed?: boolean;
}

export function prepareExportData(items: CardItem[], options: ExportOptions = {}) {
  let targetItems = items.filter((item) => item.status === "done" && item.data);
  if (options.onlyReviewed) {
    targetItems = targetItems.filter((item) => item.isReviewed);
  }

  return targetItems.map((item) => {
    const data = item.data!;
    return {
      "File Name": item.fileName,
      "Company Name": data.company_name ?? "",
      Email: data.email ?? "",
      Phone: data.phone ?? "",
      Website: data.website ?? "",
      "Source Type": data.source_type,
      "Reviewed": item.isReviewed ? "Yes" : "No",
      "Confidence Company": (data.confidence.company_name * 100).toFixed(0) + "%",
      "Confidence Email": (data.confidence.email * 100).toFixed(0) + "%",
      "Confidence Phone": (data.confidence.phone * 100).toFixed(0) + "%",
      "Confidence Website": (data.confidence.website * 100).toFixed(0) + "%",
      "Image ID": data.image_id,
    };
  });
}

/**
 * Exports data to CSV file with UTF-8 BOM for Microsoft Excel compatibility
 */
export function exportToCSV(items: CardItem[], options: ExportOptions = {}): { count: number; filename: string } {
  const data = prepareExportData(items, options);
  if (data.length === 0) {
    throw new Error("No eligible rows to export.");
  }

  const headers = Object.keys(data[0]) as (keyof (typeof data)[0])[];
  const csvRows: string[] = [];

  // Add header row
  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));

  // Add body rows
  for (const row of data) {
    const values = headers.map((header) => {
      const val = row[header] ?? "";
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }

  // Prepend UTF-8 BOM (\uFEFF)
  const csvString = "\uFEFF" + csvRows.join("\r\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const filename = `expo_cards_export_${new Date().toISOString().slice(0, 10)}.csv`;

  triggerDownload(blob, filename);
  return { count: data.length, filename };
}

/**
 * Exports data to native .xlsx Excel workbook
 */
export function exportToExcel(items: CardItem[], options: ExportOptions = {}): { count: number; filename: string } {
  const data = prepareExportData(items, options);
  if (data.length === 0) {
    throw new Error("No eligible rows to export.");
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  // Auto-size columns slightly
  worksheet["!cols"] = [
    { wch: 24 }, // File Name
    { wch: 28 }, // Company Name
    { wch: 26 }, // Email
    { wch: 20 }, // Phone
    { wch: 26 }, // Website
    { wch: 14 }, // Source Type
    { wch: 12 }, // Reviewed
    { wch: 18 }, // Conf Company
    { wch: 16 }, // Conf Email
    { wch: 16 }, // Conf Phone
    { wch: 18 }, // Conf Website
    { wch: 38 }, // Image ID
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Extracted Cards");

  const filename = `expo_cards_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(workbook, filename);

  return { count: data.length, filename };
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
