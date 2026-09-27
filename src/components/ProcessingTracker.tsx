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
    <div className="rounded-xl bg-surface/85 border border-border-warm p-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Progress Pipeline Summary */}
        <div className="space-y-1.5 flex-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-champagne flex items-center gap-2">
              {processing > 0 ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 text-brass animate-spin" />
                  <span>Processing pipeline active (non-blocking)</span>
                </>
              ) : failed.length > 0 ? (
                <>
                  <AlertOctagon className="w-3.5 h-3.5 text-error" />
                  <span>Extraction finished with {failed.length} failed</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                  <span>Extraction completed</span>
                </>
              )}
            </span>
            <span className="text-champagne-muted font-mono text-xs">{percentDone}% completed</span>
          </div>

          {/* Progress bar in Warm Brass & Emerald */}
          <div className="w-full h-2 rounded-full bg-elevated overflow-hidden relative">
            <div
              className="h-full bg-gradient-to-r from-brass via-brass-hover to-emerald-400 transition-all duration-300 ease-out"
              style={{ width: `${percentDone}%` }}
            />
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 text-xs flex-wrap">
          {queued > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-elevated text-champagne border border-border-warm flex items-center gap-1.5">
              <Hourglass className="w-3 h-3 text-champagne-muted" />
              <span>{queued} Queued</span>
            </span>
          )}
          {processing > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-warning/15 text-warning border border-warning/40 flex items-center gap-1.5 animate-pulse font-medium">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>{processing} Processing</span>
            </span>
          )}
          {done > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-success/15 text-success border border-success/40 flex items-center gap-1.5 font-medium">
              <CheckCircle2 className="w-3 h-3" />
              <span>{done} Done</span>
            </span>
          )}
          {failed.length > 0 && (
            <button
              onClick={() => onRetryFailed()}
              className="px-2.5 py-1 rounded-md bg-error/20 hover:bg-error/30 text-rose-300 border border-error/40 flex items-center gap-1.5 transition-colors cursor-pointer"
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
