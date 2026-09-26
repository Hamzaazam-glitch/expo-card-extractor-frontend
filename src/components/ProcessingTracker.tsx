"use client";

import React from "react";
import { Loader2, CheckCircle2, AlertOctagon, RotateCw, Hourglass } from "lucide-react";
import { CardItem } from "@/types/extractor";

interface ProcessingTrackerProps {
  items: CardItem[];
  onRetryFailed: (id?: string) => void;
}

export default function ProcessingTracker({ items, onRetryFailed }: ProcessingTrackerProps) {
  const queued = items.filter((i) => i.status === "queued").length;
  const processing = items.filter((i) => i.status === "processing").length;
  const done = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "failed");

  if (items.length === 0) return null;

  const total = items.length;
  const percentDone = Math.round((done / total) * 100);

  return (
    <div className="rounded-xl bg-slate-900/60 border border-slate-800/80 p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Progress Pipeline Summary */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center gap-2">
              {processing > 0 ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-indigo-400 animate-spin" />
                  <span>Processing pipeline active (non-blocking)</span>
                </>
              ) : failed.length > 0 ? (
                <>
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                  <span>Extraction finished with {failed.length} failed</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Extraction completed</span>
                </>
              )}
            </span>
            <span className="text-slate-400 font-mono text-xs">{percentDone}% completed</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 transition-all duration-300 ease-out"
              style={{ width: `${percentDone}%` }}
            />
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {queued > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1.5">
              <Hourglass className="w-3 h-3 text-slate-400" />
              <span>{queued} Queued</span>
            </span>
          )}
          {processing > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{processing} Processing</span>
            </span>
          )}
          {done > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" />
              <span>{done} Done</span>
            </span>
          )}
          {failed.length > 0 && (
            <button
              onClick={() => onRetryFailed()}
              className="px-2.5 py-1 rounded-md bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Retry all failed cards"
            >
              <RotateCw className="w-3 h-3" />
              <span>Retry {failed.length} Failed</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
