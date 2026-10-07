export type SourceType = "card" | "paper" | "panaflex";

export interface FieldConfidence {
  company_name: number;
  email: number;
  phone: number;
  website: number;
}

/**
 * Exact shape returned by the FastAPI backend
 */
export interface ExtractedCardData {
  image_id: string; // uuid
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  confidence: FieldConfidence;
  source_type: SourceType;
}

export type ProcessingStatus = "queued" | "processing" | "done" | "failed";
export type SaveStatus = "idle" | "saving" | "saved" | "failed";

export interface BackendRecord {
  id?: string;
  image_id: string;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  confidence: FieldConfidence;
  source_type: SourceType;
  reviewed: boolean;
  storage_url: string | null;
}

export interface CardItem {
  id: string;
  imageId?: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  previewUrl: string;
  storageUrl?: string | null;
  isRestored?: boolean;
  file?: File;
  status: ProcessingStatus;
  progress?: number; // 0-100%
  errorMessage?: string;
  data: ExtractedCardData | null;
  isReviewed: boolean;
  isEdited?: boolean;
  createdAt: number;
  isUnreadable?: boolean;
  sourceType?: SourceType;
  saveStatus?: SaveStatus;
  saveError?: string;
}

export type TableFilter = "all" | "needs_review" | "unreadable" | "reviewed";
