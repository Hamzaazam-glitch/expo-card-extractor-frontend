"use client";

import React from "react";
import { Sparkles, ScanLine, CheckSquare, AlertTriangle, Layers, RotateCcw, RotateCw } from "lucide-react";
import { CardItem } from "@/types/extractor";

interface HeroHeaderProps {
  items: CardItem[];
  onClearAll: () => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export default function HeroHeader({ items, onClearAll, onRefresh, isRefreshing }: HeroHeaderProps) {
  const total = items.length;
  const processing = items.filter((i) => i.status === "processing" || i.status === "queued").length;
  const completed = items.filter((i) => i.status === "done").length;
  const reviewed = items.filter((i) => i.isReviewed && i.status === "done").length;
  
  // Count items with low confidence or unreadable
  const lowConfidenceCount = items.filter((item) => {
    if (item.status !== "done" || !item.data) return false;
    const c = item.data.confidence;
    return c.company_name < 0.6 || c.email < 0.6 || c.phone < 0.6 || c.website < 0.6;
  }).length;

  return (
    <header className="relative z-10 pt-8 pb-6 border-b border-border-warm bg-surface/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Logo & Headline */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-brass/10 border border-brass/30 text-champagne">
              <Sparkles className="w-3.5 h-3.5 text-brass animate-pulse" />
              <span>Connected to FastAPI OCR • Live Backend</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-champagne flex items-center gap-3">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-brass via-brass-hover to-champagne text-app shadow-lg shadow-brass/25">
                <ScanLine className="w-7 h-7 text-app" />
              </span>
              <span>Expo Card Extractor</span>
            </h1>
            <p className="text-sm sm:text-base text-champagne-muted max-w-2xl">
              Turn stacks of physical business cards, booth flyers, and panaflex banners into clean, verified lead data with OCR confidence validation.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            {onRefresh && (
              <button
                onClick={onRefresh}
                disabled={isRefreshing}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium bg-elevated hover:bg-surface text-champagne border border-border-warm hover:border-brass/50 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                title="Refetch all saved records from backend GET /records"
              >
                <RotateCw className={`w-4 h-4 text-brass ${isRefreshing ? "animate-spin" : ""}`} />
                <span>{isRefreshing ? "Refreshing..." : "Refresh"}</span>
              </button>
            )}

            {total > 0 && (
              <button
                onClick={onClearAll}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium text-champagne-muted hover:text-error hover:bg-error/10 border border-transparent hover:border-error/30 transition-all duration-200 cursor-pointer"
                title="Clear all cards and reset"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset All</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Metrics Row */}
        {total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5 mt-6 pt-5 border-t border-border-warm/60">
            <div className="p-3.5 rounded-xl bg-surface/90 border border-border-warm">
              <div className="flex items-center justify-between text-xs text-champagne-muted font-medium">
                <span>Total Cards</span>
                <Layers className="w-4 h-4 text-champagne-muted/60" />
              </div>
              <p className="text-2xl font-bold text-champagne mt-1">{total}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface/90 border border-border-warm">
              <div className="flex items-center justify-between text-xs text-champagne-muted font-medium">
                <span>Processing</span>
                <span className={`w-2 h-2 rounded-full ${processing > 0 ? "bg-warning animate-ping" : "bg-elevated"}`} />
              </div>
              <p className="text-2xl font-bold text-warning mt-1">{processing}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface/90 border border-border-warm">
              <div className="flex items-center justify-between text-xs text-champagne-muted font-medium">
                <span>Extracted</span>
                <span className="w-2 h-2 rounded-full bg-success" />
              </div>
              <p className="text-2xl font-bold text-success mt-1">{completed}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface/90 border border-border-warm">
              <div className="flex items-center justify-between text-xs text-champagne-muted font-medium">
                <span>Reviewed</span>
                <CheckSquare className="w-4 h-4 text-brass" />
              </div>
              <p className="text-2xl font-bold text-brass mt-1">
                {reviewed} <span className="text-xs text-champagne-muted/70 font-normal">/ {completed}</span>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-surface/90 border border-border-warm col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-xs text-champagne-muted font-medium">
                <span>Needs Review (&lt;60%)</span>
                <AlertTriangle className="w-4 h-4 text-warning" />
              </div>
              <p className="text-2xl font-bold text-warning mt-1">{lowConfidenceCount}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
