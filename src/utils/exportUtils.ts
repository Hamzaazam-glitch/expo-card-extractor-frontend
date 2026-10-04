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
 * Strips null, undefined, "N/A", "null", "undefined", "—", etc. to a truly empty string.
 */
export function cleanExportField(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val).trim();
  const lower = str.toLowerCase();
  if (
    lower === "null" ||
    lower === "undefined" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "none" ||
    lower === "—" ||
    lower === "--" ||
    lower === "-"
  ) {
    return "";
  }
  return str;
}

/**
 * Prepares clean, structured card data for CSV and Excel export.
 * Handles both CardItem[] (from UI state) and raw ExtractedCardData[] (from API responses).
 * Correctly prioritizes actual extracted business fields as the primary columns.
 * Empty/null fields are guaranteed to be truly empty strings ("").
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

    // 1. Business Fields (truly empty cells when null/blank)
    const companyName = cleanExportField(data.company_name ?? item.company_name);
    const email = cleanExportField(data.email ?? item.email);
    const phone = cleanExportField(data.phone ?? item.phone);
    const website = cleanExportField(data.website ?? item.website);

    // 2. Source Type
    const sourceType = cleanExportField(data.source_type ?? item.source_type ?? "card") || "card";

    // 3. Reviewed Status
    const isReviewed = Boolean(item.isReviewed ?? (data as any)?.isReviewed ?? false);

    // 4. Confidence Metrics (empty string if unavailable)
    const conf = data.confidence ?? item.confidence;
    let avgConfidence = "";
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

    // 5. Identifiers & Source File
    const fileName = cleanExportField(item.fileName ?? item.file_name);
    const imageId = cleanExportField(data.image_id ?? item.image_id ?? item.id);

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
      const val = cleanExportField(row[header]);
      return val ? `"${val.replace(/"/g, '""')}"` : "";
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
