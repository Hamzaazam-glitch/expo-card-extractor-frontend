/* eslint-disable @typescript-eslint/no-explicit-any */
import * as XLSX from "xlsx";
import { CardItem, ExtractedCardData } from "@/types/extractor";

export interface ExportOptions {
  onlyReviewed?: boolean;
}

export interface ExportedCardRecord {
  "Company Name": string;
  Email: string;
  Phone: string;
  Website: string;
  "Source Type": string;
  Reviewed: string;
  "Confidence Avg": string;
  "Confidence Company": string;
  "Confidence Email": string;
  "Confidence Phone": string;
  "Confidence Website": string;
  "File Name": string;
  "Image ID": string;
}

/**
 * Prepares clean, structured card data for CSV and Excel export.
 * Handles both CardItem[] (from UI state) and raw ExtractedCardData[] (from API responses).
 * Correctly prioritizes actual extracted business fields as the primary columns.
 */
export function prepareExportData(
  items: (CardItem | ExtractedCardData | any)[],
  options: ExportOptions = {}
): ExportedCardRecord[] {
  if (!Array.isArray(items)) return [];

  // Filter items:
  // 1. If item has status property, only keep "done" items
  // 2. If options.onlyReviewed is true, only keep reviewed items
  const eligibleItems = items.filter((item) => {
    if (!item) return false;
    if ("status" in item && item.status && item.status !== "done") {
      return false;
    }
    if (options.onlyReviewed) {
      const isReviewed = Boolean(item.isReviewed ?? item.data?.isReviewed ?? false);
      if (!isReviewed) return false;
    }
    return true;
  });

  return eligibleItems.map((item) => {
    // Unnest data object whether nested under item.data or flat on item
    const data: Partial<ExtractedCardData> = item.data ?? item;

    // 1. Company Name
    const companyName =
      (typeof data.company_name === "string" ? data.company_name : null) ??
      (typeof item.company_name === "string" ? item.company_name : null) ??
      "";

    // 2. Email
    const email =
      (typeof data.email === "string" ? data.email : null) ??
      (typeof item.email === "string" ? item.email : null) ??
      "";

    // 3. Phone
    const phone =
      (typeof data.phone === "string" ? data.phone : null) ??
      (typeof item.phone === "string" ? item.phone : null) ??
      "";

    // 4. Website
    const website =
      (typeof data.website === "string" ? data.website : null) ??
      (typeof item.website === "string" ? item.website : null) ??
      "";

    // 5. Source Type
    const sourceType = String(data.source_type ?? item.source_type ?? "card");

    // 6. Reviewed Status
    const isReviewed = Boolean(item.isReviewed ?? (data as any)?.isReviewed ?? false);

    // 7. Confidence Metrics
    const conf = data.confidence ?? item.confidence;
    let avgConfidence = "N/A";
    let confCompany = "";
    let confEmail = "";
    let confPhone = "";
    let confWebsite = "";

    if (conf && typeof conf === "object") {
      const scores = [
        conf.company_name,
        conf.email,
        conf.phone,
        conf.website,
      ].filter((s): s is number => typeof s === "number");

      if (scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        avgConfidence = (avg * 100).toFixed(0) + "%";
      }
      if (typeof conf.company_name === "number") confCompany = (conf.company_name * 100).toFixed(0) + "%";
      if (typeof conf.email === "number") confEmail = (conf.email * 100).toFixed(0) + "%";
      if (typeof conf.phone === "number") confPhone = (conf.phone * 100).toFixed(0) + "%";
      if (typeof conf.website === "number") confWebsite = (conf.website * 100).toFixed(0) + "%";
    }

    // 8. Identifiers & Source File
    const fileName = String(item.fileName ?? item.file_name ?? "");
    const imageId = String(data.image_id ?? item.image_id ?? item.id ?? "");

    return {
      "Company Name": companyName,
      Email: email,
      Phone: phone,
      Website: website,
      "Source Type": sourceType,
      Reviewed: isReviewed ? "Yes" : "No",
      "Confidence Avg": avgConfidence,
      "Confidence Company": confCompany,
      "Confidence Email": confEmail,
      "Confidence Phone": confPhone,
      "Confidence Website": confWebsite,
      "File Name": fileName,
      "Image ID": imageId,
    };
  });
}

/**
 * Builds the raw CSV string representation
 */
export function generateCSVContent(
  items: (CardItem | ExtractedCardData | any)[],
  options: ExportOptions = {}
): string {
  const data = prepareExportData(items, options);
  if (data.length === 0) {
    throw new Error("No eligible rows to export.");
  }

  const headers = Object.keys(data[0]) as (keyof ExportedCardRecord)[];
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(","));

  // Data rows
  for (const row of data) {
    const values = headers.map((header) => {
      const val = row[header] ?? "";
      return `"${String(val).replace(/"/g, '""')}"`;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\r\n");
}

/**
 * Exports data to CSV file with UTF-8 BOM for Microsoft Excel compatibility
 */
export function exportToCSV(
  items: (CardItem | ExtractedCardData | any)[],
  options: ExportOptions = {}
): { count: number; filename: string; content: string } {
  const content = generateCSVContent(items, options);
  const data = prepareExportData(items, options);

  // Prepend UTF-8 BOM (\uFEFF)
  const csvString = "\uFEFF" + content;
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const filename = `expo_cards_export_${new Date().toISOString().slice(0, 10)}.csv`;

  if (typeof window !== "undefined") {
    triggerDownload(blob, filename);
  }

  return { count: data.length, filename, content };
}

/**
 * Exports data to native .xlsx Excel workbook
 */
export function exportToExcel(
  items: (CardItem | ExtractedCardData | any)[],
  options: ExportOptions = {}
): { count: number; filename: string } {
  const data = prepareExportData(items, options);
  if (data.length === 0) {
    throw new Error("No eligible rows to export.");
  }

  const worksheet = XLSX.utils.json_to_sheet(data);
  // Auto-size columns to match the actual extracted fields first
  worksheet["!cols"] = [
    { wch: 30 }, // Company Name
    { wch: 28 }, // Email
    { wch: 22 }, // Phone
    { wch: 28 }, // Website
    { wch: 14 }, // Source Type
    { wch: 12 }, // Reviewed
    { wch: 16 }, // Confidence Avg
    { wch: 18 }, // Conf Company
    { wch: 16 }, // Conf Email
    { wch: 16 }, // Conf Phone
    { wch: 18 }, // Conf Website
    { wch: 26 }, // File Name
    { wch: 38 }, // Image ID
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Extracted Cards");

  const filename = `expo_cards_export_${new Date().toISOString().slice(0, 10)}.xlsx`;
  if (typeof window !== "undefined") {
    XLSX.writeFile(workbook, filename);
  }

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
