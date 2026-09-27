import { ExtractedCardData, FieldConfidence, SourceType } from "@/types/extractor";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

/**
 * Resolves file input to a genuine File instance with a backend-compatible extension (.jpg, .jpeg, .png).
 */
export async function resolveToFile(
  input: File | Blob | { name: string; file?: File; previewUrl?: string }
): Promise<File> {
  if (typeof File !== "undefined" && input instanceof File) {
    return input;
  }
  if (typeof Blob !== "undefined" && input instanceof Blob) {
    return new File([input], "card.jpg", { type: input.type || "image/jpeg" });
  }
  if (typeof input === "object" && input !== null) {
    if ("file" in input && input.file instanceof File) {
      return input.file;
    }
    const inputName = "name" in input && typeof input.name === "string" ? input.name : "card.jpg";
    if ("previewUrl" in input && typeof input.previewUrl === "string" && input.previewUrl) {
      const res = await fetch(input.previewUrl);
      const blob = await res.blob();
      const safeName = /\.(jpe?g|png|webp)$/i.test(inputName) ? inputName : `${inputName}.jpg`;
      return new File([blob], safeName, { type: blob.type || "image/jpeg" });
    }
  }
  throw new Error("No image file provided for extraction. Please upload a real card photo.");
}

// Helper to generate a random UUID-like string
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Service function to extract card data from an image by chaining
 * POST /upload (multipart/form-data) -> POST /extract (application/json)
 * using the real FastAPI backend.
 */
export async function extractCardData(
  fileOrInput: File | Blob | { name: string; file?: File; previewUrl?: string },
  shouldSimulateFailure = false
): Promise<ExtractedCardData> {
  if (shouldSimulateFailure) {
    throw new Error("FastAPI OCR Engine simulated timeout: failed to process image stream. Please retry.");
  }

  // Step 0: Ensure we have a valid File object for multipart upload
  const file = await resolveToFile(fileOrInput);

  // Step 1: Upload the file (POST {BASE_URL}/upload)
  let uploadRes: Response;
  try {
    const formData = new FormData();
    formData.append("file", file);

    uploadRes = await fetch(`${API_BASE_URL}/upload`, {
      method: "POST",
      body: formData,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) {
      throw new Error(
        `Backend connection failed (${API_BASE_URL}). Please verify FastAPI is running and CORS allows origin.`
      );
    }
    throw new Error(`Upload network error: ${msg}`);
  }

  if (!uploadRes.ok) {
    let errorDetail = `HTTP ${uploadRes.status} ${uploadRes.statusText}`;
    try {
      const errJson = await uploadRes.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // fallback to status text
    }
    throw new Error(`Upload failed (${uploadRes.status}): ${errorDetail}`);
  }

  const uploadData = await uploadRes.json();
  const imageId = uploadData?.image_id;
  if (!imageId) {
    throw new Error("Backend upload response did not include 'image_id'");
  }

  // Step 2: Extract data using image_id (POST {BASE_URL}/extract)
  // Note: source_type is omitted so backend defaults it as requested
  let extractRes: Response;
  try {
    extractRes = await fetch(`${API_BASE_URL}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_id: imageId,
      }),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("Load failed")) {
      throw new Error(
        `Extraction request failed (${API_BASE_URL}/extract). Please check network and backend CORS.`
      );
    }
    throw new Error(`Extraction network error: ${msg}`);
  }

  if (!extractRes.ok) {
    let errorDetail = `HTTP ${extractRes.status} ${extractRes.statusText}`;
    try {
      const errJson = await extractRes.json();
      if (errJson.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // fallback to status text
    }
    throw new Error(`Extraction failed (${extractRes.status}): ${errorDetail}`);
  }

  const extractData = await extractRes.json();

  // Step 3: Normalize and format to exact ExtractedCardData shape
  const rawConfidence = extractData?.confidence || {};
  const confidence: FieldConfidence = {
    company_name:
      typeof rawConfidence.company_name === "number"
        ? rawConfidence.company_name
        : 0.0,
    email:
      typeof rawConfidence.email === "number"
        ? rawConfidence.email
        : 0.0,
    phone:
      typeof rawConfidence.phone === "number"
        ? rawConfidence.phone
        : 0.0,
    website:
      typeof rawConfidence.website === "number"
        ? rawConfidence.website
        : 0.0,
  };

  const validSourceTypes: SourceType[] = ["card", "paper", "panaflex"];
  const rawSourceType = String(extractData?.source_type || "card").toLowerCase();
  const sourceType: SourceType = validSourceTypes.includes(rawSourceType as SourceType)
    ? (rawSourceType as SourceType)
    : "card";

  return {
    image_id: extractData.image_id || imageId,
    company_name: extractData.company_name ?? null,
    email: extractData.email ?? null,
    phone: extractData.phone ?? null,
    website: extractData.website ?? null,
    confidence,
    source_type: sourceType,
  };
}

/**
 * Checks if a card extraction result has all fields null (unreadable image)
 */
export function isAllFieldsNull(data: ExtractedCardData | null | undefined): boolean {
  if (!data) return false;
  return (
    !data.company_name &&
    !data.email &&
    !data.phone &&
    !data.website
  );
}

/**
 * Checks if a specific field has low confidence (< 0.6)
 */
export function isLowConfidence(confidenceScore: number | undefined): boolean {
  return typeof confidenceScore === "number" && confidenceScore < 0.6;
}
