"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "warning" | "error" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
}

interface ToastContextValue {
  showToast: (toast: Omit<ToastMessage, "id">) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type, title, description }: Omit<ToastMessage, "id">) => {
      const id = Math.random().toString(36).substring(2, 9);
      setToasts((prev) => [...prev, { id, type, title, description }]);

      setTimeout(() => {
        removeToast(id);
      }, 4200);
    },
    [removeToast]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          let icon = <Info className="w-5 h-5 text-brass shrink-0" />;
          let border = "border-brass/40 bg-surface/95";
          if (toast.type === "success") {
            icon = <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />;
            border = "border-emerald-500/30 bg-surface/95";
          } else if (toast.type === "warning") {
            icon = <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />;
            border = "border-amber-500/30 bg-surface/95";
          } else if (toast.type === "error") {
            icon = <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />;
            border = "border-rose-500/30 bg-surface/95";
          }

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 transform translate-y-0 text-slate-100 ${border}`}
            >
              {icon}
              <div className="flex-1 text-sm">
                <p className="font-semibold leading-tight text-white">{toast.title}</p>
                {toast.description && (
                  <p className="mt-1 text-xs text-slate-300 leading-relaxed">
                    {toast.description}
                  </p>
                )}
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-white p-0.5 rounded transition-colors"
                aria-label="Dismiss notification"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}
