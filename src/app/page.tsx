"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ThreeCanvas from "@/components/ThreeCanvas";
import HeroHeader from "@/components/HeroHeader";
import UploadZone from "@/components/UploadZone";
import ProcessingTracker from "@/components/ProcessingTracker";
import ReviewTable from "@/components/ReviewTable";
import ExportBar from "@/components/ExportBar";
import { ToastProvider, useToast } from "@/components/Toast";
import { CardItem, ExtractedCardData, SourceType } from "@/types/extractor";
import {
  extractCardData,
  generateUUID,
  patchRecord,
} from "@/services/extractorService";

function ExpoCardExtractorApp() {
  const [items, setItems] = useState<CardItem[]>([]);
  const itemsRef = React.useRef<CardItem[]>(items);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const patchQueuesRef = React.useRef<
    Map<
      string,
      {
        inFlight: boolean;
        queuedFields: {
          company_name?: string | null;
          email?: string | null;
          phone?: string | null;
          website?: string | null;
        } | null;
      }
    >
  >(new Map());

  const [isExtractingAll, setIsExtractingAll] = useState(false);
  const { showToast } = useToast();

  // Add files to queue (non-blocking)
  const handleAddFiles = useCallback((files: File[]) => {
    const newItems: CardItem[] = files.map((file) => ({
      id: generateUUID(),
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      previewUrl: URL.createObjectURL(file),
      file: file,
      status: "queued",
      sourceType: "card",
      saveStatus: "idle",
      data: null,
      isReviewed: false,
      createdAt: Date.now(),
    }));

    setItems((prev) => [...prev, ...newItems]);
    showToast({
      type: "info",
      title: "Images Added to Queue",
      description: `Added ${newItems.length} image${newItems.length > 1 ? "s" : ""} ready for extraction.`,
    });
  }, [showToast]);

  // Remove item
  const handleRemoveItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Clear all items
  const handleClearAll = useCallback(() => {
    setItems([]);
    showToast({
      type: "info",
      title: "Reset",
      description: "All cards and extracted data have been cleared.",
    });
  }, [showToast]);

  // Process a single card (called sequentially or with concurrency)
  const processCard = useCallback(async (itemId: string, shouldSimulateFail = false) => {
    // Set status to processing
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, status: "processing", errorMessage: undefined }
          : item
      )
    );

    try {
      // Find item from itemsRef to avoid stale closures
      const currentItem = itemsRef.current.find((i) => i.id === itemId);
      if (!currentItem) return;

      const input = currentItem.file || {
        name: currentItem.fileName,
        previewUrl: currentItem.previewUrl,
      };

      const selectedSourceType = currentItem.sourceType || "card";
      const res = await extractCardData(input, selectedSourceType, shouldSimulateFail);

      // Set status to done with data
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: "done",
                data: res,
                sourceType: res.source_type || selectedSourceType,
                saveStatus: "idle",
                errorMessage: undefined,
              }
            : item
        )
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "OCR Processing failed";
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: "failed",
                errorMessage: msg,
              }
            : item
        )
      );
    }
  }, []);

  // Extract All pending items (non-blocking)
  const handleExtractAll = useCallback(async () => {
    const queuedItems = itemsRef.current.filter((i) => i.status === "queued");
    if (queuedItems.length === 0) return;

    setIsExtractingAll(true);

    // Process queued cards sequentially so local OCR CPU load remains smooth
    for (const item of queuedItems) {
      await processCard(item.id, false);
    }

    setIsExtractingAll(false);
    showToast({
      type: "success",
      title: "Batch Extraction Complete",
      description: "Finished processing card queue. Review any flagged rows below.",
    });
  }, [processCard, showToast]);

  // Retry a single card
  const handleRetryRow = useCallback(
    async (id: string) => {
      showToast({
        type: "info",
        title: "Retrying Extraction",
        description: "Re-submitting image to OCR pipeline...",
      });
      await processCard(id, false);
      showToast({
        type: "success",
        title: "Retry Succeeded",
        description: "Card successfully re-extracted.",
      });
    },
    [processCard, showToast]
  );

  // Retry all failed cards
  const handleRetryFailed = useCallback(async () => {
    const failedItems = items.filter((i) => i.status === "failed");
    if (failedItems.length === 0) return;

    showToast({
      type: "info",
      title: "Retrying Failed Cards",
      description: `Re-processing ${failedItems.length} failed card${failedItems.length > 1 ? "s" : ""}...`,
    });

    for (const item of failedItems) {
      await processCard(item.id, false);
    }
  }, [items, processCard, showToast]);

  // Dispatch PATCH /records/{id} for inline edits with per-row in-flight queue (latest edit wins)
  const dispatchPatch = useCallback(
    async (
      rowId: string,
      newFields: {
        company_name?: string | null;
        email?: string | null;
        phone?: string | null;
        website?: string | null;
      }
    ) => {
      const currentItem = itemsRef.current.find((i) => i.id === rowId);
      if (!currentItem || currentItem.status !== "done" || !currentItem.data?.image_id) {
        return;
      }
      const imageId = currentItem.data.image_id;

      const queueEntry = patchQueuesRef.current.get(rowId);
      if (queueEntry?.inFlight) {
        // Already an in-flight PATCH for this row: merge latest edits into queue
        patchQueuesRef.current.set(rowId, {
          inFlight: true,
          queuedFields: {
            ...(queueEntry.queuedFields || {}),
            ...newFields,
          },
        });
        return;
      }

      // Mark in-flight
      patchQueuesRef.current.set(rowId, { inFlight: true, queuedFields: null });
      let fieldsToSend = { ...newFields };

      // Set row status to "saving"
      setItems((prev) =>
        prev.map((item) =>
          item.id === rowId ? { ...item, saveStatus: "saving", saveError: undefined } : item
        )
      );

      while (true) {
        try {
          await patchRecord(imageId, fieldsToSend);

          // Check if another edit arrived while this PATCH was in-flight
          const currentQueue = patchQueuesRef.current.get(rowId);
          if (currentQueue?.queuedFields && Object.keys(currentQueue.queuedFields).length > 0) {
            fieldsToSend = currentQueue.queuedFields;
            patchQueuesRef.current.set(rowId, { inFlight: true, queuedFields: null });
            continue; // Loop again to send the newest edits
          } else {
            // Mark saved
            patchQueuesRef.current.set(rowId, { inFlight: false, queuedFields: null });
            setItems((prev) =>
              prev.map((item) =>
                item.id === rowId ? { ...item, saveStatus: "saved", saveError: undefined } : item
              )
            );
            break;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to persist edits to backend";
          patchQueuesRef.current.set(rowId, { inFlight: false, queuedFields: null });
          setItems((prev) =>
            prev.map((item) =>
              item.id === rowId ? { ...item, saveStatus: "failed", saveError: msg } : item
            )
          );
          break;
        }
      }
    },
    []
  );

  // Inline edit field updater (for company_name, email, phone, website ONLY)
  const handleUpdateField = useCallback(
    (
      id: string,
      field: keyof Omit<ExtractedCardData, "confidence" | "image_id" | "source_type">,
      value: string
    ) => {
      const currentItem = itemsRef.current.find((i) => i.id === id);
      if (!currentItem || currentItem.status !== "done" || !currentItem.data?.image_id) {
        return;
      }

      const trimmedVal = value || null;

      // 1. Optimistic UI update: keep edit visible, set confidence to 1.0 (local only)
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id || !item.data) return item;
          return {
            ...item,
            saveStatus: "saving",
            saveError: undefined,
            data: {
              ...item.data,
              [field]: trimmedVal,
              confidence: {
                ...item.data.confidence,
                [field]: 1.0,
              },
            },
          };
        })
      );

      // 2. Dispatch PATCH for this field
      dispatchPatch(id, { [field]: trimmedVal });
    },
    [dispatchPatch]
  );

  // Retry saving a failed row edit
  const handleRetrySave = useCallback(
    (id: string) => {
      const currentItem = itemsRef.current.find((i) => i.id === id);
      if (!currentItem || currentItem.status !== "done" || !currentItem.data?.image_id) {
        return;
      }
      showToast({
        type: "info",
        title: "Retrying Save",
        description: `Re-sending edits for "${currentItem.fileName}" to backend...`,
      });
      dispatchPatch(id, {
        company_name: currentItem.data.company_name,
        email: currentItem.data.email,
        phone: currentItem.data.phone,
        website: currentItem.data.website,
      });
    },
    [dispatchPatch, showToast]
  );

  // Update source type on queued or failed cards (re-used on extract/retry)
  const handleUpdateQueuedSourceType = useCallback((id: string, sourceType: SourceType) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        return {
          ...item,
          sourceType,
          data: item.data ? { ...item.data, source_type: sourceType } : null,
        };
      })
    );
  }, []);

  // Toggle reviewed status
  const handleToggleReviewed = useCallback((id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isReviewed: !item.isReviewed } : item
      )
    );
  }, []);

  // Delete row
  const handleDeleteRow = useCallback(
    (id: string) => {
      setItems((prev) => prev.filter((item) => item.id !== id));
      showToast({
        type: "info",
        title: "Row Removed",
        description: "Card removed from table.",
      });
    },
    [showToast]
  );

  const hasDoneOrFailed = items.some((i) => i.status === "done" || i.status === "failed");

  return (
    <div className="relative min-h-screen bg-app text-champagne selection:bg-brass selection:text-app flex flex-col font-sans">
      {/* Background Three.js subtle visual flair */}
      <ThreeCanvas />

      {/* Top Header */}
      <HeroHeader
        items={items}
        onClearAll={handleClearAll}
      />

      {/* Main Container */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Section 1: Upload Dropzone & Queue */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="space-y-4"
        >
          <UploadZone
            items={items}
            onAddFiles={handleAddFiles}
            onRemoveItem={handleRemoveItem}
            onExtractAll={handleExtractAll}
            onUpdateSourceType={handleUpdateQueuedSourceType}
            isExtracting={isExtractingAll}
          />
        </motion.section>

        {/* Section 2: Non-blocking Processing Tracker */}
        <AnimatePresence>
          {items.length > 0 && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
            >
              <ProcessingTracker items={items} onRetryFailed={handleRetryFailed} />
            </motion.section>
          )}
        </AnimatePresence>

        {/* Section 3 & 4: Review Table & Export Bar */}
        <AnimatePresence>
          {hasDoneOrFailed && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              transition={{ duration: 0.35 }}
              className="space-y-6 pt-4"
            >
              {/* Export Toolbar */}
              <ExportBar items={items} />

              {/* Review Table */}
              <ReviewTable
                items={items}
                onUpdateField={handleUpdateField}
                onUpdateSourceType={handleUpdateQueuedSourceType}
                onToggleReviewed={handleToggleReviewed}
                onRetryRow={handleRetryRow}
                onDeleteRow={handleDeleteRow}
                onRetrySave={handleRetrySave}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border-warm bg-surface/80 py-6 text-center text-xs text-champagne-muted">
        <p>
          Expo Card Extractor • Obsidian &amp; Brass Theme • Next.js App Router + TypeScript + Tailwind CSS
        </p>
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <ToastProvider>
      <ExpoCardExtractorApp />
    </ToastProvider>
  );
}
