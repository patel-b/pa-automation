import type { ExtractedData } from "@/lib/schema";
import type { FilledForm } from "@/lib/forms/types";

/** Shape returned by POST /api/extract and consumed by the homepage. */
export interface ExtractResponse {
  extracted: ExtractedData;
  match: {
    formId: string;
    formTitle: string;
    payerLabel: string;
    reason: string;
    alternatives: { id: string; title: string }[];
  };
  filledForm: FilledForm;
  /** True when the result was served from a bundled sample (no API call made). */
  demo?: boolean;
}
