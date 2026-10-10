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
  Image as ImageIcon,
} from "lucide-react";
import { CardItem, ExtractedCardData, SourceType, TableFilter } from "@/types/extractor";
import { isAllFieldsNull } from "@/services/extractorService";

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
  lockedRowId?: string | null;
}

export default function ReviewTable({
  items,
  onUpdateField,
  onUpdateSourceType,
  onToggleReviewed,
  onRetryRow,
  onDeleteRow,
  onRetrySave,
  lockedRowId,
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
      if (item.status === "failed") return true;
      if (!item.isReviewed) return true;
      if (item.data) {
        const d = item.data;
        if (!d.company_name || !d.email || !d.phone || !d.website) {
          return true;
        }
      }
      return false;
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

  const cancelEdit = () => {
    setEditingCell(null);
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
            Needs Review ({doneOrFailedItems.filter((i) => i.status === "failed" || !i.isReviewed || (i.data && (!i.data.company_name || !i.data.email || !i.data.phone || !i.data.website))).length})
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
                  const emptyCount =
                    isDone && data
                      ? ["company_name", "email", "phone", "website"].filter(
                          (k) => !data[k as keyof ExtractedCardData] || String(data[k as keyof ExtractedCardData]).trim() === ""
                        ).length
                      : 0;

                  return (
                    <React.Fragment key={item.id}>
                      {/* If ALL fields are null (unreadable image): show warning banner above the row */}
                      {isUnreadable && isDone && (
                        <tr className="bg-warning/10 border-b border-warning/30">
                          <td colSpan={8} className="py-2.5 px-4 align-middle">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-amber-200">
                              <div className="flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-warning shrink-0 animate-bounce" />
                                <span className="font-semibold text-xs sm:text-sm text-champagne">
                                  ⚠️ Unreadable Image — All extracted fields are null.
                                </span>
                                <span className="text-xs text-amber-200/90 ml-1.5">
                                  Low contrast or blurry photo. Enter details manually in the cells below or click Retry OCR.
                                </span>
                              </div>
                              <button
                                onClick={() => onRetryRow(item.id)}
                                disabled={item.status === "processing" || lockedRowId === item.id}
                                className="self-start sm:self-auto inline-flex items-center gap-1 px-2.5 py-1 rounded bg-warning hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                <RotateCw className={`w-3 h-3 ${item.status === "processing" ? "animate-spin" : ""}`} />
                                <span>
                                  {lockedRowId === item.id
                                    ? "Another extraction is running"
                                    : item.status === "processing"
                                    ? "Retrying..."
                                    : "Retry OCR"}
                                </span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}

                      <tr
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
                            <ThumbnailCell
                              previewUrl={item.previewUrl}
                              fileName={item.fileName}
                              onZoom={(url, title) => setZoomedImage({ url, title })}
                            />
                            <div className="flex flex-col min-w-0">
                              <span className="text-xs font-medium text-champagne truncate max-w-[130px]" title={item.fileName}>
                                {item.fileName}
                              </span>
                              {emptyCount > 0 && isDone && (
                                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-warning/15 text-warning font-medium mt-0.5 w-fit border border-warning/30">
                                  {emptyCount} empty
                                </span>
                              )}
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
                                <span className="inline-flex items-center gap-1 text-[11px] text-rose-400 font-medium mt-0.5" title={item.saveError}>
                                  <AlertCircle className="w-3 h-3 shrink-0" />
                                  <span className="truncate max-w-[140px]">{item.saveError || "Unsaved"}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onRetrySave?.(item.id);
                                    }}
                                    className="ml-1 px-1.5 py-0.2 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 underline cursor-pointer shrink-0"
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
                                  disabled={item.status === "processing" || lockedRowId === item.id}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-error hover:bg-rose-500 text-white text-xs font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                  <RotateCw className={`w-3 h-3 ${item.status === "processing" ? "animate-spin" : ""}`} />
                                  <span>
                                    {lockedRowId === item.id
                                      ? "Another extraction is running"
                                      : item.status === "processing"
                                      ? "Retrying..."
                                      : "Retry"}
                                  </span>
                                </button>
                              </div>
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
                                isEditing={editingCell?.id === item.id && editingCell?.field === "company_name"}
                                isEditable={isEditable}
                                tempValue={tempValue}
                                placeholder="Enter company name"
                                onStartEdit={(val) => startEditing(item.id, "company_name", val)}
                                onChangeTempValue={setTempValue}
                                onCommit={() => commitEdit(item.id, "company_name")}
                                onCancel={cancelEdit}
                              />
                            </td>

                            {/* Column 4: Email */}
                            <td className="py-3.5 px-4 align-middle">
                              <EditableCell
                                itemId={item.id}
                                fieldName="email"
                                value={data?.email ?? null}
                                isEditing={editingCell?.id === item.id && editingCell?.field === "email"}
                                isEditable={isEditable}
                                tempValue={tempValue}
                                placeholder="Enter email"
                                onStartEdit={(val) => startEditing(item.id, "email", val)}
                                onChangeTempValue={setTempValue}
                                onCommit={() => commitEdit(item.id, "email")}
                                onCancel={cancelEdit}
                              />
                            </td>

                            {/* Column 5: Phone */}
                            <td className="py-3.5 px-4 align-middle">
                              <EditableCell
                                itemId={item.id}
                                fieldName="phone"
                                value={data?.phone ?? null}
                                isEditing={editingCell?.id === item.id && editingCell?.field === "phone"}
                                isEditable={isEditable}
                                tempValue={tempValue}
                                placeholder="Enter phone"
                                onStartEdit={(val) => startEditing(item.id, "phone", val)}
                                onChangeTempValue={setTempValue}
                                onCommit={() => commitEdit(item.id, "phone")}
                                onCancel={cancelEdit}
                              />
                            </td>

                            {/* Column 6: Website */}
                            <td className="py-3.5 px-4 align-middle">
                              <EditableCell
                                itemId={item.id}
                                fieldName="website"
                                value={data?.website ?? null}
                                isEditing={editingCell?.id === item.id && editingCell?.field === "website"}
                                isEditable={isEditable}
                                tempValue={tempValue}
                                placeholder="Enter website"
                                onStartEdit={(val) => startEditing(item.id, "website", val)}
                                onChangeTempValue={setTempValue}
                                onCommit={() => commitEdit(item.id, "website")}
                                onCancel={cancelEdit}
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

                      {/* Column 8: Actions (Delete) */}
                      <td className="py-3.5 px-3 text-center align-middle">
                        <div className="inline-flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
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
                    </React.Fragment>
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
  isEditing: boolean;
  isEditable?: boolean;
  tempValue: string;
  placeholder: string;
  onStartEdit: (val: string | null) => void;
  onChangeTempValue: (val: string) => void;
  onCommit: () => void;
  onCancel?: () => void;
}

function EditableCell({
  value,
  isEditing,
  isEditable = true,
  tempValue,
  placeholder,
  onStartEdit,
  onChangeTempValue,
  onCommit,
  onCancel,
}: EditableCellProps) {
  const isEmpty = !value || value.trim() === "";
  const isCommittedOrCancelledRef = React.useRef(false);

  React.useEffect(() => {
    if (isEditing) {
      isCommittedOrCancelledRef.current = false;
    }
  }, [isEditing]);

  const handleBlur = () => {
    if (!isCommittedOrCancelledRef.current) {
      isCommittedOrCancelledRef.current = true;
      onCommit();
    }
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (!isCommittedOrCancelledRef.current) {
        isCommittedOrCancelledRef.current = true;
        onCommit();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      isCommittedOrCancelledRef.current = true;
      onCancel?.();
    }
  };

  if (isEditing) {
    return (
      <div className="relative">
        <input
          type="text"
          value={tempValue}
          onChange={(e) => onChangeTempValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={handleInputKeyDown}
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
      tabIndex={isEditable ? 0 : -1}
      role="button"
      onClick={() => isEditable && onStartEdit(value)}
      onKeyDown={(e) => {
        if (!isEditable) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onStartEdit(value);
        }
      }}
      className={`group/cell relative px-2.5 py-1.5 rounded-lg border transition-all duration-200 select-none flex items-center justify-between gap-1.5 focus:outline-none focus:ring-1 focus:ring-brass ${
        !isEditable
          ? "border-transparent opacity-80 cursor-default"
          : isEmpty
          ? "border-dashed border-amber-500/60 bg-amber-500/5 hover:border-amber-400 hover:bg-amber-500/10 cursor-pointer"
          : "border-transparent hover:border-border-warm hover:bg-elevated/60 text-champagne cursor-pointer"
      }`}
      title={
        !isEditable
          ? "Row is not editable until extraction is complete."
          : isEmpty
          ? `Missing field. Click to ${placeholder.toLowerCase()}.`
          : "Click to edit inline."
      }
    >
      {isEmpty ? (
        <span className="text-xs italic text-champagne-muted/50 select-none">
          {placeholder}
        </span>
      ) : (
        <span className="truncate">{value}</span>
      )}

      {/* Empty input badge */}
      {isEmpty && isEditable && (
        <div className="flex items-center gap-1 shrink-0">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/40">
            Needs input
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Subcomponent for row thumbnail with themed fallback when storage_url is null or expired
 */
function ThumbnailCell({
  previewUrl,
  fileName,
  onZoom,
}: {
  previewUrl: string;
  fileName: string;
  onZoom: (url: string, title: string) => void;
}) {
  const [imgError, setImgError] = useState(false);
  const hasImage = Boolean(previewUrl) && !imgError;

  return (
    <div
      onClick={() => hasImage && onZoom(previewUrl, fileName)}
      className={`relative w-16 h-11 rounded-lg overflow-hidden border border-border-warm bg-app shrink-0 transition-colors ${
        hasImage ? "cursor-pointer group/thumb hover:border-brass shadow-sm" : "cursor-default"
      }`}
      title={hasImage ? "Click to view full size" : "No image preview available"}
    >
      {hasImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={fileName}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover/thumb:scale-110 transition-transform duration-200"
          />
          <div className="absolute inset-0 bg-app/50 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center transition-opacity">
            <Maximize2 className="w-3.5 h-3.5 text-champagne" />
          </div>
        </>
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-elevated/70 text-brass/70 border border-border-warm/40">
          <ImageIcon className="w-4 h-4 text-brass/60" />
          <span className="text-[8px] text-champagne-muted/70 font-mono mt-0.5">No image</span>
        </div>
      )}
    </div>
  );
}

