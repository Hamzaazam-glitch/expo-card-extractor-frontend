import { BackendRecord, ExtractedCardData, FieldConfidence, SourceType } from "@/types/extractor";

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
  requestedSourceType: SourceType = "card",
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

  // Step 2: Extract data using image_id and selected source_type (POST {BASE_URL}/extract)
  let extractRes: Response;
  try {
    extractRes = await fetch(`${API_BASE_URL}/extract`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image_id: imageId,
        source_type: requestedSourceType,
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
  const rawSourceType = String(extractData?.source_type || requestedSourceType || "card").toLowerCase();
  const normalizedSourceType: SourceType = validSourceTypes.includes(rawSourceType as SourceType)
    ? (rawSourceType as SourceType)
    : "card";

  return {
    image_id: extractData.image_id || imageId,
    company_name: extractData.company_name ?? null,
    email: extractData.email ?? null,
    phone: extractData.phone ?? null,
    website: extractData.website ?? null,
    confidence,
    source_type: normalizedSourceType,
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

export interface PatchRecordFields {
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
}

/**
 * Persists manual field edits via PATCH /records/{id}.
 * API contract: Accepts any subset of extracted fields; frontend restricts to
 * company_name, email, phone, website ONLY.
 * Treats any non-2xx or network error as failed; does not depend on response body.
 */
export async function patchRecord(
  id: string,
  fields: PatchRecordFields
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/records/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(fields),
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`PATCH /records/${id} network error: ${msg}`);
  }

  if (!res.ok) {
    throw new Error(`PATCH /records/${id} failed with HTTP ${res.status}`);
  }
}

/**
 * Fetches all saved records from GET /records.
 * Backend contract: returns newest first (empty DB returns []).
 * Keys: id, image_id, company_name, email, phone, website, confidence {4 keys},
 * source_type, reviewed, storage_url (signed 1h or null).
 */
export async function getRecords(): Promise<BackendRecord[]> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/records`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to connect to backend GET /records: ${msg}`);
  }

  if (!res.ok) {
    let errorDetail = `HTTP ${res.status}`;
    try {
      const errJson = await res.json();
      if (errJson?.detail) {
        errorDetail = typeof errJson.detail === "string" ? errJson.detail : JSON.stringify(errJson.detail);
      }
    } catch {
      // fallback
    }
    throw new Error(`GET /records failed (${res.status}): ${errorDetail}`);
  }

  const raw = await res.json();
  if (!Array.isArray(raw)) {
    return [];
  }

  return raw.map((item: Record<string, unknown>): BackendRecord => {
    const rawConf = (item.confidence && typeof item.confidence === "object" ? item.confidence : {}) as Record<string, unknown>;
    const confidence: FieldConfidence = {
      company_name: typeof rawConf.company_name === "number" ? rawConf.company_name : 0.0,
      email: typeof rawConf.email === "number" ? rawConf.email : 0.0,
      phone: typeof rawConf.phone === "number" ? rawConf.phone : 0.0,
      website: typeof rawConf.website === "number" ? rawConf.website : 0.0,
    };

    const validSourceTypes: SourceType[] = ["card", "paper", "panaflex"];
    const rawSourceType = String(item.source_type || "card").toLowerCase();
    const sourceType: SourceType = validSourceTypes.includes(rawSourceType as SourceType)
      ? (rawSourceType as SourceType)
      : "card";

    return {
      id: typeof item.id === "string" ? item.id : String(item.image_id || ""),
      image_id: String(item.image_id || ""),
      company_name: typeof item.company_name === "string" ? item.company_name : null,
      email: typeof item.email === "string" ? item.email : null,
      phone: typeof item.phone === "string" ? item.phone : null,
      website: typeof item.website === "string" ? item.website : null,
      confidence,
      source_type: sourceType,
      reviewed: Boolean(item.reviewed),
      storage_url: typeof item.storage_url === "string" ? item.storage_url : null,
    };
  });
}

