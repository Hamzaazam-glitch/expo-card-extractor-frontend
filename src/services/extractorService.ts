import { BackendRecord, ExtractedCardData, FieldConfidence, SourceType } from "@/types/extractor";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

export const TIMEOUT_UPLOAD_MS = 60_000;
export const TIMEOUT_DEFAULT_MS = 30_000;
export const TIMEOUT_EXTRACT_MS = 180_000;

interface FetchTimeoutOptions extends RequestInit {
  timeoutMs?: number;
  timeoutMessage?: string;
  endpointName?: string;
}

async function fetchWithTimeout(
  url: string,
  options: FetchTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = TIMEOUT_DEFAULT_MS,
    timeoutMessage,
    endpointName = "Request",
    ...fetchInit
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const res = await fetch(url, {
      ...fetchInit,
      signal: controller.signal,
    });
    return res;
  } catch (err: unknown) {
    if (
      controller.signal.aborted ||
      (err instanceof DOMException && err.name === "AbortError") ||
      (err as { name?: string })?.name === "AbortError"
    ) {
      throw new Error(
        timeoutMessage ||
          `${endpointName} timed out after ${timeoutMs / 1000}s.`
      );
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("Load failed")
    ) {
      throw new Error(
        `Backend connection failed (${API_BASE_URL}). Please verify FastAPI is running and CORS allows origin.`
      );
    }
    throw new Error(`${endpointName} network error: ${msg}`);
  } finally {
    clearTimeout(timeoutId);
  }
}

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
 * Uploads an image file to POST /upload and returns the resulting image_id.
 */
export async function uploadCardImage(
  fileOrInput: File | Blob | { name: string; file?: File; previewUrl?: string }
): Promise<string> {
  const file = await resolveToFile(fileOrInput);

  const formData = new FormData();
  formData.append("file", file);

  const uploadRes = await fetchWithTimeout(`${API_BASE_URL}/upload`, {
    method: "POST",
    body: formData,
    timeoutMs: TIMEOUT_UPLOAD_MS,
    timeoutMessage: "Upload timed out after 60s. Please check your network connection.",
    endpointName: "Upload",
  });

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

  return imageId;
}

/**
 * Triggers OCR extraction on an already uploaded image by image_id (POST /extract).
 */
export async function extractFromImageId(
  imageId: string,
  requestedSourceType: SourceType = "card"
): Promise<ExtractedCardData> {
  const extractRes = await fetchWithTimeout(`${API_BASE_URL}/extract`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      image_id: imageId,
      source_type: requestedSourceType,
    }),
    timeoutMs: TIMEOUT_EXTRACT_MS,
    timeoutMessage:
      "Extraction timed out after 180s. The server may still be processing this image; please wait a moment before retrying.",
    endpointName: "Extraction",
  });

  if (!extractRes.ok) {
    if (extractRes.status === 503) {
      throw new Error("Extraction service is not configured on the server.");
    }
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
 * Service function to extract card data from an image by chaining
 * POST /upload (multipart/form-data) -> POST /extract (application/json)
 */
export async function extractCardData(
  fileOrInput: File | Blob | { name: string; file?: File; previewUrl?: string },
  requestedSourceType: SourceType = "card"
): Promise<ExtractedCardData> {
  const imageId = await uploadCardImage(fileOrInput);
  return extractFromImageId(imageId, requestedSourceType);
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


export interface PatchRecordFields {
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  confidence?: FieldConfidence;
  reviewed?: boolean;
}

/**
 * Persists manual field edits or review status via PATCH /records/{id}.
 * API contract: Accepts any subset of extracted fields; frontend restricts to
 * company_name, email, phone, website, confidence, reviewed.
 * Treats any non-2xx or network error as failed; does not depend on response body.
 */
export async function patchRecord(
  id: string,
  fields: PatchRecordFields
): Promise<void> {
  const res = await fetchWithTimeout(`${API_BASE_URL}/records/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(fields),
    timeoutMs: TIMEOUT_DEFAULT_MS,
    timeoutMessage: "Save request timed out after 30s. Please retry saving your edits.",
    endpointName: `PATCH /records/${id}`,
  });

  if (!res.ok) {
    throw new Error(`PATCH /records/${id} failed with HTTP ${res.status}`);
  }
}

/**
 * Fetches all saved records from GET /records.
 * Backend contract: returns newest first (empty DB returns []).
 * Optional ?reviewed=true|false filter query parameter.
 * Keys: id, image_id, company_name, email, phone, website, confidence {4 keys},
 * source_type, reviewed, storage_url (signed 1h or null).
 */
export async function getRecords(options?: { reviewed?: boolean }): Promise<BackendRecord[]> {
  let url = `${API_BASE_URL}/records`;
  if (options?.reviewed !== undefined) {
    url += `?reviewed=${options.reviewed}`;
  }
  const res = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    timeoutMs: TIMEOUT_DEFAULT_MS,
    timeoutMessage: "Loading saved records timed out after 30s.",
    endpointName: "GET /records",
  });

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

