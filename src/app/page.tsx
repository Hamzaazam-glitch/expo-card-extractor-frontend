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
  SAMPLE_PREVIEWS,
} from "@/services/extractorService";

function ExpoCardExtractorApp() {
  const [items, setItems] = useState<CardItem[]>([]);
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
      status: "queued",
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

  // Load sample exhibition cards
  const handleLoadSamples = useCallback(() => {
    const sampleItems: CardItem[] = SAMPLE_PREVIEWS.map((sample, idx) => ({
      id: generateUUID(),
      fileName: sample.name,
      fileSize: sample.size,
      fileType: "image/jpeg",
      previewUrl: sample.url,
      status: "queued",
      data: null,
      isReviewed: false,
      createdAt: Date.now() + idx,
    }));

    setItems((prev) => [...prev, ...sampleItems]);
    showToast({
      type: "success",
      title: "Sample Expo Cards Loaded",
      description: "Loaded 6 demonstration cards including clear, low-confidence, and unreadable scans.",
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
      // Find item
      const currentItem = items.find((i) => i.id === itemId);
      const res = await extractCardData(
        { name: currentItem ? currentItem.fileName : "card.jpg" },
        shouldSimulateFail
      );

      // Set status to done with data
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                status: "done",
                data: res,
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
  }, [items]);

  // Extract All pending items (non-blocking)
  const handleExtractAll = useCallback(async () => {
    const queuedItems = items.filter((i) => i.status === "queued");
    if (queuedItems.length === 0) return;

    setIsExtractingAll(true);

    // Run parallel batches with concurrency of 2 to simulate real OCR throughput
    const batchSize = 2;
    for (let i = 0; i < queuedItems.length; i += batchSize) {
      const chunk = queuedItems.slice(i, i + batchSize);
      await Promise.all(
        chunk.map((item, idx) => {
          // Simulate 1 intermittent failure for testing retry flow if filename has 'zenith'
          const shouldFail = item.fileName.toLowerCase().includes("zenith") && !item.errorMessage;
          return processCard(item.id, shouldFail);
        })
      );
    }

    setIsExtractingAll(false);
    showToast({
      type: "success",
      title: "Batch Extraction Complete",
      description: "Finished processing card queue. Review any flagged rows below.",
    });
  }, [items, processCard, showToast]);

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

  // Inline edit field updater
  const handleUpdateField = useCallback(
    (
      id: string,
      field: keyof Omit<ExtractedCardData, "confidence" | "image_id" | "source_type">,
      value: string
    ) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id || !item.data) return item;
          return {
            ...item,
            data: {
              ...item.data,
              [field]: value || null,
              confidence: {
                ...item.data.confidence,
                // Once manually edited, set confidence to 1.0 (verified)
                [field]: 1.0,
              },
            },
          };
        })
      );
      showToast({
        type: "info",
        title: "Field Updated",
        description: `Saved ${field.replace("_", " ")} edit and marked confidence as 100%.`,
      });
    },
    [showToast]
  );

  // Update source type
  const handleUpdateSourceType = useCallback((id: string, sourceType: SourceType) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== id || !item.data) return item;
        return {
          ...item,
          data: {
            ...item.data,
            source_type: sourceType,
          },
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
    <div className="relative min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500 selection:text-white flex flex-col font-sans">
      {/* Background Three.js subtle visual flair */}
      <ThreeCanvas />

      {/* Top Header */}
      <HeroHeader
        items={items}
        onLoadSamples={handleLoadSamples}
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
            onLoadSamples={handleLoadSamples}
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
                onUpdateSourceType={handleUpdateSourceType}
                onToggleReviewed={handleToggleReviewed}
                onRetryRow={handleRetryRow}
                onDeleteRow={handleDeleteRow}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-slate-900 bg-slate-950/80 py-6 text-center text-xs text-slate-500">
        <p>
          Expo Card Extractor • Next.js App Router + TypeScript + Tailwind CSS + Framer Motion
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
