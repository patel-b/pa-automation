import type { ExtractedData, Field, RequestType } from "@/lib/schema";

/**
 * A prior-authorization form is modeled as a set of labelled sections, each
 * containing fields. Every field knows how to pull its own starting value
 * (and provenance) out of the normalized ExtractedData — that's what powers
 * the auto-fill step.
 *
 * To add a real payer form: copy generic-medication-pa.ts, rename it, and map
 * each field on the real PDF to the matching ExtractedData value below.
 */

export type FormFieldType =
  | "text"
  | "textarea"
  | "date" // masked MM/DD/YYYY
  | "tel" // masked (XXX) XXX-XXXX
  | "select" // dropdown (with optional "Other" free-text)
  | "autocomplete" // type-ahead from a suggestion list
  | "address"; // text input, optionally backed by Google Places autocomplete

export interface SelectOption {
  label: string;
  value: string;
}

export interface FormFieldDef {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  /** Small helper text shown under the label. */
  hint?: string;
  /** Render full-width even if it's not a textarea. */
  fullWidth?: boolean;
  /** Options for a `select` field. */
  options?: SelectOption[];
  /** For `select`: also offer an "Other" choice with a free-text box. */
  allowOther?: boolean;
  /** For `autocomplete`: which suggestion source to use. */
  suggest?: "medications" | "diagnoses";
  /** For `autocomplete`: key of another field to auto-fill on select (e.g. ICD-10). */
  linkedField?: string;
  /** Derive the initial value + confidence/source from extracted data. */
  fromExtracted: (d: ExtractedData) => Field;
}

export interface FormSection {
  title: string;
  fields: FormFieldDef[];
}

export interface FormTemplate {
  id: string;
  title: string;
  /** Human-readable label, e.g. "Aetna" or "Generic / Any payer". */
  payerLabel: string;
  /**
   * Lowercase fragments of payer names this form applies to (e.g. ["aetna"]).
   * An empty array means the form is payer-agnostic (a fallback).
   */
  payerMatchers: string[];
  /** Which request types this form covers. */
  requestTypes: RequestType[];
  sections: FormSection[];
}

/** Flattened field produced when a template meets real data (sent to the client). */
export interface FilledField {
  key: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  hint?: string;
  fullWidth?: boolean;
  options?: SelectOption[];
  allowOther?: boolean;
  suggest?: "medications" | "diagnoses";
  linkedField?: string;
  value: string;
  confidence: Field["confidence"];
  source: string;
}

export interface FilledSection {
  title: string;
  fields: FilledField[];
}

export interface FilledForm {
  formId: string;
  formTitle: string;
  payerLabel: string;
  sections: FilledSection[];
}
