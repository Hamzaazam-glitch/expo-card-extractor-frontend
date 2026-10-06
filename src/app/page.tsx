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
import { BackendRecord, CardItem, ExtractedCardData, FieldConfidence, SourceType } from "@/types/extractor";
import {
  extractFromImageId,
  generateUUID,
  getRecords,
  patchRecord,
  PatchRecordFields,
  uploadCardImage,
} from "@/services/extractorService";

function mergeBackendRecords(prevItems: CardItem[], records: BackendRecord[]): CardItem[] {
  // Map current items by image_id (support both item.imageId set during upload and item.data.image_id)
  const existingByImageId = new Map<string, CardItem>();
  for (const item of prevItems) {
    const imgId = item.imageId || item.data?.image_id;
    if (imgId) {
      existingByImageId.set(imgId, item);
    }
  }

  const incomingImageIds = new Set<string>();

  // Build list of records from backend (newest first)
  const mergedBackendItems: CardItem[] = records.map((record) => {
    incomingImageIds.add(record.image_id);
    const existing = existingByImageId.get(record.image_id);

    // If item in current session is queued/processing or has unsaved/failed/saving edits, keep current state
    if (
      existing &&
      (existing.status === "queued" ||
        existing.status === "processing" ||
        existing.saveStatus === "saving" ||
        existing.saveStatus === "failed")
    ) {
      return existing;
    }

    // If row exists in current session, preserve its local blob previewUrl
    const previewUrl =
      existing?.previewUrl && existing.previewUrl.startsWith("blob:")
        ? existing.previewUrl
        : record.storage_url || "";

    return {
      id: existing ? existing.id : generateUUID(),
      imageId: record.image_id,
      fileName: existing
        ? existing.fileName
        : record.image_id
        ? record.image_id.slice(0, 8)
        : "restored",
      fileSize: existing ? existing.fileSize : 0,
      fileType: existing ? existing.fileType : "image/jpeg",
      previewUrl,
      storageUrl: record.storage_url,
      file: existing?.file,
      isRestored: !existing,
      status: "done",
      isReviewed: Boolean(record.reviewed),
      sourceType: record.source_type || "card",
      saveStatus: existing?.saveStatus === "failed" ? "failed" : "idle",
      saveError: existing?.saveError,
      createdAt: existing ? existing.createdAt : Date.now(),
      data: {
        image_id: record.image_id,
        company_name: record.company_name,
        email: record.email,
        phone: record.phone,
        website: record.website,
        confidence: record.confidence,
        source_type: record.source_type,
      },
    };
  });

  // Also keep any active items in current session not yet in backend (e.g. queued or failed before upload)
  const unpersistedSessionItems = prevItems.filter((i) => {
    const imgId = i.imageId || i.data?.image_id;
    return !imgId || !incomingImageIds.has(imgId);
  });

  return [...unpersistedSessionItems, ...mergedBackendItems];
}

function revokeIfBlob(url?: string | null) {
  if (url && typeof url === "string" && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // Ignore if already revoked or invalid
    }
  }
}

function ExpoCardExtractorApp() {
  const [items, setItems] = useState<CardItem[]>([]);
  const itemsRef = React.useRef<CardItem[]>(items);
  React.useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Revoke all active blob URLs on unmount to prevent browser memory leaks
  React.useEffect(() => {
    return () => {
      for (const item of itemsRef.current) {
        revokeIfBlob(item.previewUrl);
      }
    };
  }, []);

  const patchQueuesRef = React.useRef<
    Map<
      string,
      {
        inFlight: boolean;
        queuedFields: PatchRecordFields | null;
      }
    >
  >(new Map());

  const [isExtractingAll, setIsExtractingAll] = useState(false);
  const [isRetryingFailed, setIsRetryingFailed] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { showToast } = useToast();

  // Initial fetch on mount with image_id deduplication
  React.useEffect(() => {
    let active = true;
    getRecords()
      .then((records) => {
        if (!active) return;
        setItems((prev) => mergeBackendRecords(prev, records));
      })
      .catch((err: unknown) => {
        if (!active) return;
        const msg = err instanceof Error ? err.message : "Could not load saved records";
        showToast({
          type: "error",
          title: "Could not load saved records",
          description: `${msg}. You can continue uploading or click Refresh to retry.`,
        });
      });

  return () => {
      active = false;
    };
  }, [showToast]);

  // Manual refresh handler
  const handleManualRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const records = await getRecords();
      setItems((prev) => mergeBackendRecords(prev, records));
      showToast({
        type: "success",
        title: "Records Refreshed",
        description: `Loaded ${records.length} saved record${records.length === 1 ? "" : "s"} from backend.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not load saved records";
      showToast({
        type: "error",
        title: "Could not load saved records",
        description: `${msg}. You can continue uploading or click Refresh to retry.`,
      });
    } finally {
      setIsRefreshing(false);
    }
  }, [showToast]);

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
    const item = itemsRef.current.find((i) => i.id === id);
    if (item?.previewUrl) {
      revokeIfBlob(item.previewUrl);
    }
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  // Clear all items
  const handleClearAll = useCallback(() => {
    for (const item of itemsRef.current) {
      revokeIfBlob(item.previewUrl);
    }
    setItems([]);
    showToast({
      type: "info",
      title: "Reset",
      description: "All cards and extracted data have been cleared.",
    });
  }, [showToast]);

  // Process a single card (called sequentially or with concurrency)
  const processCard = useCallback(async (itemId: string) => {
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

      const selectedSourceType = currentItem.sourceType || "card";
      let imageId = currentItem.imageId || currentItem.data?.image_id;

      if (!imageId) {
        // Step 1: Upload image file
        const input = currentItem.file || {
          name: currentItem.fileName,
          previewUrl: currentItem.previewUrl,
        };
        imageId = await uploadCardImage(input);

        // F2 amendment: set imageId on the item immediately after /upload resolves
        setItems((prev) =>
          prev.map((item) =>
            item.id === itemId
              ? { ...item, imageId }
              : item
          )
        );
      }

      // Step 2: Extract data using imageId (only calls POST /extract)
      const res = await extractFromImageId(imageId, selectedSourceType);

      // Set status to done with data and preserve imageId
      setItems((prev) =>
        prev.map((item) =>
          item.id === itemId
            ? {
                ...item,
                imageId: res.image_id || imageId,
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
      // If /upload succeeded but /extract failed, imageId is already retained on the item
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
      await processCard(item.id);
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
      await processCard(id);
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
    if (isRetryingFailed) return;
    const failedItems = itemsRef.current.filter((i) => i.status === "failed");
    if (failedItems.length === 0) return;

    setIsRetryingFailed(true);
    try {
      showToast({
        type: "info",
        title: "Retrying Failed Cards",
        description: `Re-processing ${failedItems.length} failed card${failedItems.length > 1 ? "s" : ""}...`,
      });

      for (const item of failedItems) {
        await processCard(item.id);
      }
    } finally {
      setIsRetryingFailed(false);
    }
  }, [isRetryingFailed, processCard, showToast]);

  // Dispatch PATCH /records/{id} for inline edits with per-row in-flight queue (latest edit wins)
  const dispatchPatch = useCallback(
    async (rowId: string, newFields: PatchRecordFields) => {
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
            confidence: newFields.confidence || queueEntry.queuedFields?.confidence,
            reviewed: newFields.reviewed !== undefined ? newFields.reviewed : queueEntry.queuedFields?.reviewed,
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
          // F4 STATE-02: keep queued edits when a PATCH fails so Retry re-sends them
          const pending = patchQueuesRef.current.get(rowId)?.queuedFields;
          patchQueuesRef.current.set(rowId, {
            inFlight: false,
            queuedFields: {
              ...fieldsToSend,
              ...(pending || {}),
            },
          });
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
  // Clearing sends null with confidence 0.0. Edits send value with confidence 1.0. Full 4-key confidence always sent.
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

      const trimmedVal = value.trim();
      const isClearing = !trimmedVal;
      const targetValue = isClearing ? null : trimmedVal;
      const newConfidenceForField = isClearing ? 0.0 : 1.0;

      const currentConf = currentItem.data.confidence || {
        company_name: 0.0,
        email: 0.0,
        phone: 0.0,
        website: 0.0,
      };

      const updatedConfidence: FieldConfidence = {
        company_name: field === "company_name" ? newConfidenceForField : (currentConf.company_name ?? 0.0),
        email: field === "email" ? newConfidenceForField : (currentConf.email ?? 0.0),
        phone: field === "phone" ? newConfidenceForField : (currentConf.phone ?? 0.0),
        website: field === "website" ? newConfidenceForField : (currentConf.website ?? 0.0),
      };

      // 1. Optimistic UI update: keep edit visible, set saving status
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id || !item.data) return item;
          return {
            ...item,
            saveStatus: "saving",
            saveError: undefined,
            data: {
              ...item.data,
              [field]: targetValue,
              confidence: updatedConfidence,
            },
          };
        })
      );

      // 2. Dispatch PATCH for this field with targetValue (null if cleared) + full 4-key confidence
      dispatchPatch(id, {
        [field]: targetValue,
        confidence: updatedConfidence,
      });
    },
    [dispatchPatch]
  );

  // Retry saving a failed row edit (sends queued fields only with freshly rebuilt confidence)
  const handleRetrySave = useCallback(
    (id: string) => {
      const currentItem = itemsRef.current.find((i) => i.id === id);
      if (!currentItem || currentItem.status !== "done" || !currentItem.data?.image_id) {
        return;
      }

      const queueEntry = patchQueuesRef.current.get(id);
      const queued = queueEntry?.queuedFields;
      if (!queued || Object.keys(queued).length === 0) {
        return;
      }

      showToast({
        type: "info",
        title: "Retrying Save",
        description: `Re-sending edits for "${currentItem.fileName}" to backend...`,
      });

      // Always rebuild 4-key confidence from CURRENT item state (never from a stale queued copy)
      const currentConf = currentItem.data.confidence || {
        company_name: 0.0,
        email: 0.0,
        phone: 0.0,
        website: 0.0,
      };
      const rebuiltConfidence: FieldConfidence = {
        company_name: currentConf.company_name ?? 0.0,
        email: currentConf.email ?? 0.0,
        phone: currentConf.phone ?? 0.0,
        website: currentConf.website ?? 0.0,
      };

      // Resend queued fields only (no guessing "edited fields") + rebuilt confidence
      const fieldsToResend: PatchRecordFields = {
        confidence: rebuiltConfidence,
      };
      if ("company_name" in queued) fieldsToResend.company_name = queued.company_name;
      if ("email" in queued) fieldsToResend.email = queued.email;
      if ("phone" in queued) fieldsToResend.phone = queued.phone;
      if ("website" in queued) fieldsToResend.website = queued.website;

      dispatchPatch(id, fieldsToResend);
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

  // Toggle reviewed status via PATCH { reviewed: true | false } only (independent of field queue)
  const handleToggleReviewed = useCallback(
    async (id: string) => {
      const currentItem = itemsRef.current.find((i) => i.id === id);
      if (!currentItem || currentItem.status !== "done") {
        return;
      }

      const nextReviewed = !currentItem.isReviewed;

      // 1. Optimistic UI update with saving pill
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                isReviewed: nextReviewed,
                saveStatus: "saving",
                saveError: undefined,
              }
            : item
        )
      );

      // 2. Dispatch independent PATCH { reviewed: nextReviewed } if item has image_id
      const imageId = currentItem.data?.image_id;
      if (imageId) {
        try {
          await patchRecord(imageId, { reviewed: nextReviewed });
          setItems((prev) =>
            prev.map((item) =>
              item.id === id ? { ...item, saveStatus: "saved", saveError: undefined } : item
            )
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : "Failed to update review status";
          setItems((prev) =>
            prev.map((item) =>
              item.id === id
                ? {
                    ...item,
                    isReviewed: !nextReviewed, // revert optimistic state on failure
                    saveStatus: "failed",
                    saveError: msg,
                  }
                : item
            )
          );
          showToast({
            type: "error",
            title: "Review Update Failed",
            description: msg,
          });
        }
      } else {
        setItems((prev) =>
          prev.map((item) =>
            item.id === id ? { ...item, saveStatus: "saved" } : item
          )
        );
      }
    },
    [showToast]
  );

  // Delete row
  const handleDeleteRow = useCallback(
    (id: string) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (item?.previewUrl) {
        revokeIfBlob(item.previewUrl);
      }
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
        onRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
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
              <ProcessingTracker
                items={items}
                onRetryFailed={handleRetryFailed}
                isRetrying={isRetryingFailed}
              />
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
