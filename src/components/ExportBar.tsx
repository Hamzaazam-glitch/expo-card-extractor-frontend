"use client";

import React, { useState } from "react";
import { Download, FileSpreadsheet, FileText, Check, Filter } from "lucide-react";
import { CardItem } from "@/types/extractor";
import { exportToCSV, exportToExcel } from "@/utils/exportUtils";
import { useToast } from "@/components/Toast";

interface ExportBarProps {
  items: CardItem[];
}

export default function ExportBar({ items }: ExportBarProps) {
  const [onlyReviewed, setOnlyReviewed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { showToast } = useToast();

  const doneItems = items.filter((i) => i.status === "done" && i.data);
  const reviewedCount = doneItems.filter((i) => i.isReviewed).length;

  const eligibleCount = onlyReviewed ? reviewedCount : doneItems.length;

  const handleExportCSV = () => {
    try {
      setIsExporting(true);
      const res = exportToCSV(items, { onlyReviewed });
      showToast({
        type: "success",
        title: "CSV Export Complete",
        description: `Successfully downloaded ${res.count} card records to ${res.filename}`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export CSV";
      showToast({
        type: "error",
        title: "Export Failed",
        description: msg,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportExcel = () => {
    try {
      setIsExporting(true);
      const res = exportToExcel(items, { onlyReviewed });
      showToast({
        type: "success",
        title: "Excel Export Complete",
        description: `Successfully generated workbook with ${res.count} card records (${res.filename})`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to export Excel";
      showToast({
        type: "error",
        title: "Export Failed",
        description: msg,
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
      {/* Left: Filter Toggle */}
      <div className="flex items-center gap-3">
        <label
          htmlFor="reviewed-toggle"
          className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-slate-300 select-none group"
        >
          <div className="relative">
            <input
              id="reviewed-toggle"
              type="checkbox"
              checked={onlyReviewed}
              onChange={(e) => setOnlyReviewed(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-10 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 border border-slate-700" />
          </div>
          <span className="flex items-center gap-1.5 text-xs sm:text-sm">
            <Filter className="w-3.5 h-3.5 text-indigo-400" />
            <span>Export only marked <strong className="text-white">&quot;Reviewed&quot;</strong></span>
          </span>
        </label>

        <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700">
          {eligibleCount} {eligibleCount === 1 ? "record" : "records"} ready
        </span>
      </div>

      {/* Right: Export Buttons */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={handleExportCSV}
          disabled={eligibleCount === 0 || isExporting}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 ${
            eligibleCount === 0
              ? "bg-slate-800/60 text-slate-600 border border-slate-800 cursor-not-allowed"
              : "bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          }`}
          title="Download RFC-4180 compliant CSV format"
        >
          <FileText className="w-4 h-4 text-emerald-400" />
          <span>Export CSV</span>
        </button>

        <button
          onClick={handleExportExcel}
          disabled={eligibleCount === 0 || isExporting}
          className={`flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all duration-200 ${
            eligibleCount === 0
              ? "bg-slate-800 text-slate-600 border border-slate-800 cursor-not-allowed"
              : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
          }`}
          title="Download formatted Microsoft Excel (.xlsx) workbook"
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>Export Excel</span>
        </button>
      </div>
    </div>
  );
}
