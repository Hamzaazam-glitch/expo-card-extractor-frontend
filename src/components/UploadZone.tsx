"use client";

import React, { useState, useRef, useCallback } from "react";
import { UploadCloud, Image as ImageIcon, X, AlertCircle, Play, Sparkles } from "lucide-react";
import { CardItem } from "@/types/extractor";

interface UploadZoneProps {
  items: CardItem[];
  onAddFiles: (files: File[]) => void;
  onRemoveItem: (id: string) => void;
  onExtractAll: () => void;
  isExtracting: boolean;
}

const MAX_FILE_SIZE_MB = 10;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export default function UploadZone({
  items,
  onAddFiles,
  onRemoveItem,
  onExtractAll,
  isExtracting,
}: UploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pendingCount = items.filter((i) => i.status === "queued").length;

  const validateAndAddFiles = useCallback(
    (files: FileList | File[]) => {
      setUploadError(null);
      const validFiles: File[] = [];
      const errors: string[] = [];

      Array.from(files).forEach((file) => {
        if (!ALLOWED_TYPES.includes(file.type.toLowerCase()) && !/\.(jpe?g|png|webp)$/i.test(file.name)) {
          errors.push(`"${file.name}" is not an accepted format. Please upload JPG, PNG, or WebP.`);
          return;
        }
        if (file.size > MAX_FILE_SIZE_BYTES) {
          errors.push(`"${file.name}" is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Limit is ${MAX_FILE_SIZE_MB}MB.`);
          return;
        }
        validFiles.push(file);
      });

      if (errors.length > 0) {
        setUploadError(errors[0] + (errors.length > 1 ? ` (and ${errors.length - 1} other file issues)` : ""));
      }

      if (validFiles.length > 0) {
        onAddFiles(validFiles);
      }
    },
    [onAddFiles]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndAddFiles(e.dataTransfer.files);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndAddFiles(e.target.files);
      // Reset input value so re-selecting the same file works
      e.target.value = "";
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`group relative rounded-2xl border-2 border-dashed p-8 sm:p-10 transition-all duration-300 cursor-pointer flex flex-col items-center justify-center text-center overflow-hidden ${
          isDragging
            ? "border-brass bg-brass/10 shadow-2xl shadow-brass/20 scale-[1.01]"
            : "border-border-warm hover:border-brass/70 bg-surface/50 hover:bg-surface/80"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          onChange={handleFileInputChange}
          className="hidden"
          id="card-file-input"
        />

        {/* Ambient glow accent inside dropzone in warm brass */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-brass/10 blur-3xl pointer-events-none rounded-full" />

        <div className="relative z-10 flex flex-col items-center">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-lg ${
              isDragging
                ? "bg-brass text-app shadow-brass/40"
                : "bg-elevated text-brass group-hover:bg-brass group-hover:text-app border border-border-warm"
            }`}
          >
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-champagne tracking-tight">
            {isDragging ? "Drop your images right here!" : "Drag & drop card images here, or browse"}
          </h3>
          <p className="text-sm text-champagne-muted mt-1.5 max-w-md">
            Supports multiple batch uploads • Accepts JPG, PNG, and WebP up to 10MB each
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-elevated text-champagne border border-border-warm">
              <ImageIcon className="w-3.5 h-3.5 text-brass" /> Business Cards
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-elevated text-champagne border border-border-warm">
              Paper Flyers
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-elevated text-champagne border border-border-warm">
              Panaflex Banners
            </span>
          </div>
        </div>
      </div>

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-error/10 border border-error/30 text-rose-300 text-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-error shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setUploadError(null);
            }}
            className="text-rose-400 hover:text-rose-200 p-1 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Selected Thumbnails Preview Grid (Before or during extraction) */}
      {items.length > 0 ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold text-champagne">
                Queue &amp; Previews
              </h4>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-elevated text-champagne border border-border-warm">
                {items.length} {items.length === 1 ? "card" : "cards"}
              </span>
            </div>

            {/* "Extract All" CTA Button in Brushed Brass */}
            <div className="flex items-center gap-3">
              <button
                onClick={onExtractAll}
                disabled={isExtracting || pendingCount === 0}
                className={`inline-flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all duration-200 ${
                  pendingCount === 0
                    ? "bg-elevated text-champagne-muted/50 border border-border-warm cursor-not-allowed"
                    : isExtracting
                    ? "bg-brass/70 text-app cursor-wait animate-pulse"
                    : "bg-brass hover:bg-brass-hover text-app shadow-brass/25 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {isExtracting
                    ? "Extracting OCR Data..."
                    : pendingCount > 0
                    ? `Extract All (${pendingCount} Queued)`
                    : "All Queued Extracted"}
                </span>
              </button>
            </div>
          </div>

          {/* Thumbnail preview strip/grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
            {items.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-xl bg-surface/90 border border-border-warm overflow-hidden hover:border-brass/40 transition-all duration-200 flex flex-col"
              >
                {/* Image Aspect ratio container */}
                <div className="relative aspect-[16/10] bg-app overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.previewUrl}
                    alt={item.fileName}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Status Overlay Badge */}
                  <div className="absolute top-1.5 left-1.5">
                    {item.status === "queued" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-elevated/95 text-champagne border border-border-warm backdrop-blur-xs">
                        Queued
                      </span>
                    )}
                    {item.status === "processing" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-warning text-app border border-amber-300 backdrop-blur-xs flex items-center gap-1 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-app animate-ping" />
                        Processing
                      </span>
                    )}
                    {item.status === "done" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-success text-app border border-emerald-300 backdrop-blur-xs font-bold">
                        Done
                      </span>
                    )}
                    {item.status === "failed" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-error text-white border border-rose-400 backdrop-blur-xs font-bold">
                        Failed
                      </span>
                    )}
                  </div>

                  {/* Remove Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveItem(item.id);
                    }}
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-surface/80 hover:bg-error text-champagne hover:text-white transition-colors opacity-80 group-hover:opacity-100 cursor-pointer"
                    title="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Details Footer */}
                <div className="p-2 text-xs">
                  <p className="font-medium text-champagne truncate" title={item.fileName}>
                    {item.fileName}
                  </p>
                  <p className="text-[10px] text-champagne-muted mt-0.5">
                    {(item.fileSize / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-8 rounded-2xl bg-surface/40 border border-border-warm text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-elevated text-champagne-muted flex items-center justify-center mb-3 border border-border-warm">
            <ImageIcon className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-champagne">No cards uploaded yet</p>
          <p className="text-xs text-champagne-muted mt-1 max-w-sm">
            Drag and drop business card photos, expo flyer scans, or booth banners above to begin extraction with the live backend.
          </p>
        </div>
      )}
    </div>
  );
}
