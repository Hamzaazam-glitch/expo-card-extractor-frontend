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

export interface CardItem {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  previewUrl: string;
  status: ProcessingStatus;
  progress?: number; // 0-100%
  errorMessage?: string;
  data: ExtractedCardData | null;
  isReviewed: boolean;
  createdAt: number;
  isUnreadable?: boolean;
}

export type TableFilter = "all" | "needs_review" | "low_confidence" | "unreadable" | "reviewed";
