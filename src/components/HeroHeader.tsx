"use client";

import React from "react";
import { Sparkles, ScanLine, CheckSquare, AlertTriangle, Layers, RotateCcw } from "lucide-react";
import { CardItem } from "@/types/extractor";

interface HeroHeaderProps {
  items: CardItem[];
  onLoadSamples: () => void;
  onClearAll: () => void;
}

export default function HeroHeader({ items, onLoadSamples, onClearAll }: HeroHeaderProps) {
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
    <header className="relative z-10 pt-8 pb-6 border-b border-slate-800/80 bg-slate-950/40 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Logo & Headline */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />
              <span>FastAPI OCR Ready • Frontend Demo</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white flex items-center gap-3">
              <span className="p-2 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 text-white shadow-lg shadow-indigo-500/25">
                <ScanLine className="w-7 h-7" />
              </span>
              <span>Expo Card Extractor</span>
            </h1>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl">
              Turn stacks of physical business cards, booth flyers, and panaflex banners into clean, verified lead data with OCR confidence validation.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={onLoadSamples}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-slate-800 hover:bg-slate-700/90 border border-slate-700 shadow-sm transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
              title="Instantly load sample expo cards with high confidence, low confidence, and unreadable scans"
            >
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>Load Sample Cards</span>
            </button>
            {total > 0 && (
              <button
                onClick={onClearAll}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition-all duration-200 cursor-pointer"
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
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3.5 mt-6 pt-5 border-t border-slate-800/60">
            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/70">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Total Cards</span>
                <Layers className="w-4 h-4 text-slate-500" />
              </div>
              <p className="text-2xl font-bold text-white mt-1">{total}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/70">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Processing</span>
                <span className={`w-2 h-2 rounded-full ${processing > 0 ? "bg-amber-400 animate-ping" : "bg-slate-600"}`} />
              </div>
              <p className="text-2xl font-bold text-amber-400 mt-1">{processing}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/70">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Extracted</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              </div>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{completed}</p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/70">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Reviewed</span>
                <CheckSquare className="w-4 h-4 text-indigo-400" />
              </div>
              <p className="text-2xl font-bold text-indigo-400 mt-1">
                {reviewed} <span className="text-xs text-slate-500 font-normal">/ {completed}</span>
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/70 col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between text-xs text-slate-400 font-medium">
                <span>Needs Review (&lt;60%)</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <p className="text-2xl font-bold text-amber-300 mt-1">{lowConfidenceCount}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
