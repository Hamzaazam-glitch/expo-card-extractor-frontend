"use client";

import React, { useState } from "react";
import { AlertTriangle, FileSpreadsheet, FileText, Filter, Loader2, X } from "lucide-react";
import { CardItem } from "@/types/extractor";
import { exportToCSV, exportToExcel } from "@/utils/exportUtils";
import { getRecords } from "@/services/extractorService";
import { useToast } from "@/components/Toast";

interface ExportBarProps {
  items: CardItem[];
}

export default function ExportBar({ items }: ExportBarProps) {
  const [onlyReviewed, setOnlyReviewed] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportingType, setExportingType] = useState<"csv" | "excel" | null>(null);
  const [pendingExportType, setPendingExportType] = useState<"csv" | "excel" | null>(null);
  const [showUnsavedModal, setShowUnsavedModal] = useState(false);
  const { showToast } = useToast();

  const doneItems = items.filter((i) => i.status === "done");
  const reviewedCount = doneItems.filter((i) => i.isReviewed).length;
  const eligibleLocalCount = onlyReviewed ? reviewedCount : doneItems.length;

  const unsavedCount = items.filter(
    (i) => i.saveStatus === "failed" || i.saveStatus === "saving"
  ).length;

  const runFreshExport = async (type: "csv" | "excel") => {
    setIsExporting(true);
    setExportingType(type);
    try {
      // 1. Fetch fresh GET /records from backend (?reviewed=true if onlyReviewed is active)
      const freshRecords = await getRecords(onlyReviewed ? { reviewed: true } : undefined);

      // 2. Safeguard client-side filtering for reviewed if param was ignored
      const eligible = onlyReviewed
        ? freshRecords.filter((r) => Boolean(r.reviewed))
        : freshRecords;

      if (!eligible || eligible.length === 0) {
        showToast({
          type: "info",
          title: "No Records to Export",
          description: onlyReviewed
            ? "No reviewed records found on the backend."
            : "No records found on the backend.",
        });
        return;
      }

      // 3. Export in browser using fresh backend records
      if (type === "csv") {
        const res = exportToCSV(eligible, { onlyReviewed });
        showToast({
          type: "success",
          title: "CSV Export Complete",
          description: `Successfully downloaded ${res.count} card records to ${res.filename}`,
        });
      } else {
        const res = exportToExcel(eligible, { onlyReviewed });
        showToast({
          type: "success",
          title: "Excel Export Complete",
          description: `Successfully generated workbook with ${res.count} card records (${res.filename})`,
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to fetch saved records from backend";
      showToast({
        type: "error",
        title: "Export Failed",
        description: `${msg}. No file was exported.`,
      });
    } finally {
      setIsExporting(false);
      setExportingType(null);
    }
  };

  const handleExportClick = (type: "csv" | "excel") => {
    if (unsavedCount > 0) {
      setPendingExportType(type);
      setShowUnsavedModal(true);
      return;
    }
    void runFreshExport(type);
  };

  const handleConfirmUnsavedExport = () => {
    const type = pendingExportType;
    setShowUnsavedModal(false);
    setPendingExportType(null);
    if (type) {
      void runFreshExport(type);
    }
  };

  const handleCancelUnsavedModal = () => {
    setShowUnsavedModal(false);
    setPendingExportType(null);
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-surface/90 border border-border-warm shadow-xl backdrop-blur-md">
        {/* Left: Filter Toggle */}
        <div className="flex items-center gap-3">
          <label
            htmlFor="reviewed-toggle"
            className="flex items-center gap-2.5 cursor-pointer text-sm font-medium text-champagne select-none group"
          >
            <div className="relative">
              <input
                id="reviewed-toggle"
                type="checkbox"
                checked={onlyReviewed}
                onChange={(e) => setOnlyReviewed(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-10 h-6 bg-elevated peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border-warm after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brass border border-border-warm" />
            </div>
            <span className="flex items-center gap-1.5 text-xs sm:text-sm">
              <Filter className="w-3.5 h-3.5 text-brass" />
              <span>
                Export only marked <strong className="text-champagne font-bold">&quot;Reviewed&quot;</strong>
              </span>
            </span>
          </label>

          <span className="text-xs px-2.5 py-0.5 rounded-full bg-elevated text-champagne-muted border border-border-warm">
            {eligibleLocalCount} {eligibleLocalCount === 1 ? "record" : "records"} in view
          </span>
        </div>

        {/* Right: Export Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExportClick("csv")}
            disabled={isExporting}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 bg-elevated hover:bg-surface text-champagne hover:text-white border border-border-warm shadow-sm hover:scale-[1.02] active:scale-[0.98] cursor-pointer hover:border-brass/40 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download RFC-4180 compliant CSV format from fresh backend records"
          >
            {isExporting && exportingType === "csv" ? (
              <Loader2 className="w-4 h-4 animate-spin text-brass" />
            ) : (
              <FileText className="w-4 h-4 text-brass" />
            )}
            <span>{isExporting && exportingType === "csv" ? "Fetching..." : "Export CSV"}</span>
          </button>

          <button
            onClick={() => handleExportClick("excel")}
            disabled={isExporting}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all duration-200 bg-emerald-700 hover:bg-emerald-600 text-white shadow-emerald-700/20 hover:scale-[1.02] active:scale-[0.98] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download formatted Microsoft Excel (.xlsx) workbook from fresh backend records"
          >
            {isExporting && exportingType === "excel" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileSpreadsheet className="w-4 h-4" />
            )}
            <span>{isExporting && exportingType === "excel" ? "Fetching..." : "Export Excel"}</span>
          </button>
        </div>
      </div>

      {/* Unsaved Changes Confirmation Modal */}
      {showUnsavedModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <div className="relative max-w-md w-full bg-surface border border-border-warm rounded-2xl shadow-2xl p-5 space-y-4">
            <div className="flex items-start justify-between pb-2 border-b border-border-warm">
              <div className="flex items-center gap-2.5 text-amber-400 font-semibold text-sm">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>Unsaved Changes Warning</span>
              </div>
              <button
                onClick={handleCancelUnsavedModal}
                className="p-1 rounded-lg text-champagne-muted hover:text-champagne hover:bg-elevated cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-champagne">
                {unsavedCount} {unsavedCount === 1 ? "row has" : "rows have"} unsaved changes.
              </p>
              <p className="text-xs text-champagne-muted leading-relaxed">
                The export fetches fresh records directly from the database, not your local table state.
                Any pending or failed saves will not be included in the downloaded file until successfully saved.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border-warm">
              <button
                onClick={handleCancelUnsavedModal}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-medium text-champagne hover:bg-elevated border border-border-warm transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnsavedExport}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-amber-500 hover:bg-amber-400 text-black transition-colors cursor-pointer"
              >
                Export anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
