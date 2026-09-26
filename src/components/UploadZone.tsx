"use client";

import React, { useState, useRef, useCallback } from "react";
import { UploadCloud, Image as ImageIcon, X, AlertCircle, Play, Sparkles } from "lucide-react";
import { CardItem } from "@/types/extractor";

interface UploadZoneProps {
  items: CardItem[];
  onAddFiles: (files: File[]) => void;
  onRemoveItem: (id: string) => void;
  onExtractAll: () => void;
  onLoadSamples: () => void;
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
  onLoadSamples,
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
            ? "border-indigo-400 bg-indigo-500/10 shadow-2xl shadow-indigo-500/20 scale-[1.01]"
            : "border-slate-800 hover:border-indigo-500/60 bg-slate-900/40 hover:bg-slate-900/70"
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

        {/* Ambient glow accent inside dropzone */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-indigo-500/10 blur-3xl pointer-events-none rounded-full" />

        <div className="relative z-10 flex flex-col items-center">
          <div
            className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 transition-transform duration-300 group-hover:scale-110 shadow-lg ${
              isDragging
                ? "bg-indigo-600 text-white shadow-indigo-500/50"
                : "bg-slate-800 text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white"
            }`}
          >
            <UploadCloud className="w-8 h-8" />
          </div>

          <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            {isDragging ? "Drop your images right here!" : "Drag & drop card images here, or browse"}
          </h3>
          <p className="text-sm text-slate-400 mt-1.5 max-w-md">
            Supports multiple batch uploads • Accepts JPG, PNG, and WebP up to 10MB each
          </p>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60">
              <ImageIcon className="w-3.5 h-3.5 text-indigo-400" /> Business Cards
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60">
              Paper Flyers
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-md bg-slate-800/80 text-slate-300 border border-slate-700/60">
              Panaflex Banners
            </span>
          </div>
        </div>
      </div>

      {/* Upload Error Banner */}
      {uploadError && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm animate-in fade-in">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
            <span>{uploadError}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setUploadError(null);
            }}
            className="text-rose-400 hover:text-rose-200 p-1"
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
              <h4 className="text-base font-semibold text-white">
                Queue &amp; Previews
              </h4>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
                {items.length} {items.length === 1 ? "card" : "cards"}
              </span>
            </div>

            {/* "Extract All" CTA Button */}
            <div className="flex items-center gap-3">
              <button
                onClick={onExtractAll}
                disabled={isExtracting || pendingCount === 0}
                className={`inline-flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold shadow-lg transition-all duration-200 ${
                  pendingCount === 0
                    ? "bg-slate-800 text-slate-500 border border-slate-700/60 cursor-not-allowed"
                    : isExtracting
                    ? "bg-indigo-600/70 text-indigo-200 cursor-wait animate-pulse"
                    : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
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
                className="group relative rounded-xl bg-slate-900/80 border border-slate-800 overflow-hidden hover:border-slate-700 transition-all duration-200 flex flex-col"
              >
                {/* Image Aspect ratio container */}
                <div className="relative aspect-[16/10] bg-slate-950 overflow-hidden flex items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.previewUrl}
                    alt={item.fileName}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />

                  {/* Status Overlay Badge */}
                  <div className="absolute top-1.5 left-1.5">
                    {item.status === "queued" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800/90 text-slate-300 border border-slate-700 backdrop-blur-xs">
                        Queued
                      </span>
                    )}
                    {item.status === "processing" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/90 text-slate-950 border border-amber-400 backdrop-blur-xs flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
                        Processing
                      </span>
                    )}
                    {item.status === "done" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/90 text-slate-950 border border-emerald-400 backdrop-blur-xs">
                        Done
                      </span>
                    )}
                    {item.status === "failed" && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-500/90 text-white border border-rose-400 backdrop-blur-xs">
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
                    className="absolute top-1.5 right-1.5 p-1 rounded-full bg-slate-900/80 hover:bg-rose-600 text-slate-300 hover:text-white transition-colors opacity-80 group-hover:opacity-100"
                    title="Remove image"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Details Footer */}
                <div className="p-2 text-xs">
                  <p className="font-medium text-slate-200 truncate" title={item.fileName}>
                    {item.fileName}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {(item.fileSize / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="p-8 rounded-2xl bg-slate-900/20 border border-slate-800/60 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-xl bg-slate-800/60 text-slate-500 flex items-center justify-center mb-3">
            <ImageIcon className="w-6 h-6" />
          </div>
          <p className="text-sm font-medium text-slate-300">No cards uploaded yet</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm">
            Drag and drop card photos above or load our pre-configured test cards to explore the OCR pipeline immediately.
          </p>
          <button
            onClick={onLoadSamples}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 transition-colors cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Load 6 Demo Exhibition Cards</span>
          </button>
        </div>
      )}
    </div>
  );
}
