"use client";

import React, { useState } from "react";
import {
  Check,
  AlertTriangle,
  AlertCircle,
  RotateCw,
  Search,
  FileQuestion,
  Trash2,
  X,
  Maximize2,
  Loader2,
} from "lucide-react";
import { CardItem, ExtractedCardData, SourceType, TableFilter } from "@/types/extractor";
import { isAllFieldsNull, isLowConfidence } from "@/services/extractorService";

interface ReviewTableProps {
  items: CardItem[];
  onUpdateField: (
    id: string,
    field: keyof Omit<ExtractedCardData, "confidence" | "image_id" | "source_type">,
    value: string
  ) => void;
  onUpdateSourceType?: (id: string, sourceType: SourceType) => void;
  onToggleReviewed: (id: string) => void;
  onRetryRow: (id: string) => void;
  onDeleteRow: (id: string) => void;
  onRetrySave?: (id: string) => void;
}

export default function ReviewTable({
  items,
  onUpdateField,
  onUpdateSourceType,
  onToggleReviewed,
  onRetryRow,
  onDeleteRow,
  onRetrySave,
}: ReviewTableProps) {
  // Editing state: { id: string, field: string } | null
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [tempValue, setTempValue] = useState<string>("");

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TableFilter>("all");

  // Thumbnail Zoom Modal
  const [zoomedImage, setZoomedImage] = useState<{ url: string; title: string } | null>(null);

  const doneOrFailedItems = items.filter((i) => i.status === "done" || i.status === "failed");

  // Filter logic
  const filteredItems = doneOrFailedItems.filter((item) => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = item.fileName.toLowerCase().includes(q);
      const matchComp = item.data?.company_name?.toLowerCase().includes(q) ?? false;
      const matchEmail = item.data?.email?.toLowerCase().includes(q) ?? false;
      const matchPhone = item.data?.phone?.toLowerCase().includes(q) ?? false;
      const matchWebsite = item.data?.website?.toLowerCase().includes(q) ?? false;
      if (!matchName && !matchComp && !matchEmail && !matchPhone && !matchWebsite) {
        return false;
      }
    }

    if (activeFilter === "reviewed") {
      return item.isReviewed;
    }
    if (activeFilter === "needs_review") {
      if (!item.isReviewed) return true;
      if (item.status === "failed") return true;
      return false;
    }
    if (activeFilter === "low_confidence") {
      if (!item.data) return false;
      const c = item.data.confidence;
      return c.company_name < 0.6 || c.email < 0.6 || c.phone < 0.6 || c.website < 0.6;
    }
    if (activeFilter === "unreadable") {
      return isAllFieldsNull(item.data);
    }
    return true;
  });

  const startEditing = (id: string, field: string, currentValue: string | null) => {
    setEditingCell({ id, field });
    setTempValue(currentValue ?? "");
  };

  const commitEdit = (id: string, field: string) => {
    if (field === "company_name" || field === "email" || field === "phone" || field === "website") {
      onUpdateField(id, field, tempValue.trim());
    }
    setEditingCell(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, field: string) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitEdit(id, field);
    } else if (e.key === "Escape") {
      setEditingCell(null);
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* Top Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeFilter === "all"
                ? "bg-brass text-app font-bold shadow-sm"
                : "bg-surface text-champagne-muted hover:text-champagne border border-border-warm"
            }`}
          >
            All Results ({doneOrFailedItems.length})
          </button>
          <button
            onClick={() => setActiveFilter("needs_review")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer ${
              activeFilter === "needs_review"
                ? "bg-brass text-app font-bold shadow-sm"
                : "bg-surface text-champagne-muted hover:text-champagne border border-border-warm"
            }`}
          >
            Needs Review ({doneOrFailedItems.filter((i) => !i.isReviewed).length})
          </button>
          <button
            onClick={() => setActiveFilter("low_confidence")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeFilter === "low_confidence"
                ? "bg-amber-600 text-slate-950 font-bold shadow-sm"
                : "bg-surface text-warning hover:text-amber-300 border border-border-warm"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            <span>Low Confidence (&lt;60%)</span>
          </button>
          <button
            onClick={() => setActiveFilter("unreadable")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeFilter === "unreadable"
                ? "bg-error text-white font-bold shadow-sm"
                : "bg-surface text-error hover:text-rose-300 border border-border-warm"
            }`}
          >
            <FileQuestion className="w-3.5 h-3.5" />
            <span>Unreadable Scans</span>
          </button>
          <button
            onClick={() => setActiveFilter("reviewed")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors flex items-center gap-1 cursor-pointer ${
              activeFilter === "reviewed"
                ? "bg-brass text-app font-bold shadow-sm"
                : "bg-surface text-champagne-muted hover:text-champagne border border-border-warm"
            }`}
          >
            <Check className="w-3.5 h-3.5 text-success" />
            <span>Reviewed ({doneOrFailedItems.filter((i) => i.isReviewed).length})</span>
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-brass absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search company, email, phone..."
            className="w-full pl-9 pr-4 py-1.5 text-xs rounded-lg bg-surface border border-border-warm text-champagne placeholder-champagne-muted/50 focus:outline-none focus:border-brass transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-champagne-muted hover:text-champagne cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Main Review Table Container */}
      <div className="rounded-2xl border border-border-warm bg-surface/75 shadow-xl overflow-hidden backdrop-blur-md">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs sm:text-sm">
            {/* Table Header */}
            <thead>
              <tr className="border-b border-border-warm bg-elevated/90 text-champagne-muted font-semibold uppercase tracking-wider text-[11px]">
                <th scope="col" className="py-3.5 px-3 w-12 text-center">
                  Reviewed ✓
                </th>
                <th scope="col" className="py-3.5 px-4 w-28">
                  Thumbnail
                </th>
                <th scope="col" className="py-3.5 px-4 min-w-[180px]">
                  Company Name
                </th>
                <th scope="col" className="py-3.5 px-4 min-w-[180px]">
                  Email
                </th>
                <th scope="col" className="py-3.5 px-4 min-w-[150px]">
                  Phone
                </th>
                <th scope="col" className="py-3.5 px-4 min-w-[160px]">
                  Website
                </th>
                <th scope="col" className="py-3.5 px-4 w-32">
                  Source Type
                </th>
                <th scope="col" className="py-3.5 px-3 w-16 text-center">
                  Actions
                </th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-border-warm/80">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-champagne-muted">
                    <p className="text-sm">No cards match the selected filter or search criteria.</p>
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isDone = item.status === "done";
                  const isFailed = item.status === "failed";
                  const data = item.data;
                  const isUnreadable = isAllFieldsNull(data);
                  const isEditable = isDone && Boolean(data?.image_id);

                  return (
                    <tr
                      key={item.id}
                      className={`group transition-colors duration-150 ${
                        item.isReviewed
                          ? "bg-surface/30 hover:bg-elevated/40"
                          : isUnreadable
                          ? "bg-error/10 hover:bg-error/15 border-l-4 border-l-error"
                          : "hover:bg-elevated/40"
                      }`}
                    >
                      {/* Column 1: Reviewed Checkbox */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <label
                          htmlFor={`review-check-${item.id}`}
                          className="inline-flex items-center justify-center cursor-pointer p-1"
                        >
                          <input
                            id={`review-check-${item.id}`}
                            type="checkbox"
                            checked={item.isReviewed}
                            onChange={() => onToggleReviewed(item.id)}
                            disabled={!isDone}
                            className="w-4 h-4 rounded border-border-warm text-brass bg-elevated focus:ring-brass cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </label>
                      </td>

                      {/* Column 2: Thumbnail with Click-to-Zoom & Save Status */}
                      <td className="py-3.5 px-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div
                            onClick={() => setZoomedImage({ url: item.previewUrl, title: item.fileName })}
                            className="relative w-16 h-11 rounded-lg overflow-hidden border border-border-warm bg-app cursor-pointer group/thumb shadow-sm hover:border-brass transition-colors shrink-0"
                            title="Click to view full size"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={item.previewUrl}
                              alt={item.fileName}
                              className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-200"
                            />
                            <div className="absolute inset-0 bg-app/50 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
                              <Maximize2 className="w-3.5 h-3.5 text-champagne" />
                            </div>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-medium text-champagne truncate max-w-[130px]" title={item.fileName}>
                              {item.fileName}
                            </span>
                            {item.saveStatus === "saving" && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-brass animate-pulse font-medium mt-0.5">
                                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                              </span>
                            )}
                            {item.saveStatus === "saved" && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium mt-0.5">
                                <Check className="w-3 h-3" /> Saved
                              </span>
                            )}
                            {item.saveStatus === "failed" && (
                              <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium mt-0.5">
                                <AlertCircle className="w-3 h-3 shrink-0" />
                                <span>Unsaved</span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRetrySave?.(item.id);
                                  }}
                                  className="ml-1 px-1.5 py-0.2 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 underline cursor-pointer"
                                  title="Retry saving edits to backend"
                                >
                                  Retry
                                </button>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* If the item failed extraction entirely */}
                      {isFailed ? (
                        <td colSpan={5} className="py-3.5 px-4 align-middle">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-lg bg-error/10 border border-error/30 text-rose-300">
                            <span className="text-xs">
                              {item.errorMessage || "Extraction failed. Click retry to run OCR again."}
                            </span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs text-champagne-muted">Type:</span>
                              <select
                                value={item.sourceType || "card"}
                                onChange={(e) => onUpdateSourceType?.(item.id, e.target.value as SourceType)}
                                className="bg-elevated border border-border-warm rounded px-2 py-1 text-xs text-champagne focus:outline-none focus:border-brass cursor-pointer"
                                title="Select source type before retry"
                              >
                                <option value="card">Card</option>
                                <option value="paper">Paper Flyer</option>
                                <option value="panaflex">Panaflex</option>
                              </select>
                              <button
                                onClick={() => onRetryRow(item.id)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-error hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer"
                              >
                                <RotateCw className="w-3 h-3" />
                                <span>Retry</span>
                              </button>
                            </div>
                          </div>
                        </td>
                      ) : isUnreadable ? (
                        /* If ALL fields are null (unreadable image): FLAG WHOLE ROW CLEARLY */
                        <td colSpan={4} className="py-3.5 px-4 align-middle">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 rounded-xl bg-warning/10 border border-warning/40 text-amber-200">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="w-4 h-4 text-warning shrink-0 animate-bounce" />
                              <div>
                                <span className="font-semibold text-xs sm:text-sm text-champagne">
                                  ⚠️ Unreadable Image — All extracted fields are null.
                                </span>
                                <span className="text-xs text-amber-200/90 ml-1.5">
                                  Low contrast or blurry photo. Click any cell to enter manually or retry.
                                </span>
                              </div>
                            </div>
                            <button
                              onClick={() => onRetryRow(item.id)}
                              className="self-start sm:self-auto inline-flex items-center gap-1 px-2.5 py-1 rounded bg-warning hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer"
                            >
                              <RotateCw className="w-3 h-3" />
                              <span>Retry OCR</span>
                            </button>
                          </div>
                        </td>
                      ) : (
                        <>
                          {/* Column 3: Company Name */}
                          <td className="py-3.5 px-4 align-middle">
                            <EditableCell
                              itemId={item.id}
                              fieldName="company_name"
                              value={data?.company_name ?? null}
                              confidence={data?.confidence.company_name}
                              isEditing={editingCell?.id === item.id && editingCell?.field === "company_name"}
                              isEditable={isEditable}
                              tempValue={tempValue}
                              placeholder="Enter company name..."
                              onStartEdit={(val) => startEditing(item.id, "company_name", val)}
                              onChangeTempValue={setTempValue}
                              onCommit={() => commitEdit(item.id, "company_name")}
                              onKeyDown={(e) => handleKeyDown(e, item.id, "company_name")}
                            />
                          </td>

                          {/* Column 4: Email */}
                          <td className="py-3.5 px-4 align-middle">
                            <EditableCell
                              itemId={item.id}
                              fieldName="email"
                              value={data?.email ?? null}
                              confidence={data?.confidence.email}
                              isEditing={editingCell?.id === item.id && editingCell?.field === "email"}
                              isEditable={isEditable}
                              tempValue={tempValue}
                              placeholder="Enter email address..."
                              onStartEdit={(val) => startEditing(item.id, "email", val)}
                              onChangeTempValue={setTempValue}
                              onCommit={() => commitEdit(item.id, "email")}
                              onKeyDown={(e) => handleKeyDown(e, item.id, "email")}
                            />
                          </td>

                          {/* Column 5: Phone */}
                          <td className="py-3.5 px-4 align-middle">
                            <EditableCell
                              itemId={item.id}
                              fieldName="phone"
                              value={data?.phone ?? null}
                              confidence={data?.confidence.phone}
                              isEditing={editingCell?.id === item.id && editingCell?.field === "phone"}
                              isEditable={isEditable}
                              tempValue={tempValue}
                              placeholder="Enter phone number..."
                              onStartEdit={(val) => startEditing(item.id, "phone", val)}
                              onChangeTempValue={setTempValue}
                              onCommit={() => commitEdit(item.id, "phone")}
                              onKeyDown={(e) => handleKeyDown(e, item.id, "phone")}
                            />
                          </td>

                          {/* Column 6: Website */}
                          <td className="py-3.5 px-4 align-middle">
                            <EditableCell
                              itemId={item.id}
                              fieldName="website"
                              value={data?.website ?? null}
                              confidence={data?.confidence.website}
                              isEditing={editingCell?.id === item.id && editingCell?.field === "website"}
                              isEditable={isEditable}
                              tempValue={tempValue}
                              placeholder="Enter website url..."
                              onStartEdit={(val) => startEditing(item.id, "website", val)}
                              onChangeTempValue={setTempValue}
                              onCommit={() => commitEdit(item.id, "website")}
                              onKeyDown={(e) => handleKeyDown(e, item.id, "website")}
                            />
                          </td>
                        </>
                      )}

                      {/* Column 7: Source Type (Read-only) */}
                      <td className="py-3.5 px-4 align-middle">
                        {data ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-elevated text-champagne border border-border-warm capitalize">
                            {data.source_type || item.sourceType || "card"}
                          </span>
                        ) : (
                          <span className="text-champagne-muted/50">—</span>
                        )}
                      </td>

                      {/* Column 8: Actions (Retry / Delete) */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <div className="inline-flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                          {isDone && (
                            <button
                              onClick={() => onRetryRow(item.id)}
                              className="p-1 rounded text-champagne-muted hover:text-brass hover:bg-elevated transition-colors cursor-pointer"
                              title="Re-run extraction on this card"
                            >
                              <RotateCw className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteRow(item.id)}
                            className="p-1 rounded text-champagne-muted hover:text-error hover:bg-elevated transition-colors cursor-pointer"
                            title="Delete this row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Full Size Image Preview Modal */}
      {zoomedImage && (
        <div
          onClick={() => setZoomedImage(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-w-3xl w-full bg-surface border border-border-warm rounded-2xl overflow-hidden shadow-2xl p-4 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-border-warm">
              <h4 className="font-semibold text-champagne text-sm">{zoomedImage.title}</h4>
              <button
                onClick={() => setZoomedImage(null)}
                className="p-1 rounded-lg text-champagne-muted hover:text-champagne hover:bg-elevated cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="relative aspect-[16/10] bg-app rounded-xl overflow-hidden flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={zoomedImage.url}
                alt={zoomedImage.title}
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>
            <p className="text-xs text-champagne-muted text-center">
              Compare this original card photo with the extracted fields to verify details.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Subcomponent for each inline editable table cell
 */
interface EditableCellProps {
  itemId: string;
  fieldName: string;
  value: string | null;
  confidence?: number;
  isEditing: boolean;
  isEditable?: boolean;
  tempValue: string;
  placeholder: string;
  onStartEdit: (val: string | null) => void;
  onChangeTempValue: (val: string) => void;
  onCommit: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

function EditableCell({
  value,
  confidence,
  isEditing,
  isEditable = true,
  tempValue,
  placeholder,
  onStartEdit,
  onChangeTempValue,
  onCommit,
  onKeyDown,
}: EditableCellProps) {
  const isLow = isLowConfidence(confidence);
  const confPercent = typeof confidence === "number" ? Math.round(confidence * 100) : null;

  if (isEditing) {
    return (
      <div className="relative">
        <input
          type="text"
          value={tempValue}
          onChange={(e) => onChangeTempValue(e.target.value)}
          onBlur={onCommit}
          onKeyDown={onKeyDown}
          autoFocus
          className="w-full px-2.5 py-1 text-xs rounded-md bg-elevated border-2 border-brass text-champagne focus:outline-none shadow-sm"
          placeholder={placeholder}
        />
        <span className="text-[10px] text-champagne-muted mt-0.5 block">Press Enter ↵ to save, Esc to cancel</span>
      </div>
    );
  }

  return (
    <div
      onClick={() => isEditable && onStartEdit(value)}
      className={`group/cell relative px-2.5 py-1.5 rounded-lg border transition-all duration-200 select-none flex items-center justify-between gap-1.5 ${
        !isEditable
          ? "border-transparent opacity-80 cursor-default"
          : isLow
          ? "border-warning bg-warning/10 text-amber-200 shadow-xs shadow-warning/10 hover:border-amber-300 cursor-pointer"
          : "border-transparent hover:border-border-warm hover:bg-elevated/60 text-champagne cursor-pointer"
      }`}
      title={
        !isEditable
          ? "Row is not editable until extraction is complete."
          : isLow
          ? `⚠️ Low OCR Confidence: ${confPercent}%. Click to verify or edit.`
          : `OCR Confidence: ${confPercent}%. Click to edit inline.`
      }
    >
      <span className={`truncate ${!value ? "italic text-champagne-muted/60" : ""}`}>
        {value || "(blank)"}
      </span>

      {/* Confidence Pill / Warning Flag */}
      <div className="flex items-center gap-1 shrink-0">
        {isLow && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-warning text-slate-950 border border-amber-300 shadow-xs">
            <AlertTriangle className="w-2.5 h-2.5 text-slate-950" />
            <span>{confPercent}%</span>
          </span>
        )}
        {!isLow && confPercent !== null && (
          <span className="opacity-0 group-hover/cell:opacity-100 text-[10px] text-champagne-muted transition-opacity">
            {confPercent}%
          </span>
        )}
      </div>
    </div>
  );
}
