import { ExtractedCardData, FieldConfidence, SourceType } from "@/types/extractor";

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
).replace(/\/+$/, "");

/**
 * Helper to rasterize an SVG data URL to a PNG File via HTML5 Canvas
 * so that image decoders (OpenCV / backend) can process it reliably.
 */
function rasterizeSvgToPngFile(dataUrl: string, fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot rasterize image in SSR environment"));
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 800;
        canvas.height = 480;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Unable to create canvas context"));
          return;
        }
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, 800, 480);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error("Canvas toBlob export failed"));
            return;
          }
          const cleanName = fileName.replace(/\.[^.]+$/, ".png");
          resolve(new File([blob], cleanName, { type: "image/png" }));
        }, "image/png");
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      reject(new Error("Failed to load SVG data URL for rasterization"));
    };
    img.src = dataUrl;
  });
}

/**
 * Helper to create a fallback PNG file when only a filename is available
 */
function createFallbackPngFile(fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("Cannot create canvas in SSR environment"));
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 800;
      canvas.height = 480;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Unable to create canvas context"));
        return;
      }
      ctx.fillStyle = "#1e293b";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText(fileName, 40, 100);
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("Fallback canvas toBlob failed"));
          return;
        }
        const safeName = fileName.replace(/\.[^.]+$/, ".png");
        resolve(new File([blob], safeName, { type: "image/png" }));
      }, "image/png");
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Resolves various file input formats (File, Blob, { previewUrl }, or { name })
 * to a genuine File instance with a backend-compatible extension (.jpg, .jpeg, .png).
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
    const inputName = "name" in input && typeof input.name === "string" ? input.name : "card.png";
    if ("previewUrl" in input && typeof input.previewUrl === "string" && input.previewUrl) {
      if (input.previewUrl.startsWith("data:image/svg+xml")) {
        return await rasterizeSvgToPngFile(input.previewUrl, inputName);
      }
      try {
        const res = await fetch(input.previewUrl);
        const blob = await res.blob();
        const safeName = /\.(jpe?g|png)$/i.test(inputName) ? inputName : `${inputName}.jpg`;
        return new File([blob], safeName, { type: blob.type || "image/jpeg" });
      } catch (e) {
        console.warn("Could not convert previewUrl to Blob:", e);
      }
    }
    return createFallbackPngFile(inputName);
  }
  return createFallbackPngFile("card.png");
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
 * Curated realistic mock responses simulating real expo card extractions
 */
export const SAMPLE_EXTRACTED_RESULTS: Omit<ExtractedCardData, "image_id">[] = [
  {
    company_name: "Apex Robotics Ltd",
    email: "contact@apexrobotics.io",
    phone: "+1 (415) 890-2341",
    website: "https://apexrobotics.io",
    confidence: {
      company_name: 0.96,
      email: 0.94,
      phone: 0.91,
      website: 0.97,
    },
    source_type: "card",
  },
  {
    company_name: "Nova Green Energy",
    // Low confidence email to trigger the functional yellow-border flag (< 0.6)
    email: "info@novagreen.energy",
    phone: "+44 20 7946 0912",
    website: "https://novagreen.energy",
    confidence: {
      company_name: 0.88,
      email: 0.48, // < 0.6 FLAG TRIGGER
      phone: 0.89,
      website: 0.72,
    },
    source_type: "paper",
  },
  {
    company_name: "Zenith Global Logistics",
    email: "ops@zenithgl.com",
    // Low confidence phone to trigger the yellow-border flag (< 0.6)
    phone: "+81 3-555-0199",
    website: "https://zenithlogistics.jp",
    confidence: {
      company_name: 0.92,
      email: 0.86,
      phone: 0.54, // < 0.6 FLAG TRIGGER
      website: 0.81,
    },
    source_type: "card",
  },
  {
    company_name: "Quantum Cloud Solutions",
    email: "sales@quantumcloud.net",
    phone: "+1 (800) 452-9811",
    website: null, // missing website
    confidence: {
      company_name: 0.84,
      email: 0.82,
      phone: 0.87,
      website: 0.35, // low confidence / null
    },
    source_type: "panaflex",
  },
  {
    // ALL FIELDS NULL — Unreadable card scenario
    company_name: null,
    email: null,
    phone: null,
    website: null,
    confidence: {
      company_name: 0.0,
      email: 0.0,
      phone: 0.0,
      website: 0.0,
    },
    source_type: "card",
  },
  {
    company_name: "CyberShield Security",
    email: "security@cybershield.org",
    phone: "+49 30 1234567",
    website: "https://cybershield.org",
    confidence: {
      company_name: 0.95,
      email: 0.91,
      phone: 0.88,
      website: 0.94,
    },
    source_type: "card",
  },
  {
    company_name: "Vortex Biotech",
    // Low confidence on both company name and website
    email: "dr.vance@vortexbio.de",
    phone: "+49 89 9876543",
    website: "vortexbio-de.com",
    confidence: {
      company_name: 0.58, // < 0.6 FLAG TRIGGER
      email: 0.91,
      phone: 0.85,
      website: 0.51, // < 0.6 FLAG TRIGGER
    },
    source_type: "paper",
  },
];

/**
 * Sample images (using crisp SVGs encoded as data URLs)
 * for the "Load Sample Exhibition Cards" feature
 */
export function createSampleCardSvg(
  title: string,
  subtitle: string,
  gradient1: string,
  gradient2: string
): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="240" viewBox="0 0 400 240">
    <defs>
      <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${gradient1};stop-opacity:1" />
        <stop offset="100%" style="stop-color:${gradient2};stop-opacity:1" />
      </linearGradient>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>
      </pattern>
    </defs>
    <rect width="400" height="240" rx="16" fill="url(#grad)" />
    <rect width="400" height="240" rx="16" fill="url(#grid)" />
    <circle cx="340" cy="50" r="30" fill="rgba(255,255,255,0.12)" />
    <circle cx="360" cy="70" r="20" fill="rgba(255,255,255,0.08)" />
    <text x="32" y="70" font-family="system-ui, sans-serif" font-weight="700" font-size="20" fill="#ffffff" letter-spacing="0.5">${title}</text>
    <text x="32" y="96" font-family="system-ui, sans-serif" font-weight="400" font-size="12" fill="rgba(255,255,255,0.7)">${subtitle}</text>
    <line x1="32" y1="120" x2="368" y2="120" stroke="rgba(255,255,255,0.2)" stroke-width="1" />
    <text x="32" y="152" font-family="monospace" font-size="11" fill="rgba(255,255,255,0.85)">EXPO PASS: #EXP-${Math.floor(1000 + Math.random() * 9000)}</text>
    <text x="32" y="176" font-family="system-ui, sans-serif" font-size="11" fill="rgba(255,255,255,0.75)">Booth B-${Math.floor(10 + Math.random() * 80)} • Hall 4</text>
    <rect x="32" y="196" width="70" height="18" rx="4" fill="rgba(255,255,255,0.2)" />
    <text x="42" y="209" font-family="system-ui, sans-serif" font-weight="600" font-size="9" fill="#ffffff">VERIFIED</text>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export const SAMPLE_PREVIEWS: { name: string; url: string; size: number }[] = [
  {
    name: "apex_robotics_card.jpg",
    url: createSampleCardSvg("Apex Robotics Ltd", "Robotics & Industrial Automation", "#1e1b4b", "#4338ca"),
    size: 245120,
  },
  {
    name: "nova_green_flyer.png",
    url: createSampleCardSvg("Nova Green Energy", "Clean Energy & Grid Tech", "#064e3b", "#059669"),
    size: 389200,
  },
  {
    name: "zenith_logistics_card.jpg",
    url: createSampleCardSvg("Zenith Global Logistics", "Supply Chain & Worldwide Air Cargo", "#1e293b", "#334155"),
    size: 198400,
  },
  {
    name: "quantum_cloud_banner.webp",
    url: createSampleCardSvg("Quantum Cloud Solutions", "Next-Gen HPC & AI Hosting", "#3b0764", "#7e22ce"),
    size: 512300,
  },
  {
    name: "unreadable_blurry_scan.jpg",
    url: createSampleCardSvg("UNREADABLE SCAN", "Camera Shake / Low Contrast Scan", "#450a0a", "#991b1b"),
    size: 142100,
  },
  {
    name: "vortex_biotech_paper.png",
    url: createSampleCardSvg("Vortex Biotech", "Genomics & Diagnostic Sensors", "#042f2e", "#0f766e"),
    size: 285400,
  },
];

let mockIndex = 0;

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
